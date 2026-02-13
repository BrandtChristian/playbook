import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStagingClient } from "@/lib/agillic/client";
import { MessageAPIClient } from "@/lib/agillic/message-api";
import type { AgillicOrgCredentials } from "@/lib/agillic/client";

/**
 * Save Agillic email variables locally, then attempt to stage in Agillic.
 * Local save always succeeds. Agillic staging is best-effort.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  console.log(`[agillic-save] Starting save for email ${emailId}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 });
  }

  // Fetch email + org
  const { data: email, error: emailError } = await supabase
    .from("emails")
    .select("*, organizations:org_id(agillic_credentials, from_name, from_email)")
    .eq("id", emailId)
    .single();

  if (emailError || !email) {
    console.error(`[agillic-save] Email fetch error:`, emailError);
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  console.log(`[agillic-save] Email found: "${email.name}", template: ${email.agillic_template_name}`);

  const org = email.organizations as {
    agillic_credentials: AgillicOrgCredentials | null;
    from_name: string | null;
    from_email: string | null;
  };

  const { subject, variables, targetGroupName } = await request.json();
  console.log(`[agillic-save] Subject: "${subject}", variables: ${Object.keys(variables || {}).length} keys, target group: ${targetGroupName || "none"}`);

  // Step 1: Always save locally (this should never fail)
  const { error: updateError } = await supabase
    .from("emails")
    .update({
      subject,
      agillic_variables: variables,
      agillic_target_group_name: targetGroupName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  if (updateError) {
    console.error(`[agillic-save] Local save failed:`, updateError);
    return NextResponse.json({ error: "Failed to save locally" }, { status: 500 });
  }

  console.log(`[agillic-save] Local save OK`);

  // Step 2: Attempt Agillic staging (non-fatal if it fails)
  if (!org.agillic_credentials) {
    console.log(`[agillic-save] No Agillic credentials, skipping staging`);
    return NextResponse.json({
      success: true,
      staged: false,
      message: "Saved locally. Configure Agillic credentials to stage.",
    });
  }

  // Use the selected target group or fall back to fetching one
  let targetGroupNameToUse = targetGroupName;
  if (!targetGroupNameToUse) {
    const { data: targetGroups } = await supabase
      .from("agillic_target_groups")
      .select("name")
      .eq("org_id", profile.org_id)
      .limit(1);
    
    targetGroupNameToUse = targetGroups?.[0]?.name;
    if (!targetGroupNameToUse) {
      console.warn(`[agillic-save] No target group selected or available`);
      return NextResponse.json({
        success: true,
        staged: false,
        message: "Saved locally. Select a target group to stage in Agillic.",
      });
    }
  }
  
  console.log(`[agillic-save] Using target group: ${targetGroupNameToUse}`);

  // Fetch template metadata
  const { data: template, error: tplError } = await supabase
    .from("agillic_template_cache")
    .select("template_name, detected_variables, block_groups")
    .eq("org_id", profile.org_id)
    .eq("template_name", email.agillic_template_name)
    .single();

  if (tplError || !template) {
    console.warn(`[agillic-save] Template cache miss for "${email.agillic_template_name}":`, tplError);
    return NextResponse.json({
      success: true,
      staged: false,
      message: "Saved locally. Template not in cache — sync templates first to enable Agillic staging.",
    });
  }

  console.log(`[agillic-save] Template found: "${template.template_name}", ${(template.detected_variables as unknown[])?.length ?? 0} variables`);

  try {
    const client = createStagingClient(org.agillic_credentials);
    const messaging = new MessageAPIClient(client);

    const existingCampaignId = email.agillic_campaign_id;
    // Deterministic campaign name — same for all saves of this email
    // Like Bifrost: "FORGE_{orgId4}_{emailId8}_{safeName}"
    const safeName = (email.name || 'Email').replace(/[^a-zA-Z0-9_-]/g, '_');
    const campaignName = `FORGE_${profile.org_id.substring(0, 4)}_${emailId.substring(0, 8)}_${safeName}`;

    const templateBlockGroups = (template.block_groups ?? []) as Array<{ blockGroupId: string; blockId: string; messageTemplate?: string }>;
    const blockGroups = buildBlockGroups(
      template.detected_variables as Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
      variables || {},
      templateBlockGroups,
      email.agillic_template_name || '',
      campaignName,
    );

    console.log(`[agillic-save] Block groups built: ${blockGroups.length} groups (filtered from ${templateBlockGroups.filter(bg => !bg.blockGroupId.includes("footer")).length} non-footer groups)`);
    console.log(`[agillic-save] Existing campaign ID: ${existingCampaignId || "none (first save)"}`);

    // Validate: must have at least one block group with fields
    if (blockGroups.length === 0) {
      console.warn(`[agillic-save] No block groups with fields — cannot stage to Agillic`);
      return NextResponse.json({
        success: true,
        staged: false,
        message: "Saved locally. No content to stage — please populate template variables.",
      });
    }

    if (existingCampaignId) {
      console.log(`[agillic-save] Editing existing campaign: ${existingCampaignId}`);
      // Edit format: strip blockGroupId, messageTemplate, blockId (stage-only fields)
      const editBlockGroups = blockGroups.map((bg) => ({
        messages: bg.messages.map((msg) => ({
          name: msg.name,
          variants: msg.variants,
        })),
      }));
      console.log(`[agillic-save] Edit payload:`, JSON.stringify({ campaignId: existingCampaignId, subject, blockGroups: editBlockGroups }).slice(0, 500));
      // Use V1 (synchronous) — proven working in Bifrost
      try {
        const editResult = await messaging.editCampaignV1(existingCampaignId, {
          subject,
          targetGroupName: targetGroupNameToUse,
          utmCampaign: campaignName,
          blockGroups: editBlockGroups as import("@/lib/agillic/message-api").EditBlockGroup[],
        });
        console.log(`[agillic-save] V1 Edit OK:`, JSON.stringify(editResult).slice(0, 200));
      } catch (editErr) {
        // Edit failed — likely message name mismatch from old staging.
        // Re-stage with a new campaign using the correct deterministic names.
        const errMsg = editErr instanceof Error ? editErr.message : String(editErr);
        console.warn(`[agillic-save] Edit failed (${errMsg}), re-staging as new campaign...`);

        try {
          // Rebuild block groups with a unique campaign name so message names don't collide
          const reStageCampaignName = `${campaignName}_${Date.now()}`;
          const reStageBlockGroups = buildBlockGroups(
            template.detected_variables as Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
            variables || {},
            templateBlockGroups,
            email.agillic_template_name || '',
            reStageCampaignName,
          );
          const reStagePayload: import("@/lib/agillic/message-api").StagePayload = {
            name: reStageCampaignName,
            subject,
            templateName: template.template_name,
            targetGroupName: targetGroupNameToUse,
            utmCampaign: campaignName,
            blockGroups: reStageBlockGroups,
          };
          const reStageResult = await messaging.stageCampaignV1(reStagePayload);
          console.log(`[agillic-save] Re-stage OK: campaignId=${reStageResult.campaignId}`);

          await supabase
            .from("emails")
            .update({ agillic_campaign_id: reStageResult.campaignId })
            .eq("id", emailId);

          return NextResponse.json({
            success: true,
            staged: true,
            agillicCampaignId: reStageResult.campaignId,
            reStaged: true,
          });
        } catch (reStageErr) {
          // Both edit and re-stage failed — clear the campaign ID so next save does a fresh stage
          const reStageMsg = reStageErr instanceof Error ? reStageErr.message : String(reStageErr);
          console.error(`[agillic-save] Re-stage also failed (${reStageMsg}), clearing campaign ID`);

          await supabase
            .from("emails")
            .update({ agillic_campaign_id: null })
            .eq("id", emailId);

          return NextResponse.json({
            success: true,
            staged: false,
            message: `Saved locally. Agillic edit and re-stage both failed: ${errMsg}. Campaign ID cleared — next save will create a fresh campaign.`,
          });
        }
      }
    } else {
      console.log(`[agillic-save] Staging new campaign via V1: ${campaignName}`);

      // Use V1 staging — returns campaignId directly (needed for :test endpoint)
      const stagePayload: import("@/lib/agillic/message-api").StagePayload = {
        name: campaignName,
        subject,
        templateName: template.template_name,
        targetGroupName: targetGroupNameToUse,
        utmCampaign: campaignName,
        blockGroups,
      };
      // Sender fields: only include if this is a valid Agillic sender domain.
      // The org's from_email may be a Resend domain — never send that to Agillic.
      // For now, let Agillic use its configured default sender.
      // TODO: Add agillic_sender_email field to org settings for explicit Agillic sender config.

      console.log(`[agillic-save] Stage payload keys:`, Object.keys(stagePayload));
      const result = await messaging.stageCampaignV1(stagePayload);

      console.log(`[agillic-save] V1 stage result: campaignId=${result.campaignId}`);

      // Store the REAL Agillic-assigned campaign ID (e.g. "#BaaB"), not our name
      await supabase
        .from("emails")
        .update({ agillic_campaign_id: result.campaignId })
        .eq("id", emailId);

      return NextResponse.json({
        success: true,
        staged: true,
        agillicCampaignId: result.campaignId,
        agillicCampaignName: campaignName,
      });
    }

    return NextResponse.json({ success: true, staged: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[agillic-save] Agillic staging failed:`, message);

    // Return success since local save worked — just flag that staging failed
    return NextResponse.json({
      success: true,
      staged: false,
      stagingError: message,
      message: `Saved locally. Agillic staging failed: ${message}`,
    });
  }
}

/**
 * Build Agillic Message API block groups using the REAL template structure.
 *
 * Maps variables to their block groups based on namespace:
 * - "main" namespace → blockgroup-main
 * - "header" namespace → blockgroup-header
 * - "hero" namespace → blockgroup-main (hero is usually inside main)
 * - editables without namespace → blockgroup-main
 *
 * Uses actual blockGroupId and blockId from the template HTML.
 * Filters out block groups with no fields (Agillic requirement: fields cannot be empty).
 */
function buildBlockGroups(
  parsedVariables: Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
  values: Record<string, string>,
  templateBlockGroups: Array<{ blockGroupId: string; blockId: string; messageTemplate?: string }>,
  templateName: string,
  campaignName: string,
) {
  // Collect all block group namespaces for heuristic matching
  const blockGroupNamespaces = templateBlockGroups.map(
    (bg) => bg.blockGroupId.replace("blockgroup-", "")
  );

  // Group variables by their namespace
  const varsByNamespace = new Map<string, Record<string, string>>();

  for (const v of parsedVariables) {
    let ns: string;
    if (v.namespace) {
      // blockparam variables have explicit namespaces
      ns = v.namespace;
    } else {
      // Editable variables have no namespace — match field name to a block group.
      // e.g., "Preheader" → matches "preheader" block group namespace
      const fieldLower = v.fieldName.toLowerCase();
      const matchedNs = blockGroupNamespaces.find(
        (bgNs) => bgNs.toLowerCase() === fieldLower
      );
      ns = matchedNs || "main";
    }
    if (!varsByNamespace.has(ns)) varsByNamespace.set(ns, {});
    varsByNamespace.get(ns)![v.fieldName] = values[v.raw] || "";
  }

  console.log(`[agillic-save] Variable namespace mapping:`, Object.fromEntries(
    [...varsByNamespace.entries()].map(([ns, fields]) => [ns, Object.keys(fields)])
  ));

  // Map to the real template block groups
  // Strategy: match namespace to blockGroupId suffix
  // e.g., namespace "main" matches "blockgroup-main", namespace "header" matches "blockgroup-header"
  const blockGroups = templateBlockGroups
    .filter((bg) => {
      // Skip footer block group (not user-editable)
      return !bg.blockGroupId.includes("footer");
    })
    .map((bg) => {
      // Extract the namespace from blockGroupId: "blockgroup-main" → "main"
      const bgNamespace = bg.blockGroupId.replace("blockgroup-", "");

      // Collect all variable fields that belong to this block group
      // Check: direct namespace match, or variables whose namespace maps to this block group
      let fields: Record<string, string> = {};

      // Direct match
      if (varsByNamespace.has(bgNamespace)) {
        fields = { ...fields, ...varsByNamespace.get(bgNamespace) };
      }

      // Also check for sub-namespaces: e.g., "hero" variables go into "main" block group
      // This handles cases where the blockGroupId is "blockgroup-main" but variables have namespace "hero"
      for (const [ns, nsFields] of varsByNamespace) {
        // If this namespace doesn't have its own block group, assign to main
        const hasOwnGroup = templateBlockGroups.some(
          (tbg) => tbg.blockGroupId === `blockgroup-${ns}`
        );
        if (!hasOwnGroup && bgNamespace === "main") {
          fields = { ...fields, ...nsFields };
        }
      }

      // Derive message template name from the HTML template name
      // Convention: bifrost-AJ-Produkter.html → uses bifrost-danskindustri-* message templates
      // Extract the prefix from the template filename
      const templatePrefix = templateName?.split('-')[0] || 'forge';
      const templateOrg = templatePrefix === 'bifrost' ? 'bifrost-danskindustri' : templatePrefix;
      
      // Map namespace to message template suffix
      const suffixMap: Record<string, string> = {
        'preheader': 'preheader',
        'header': 'header-logo',
        'main': 'main-hero',
        'hero': 'hero',
        'footer': 'footer',
      };
      const suffix = suffixMap[bgNamespace] || bgNamespace;
      
      const messageTemplate = bg.messageTemplate || `${templateOrg}-${suffix}`;

      return {
        blockGroupId: bg.blockGroupId,
        fields,  // Keep for filtering
        messages: [
          {
            name: `${campaignName}_${bg.blockId}_1`,
            messageTemplate,
            blockId: bg.blockId,
            variants: [{ name: "MessageVariants_1", fields }],
          },
        ],
      };
    })
    .filter((bg) => {
      // CRITICAL: Filter out block groups with no fields
      // Agillic API requires: fields cannot be empty
      const hasFields = Object.keys(bg.fields).length > 0;
      if (!hasFields) {
        console.log(`[agillic-save] Skipping block group ${bg.blockGroupId}: no fields`);
      }
      return hasFields;
    })
    .map(({ fields: _, ...bg }) => bg);  // Remove the temporary fields property

  return blockGroups;
}
