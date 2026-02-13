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

  const { subject, variables } = await request.json();
  console.log(`[agillic-save] Subject: "${subject}", variables: ${Object.keys(variables || {}).length} keys`);

  // Step 1: Always save locally (this should never fail)
  const { error: updateError } = await supabase
    .from("emails")
    .update({
      subject,
      agillic_variables: variables,
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

  // Fetch template metadata
  const { data: template, error: tplError } = await supabase
    .from("agillic_template_cache")
    .select("template_name, detected_variables")
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
    const blockGroups = buildBlockGroups(
      template.detected_variables as Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
      variables || {}
    );

    console.log(`[agillic-save] Block groups built: ${blockGroups.length} groups`);
    console.log(`[agillic-save] Existing campaign ID: ${existingCampaignId || "none (first save)"}`);

    if (existingCampaignId) {
      console.log(`[agillic-save] Editing existing campaign: ${existingCampaignId}`);
      // Edit format: strip messageTemplate and blockId from messages (stage-only fields)
      const editBlockGroups = blockGroups.map((bg) => ({
        messages: bg.messages.map((msg) => ({
          name: msg.name,
          variants: msg.variants,
        })),
      }));
      console.log(`[agillic-save] Edit payload:`, JSON.stringify({ campaignId: existingCampaignId, subject, blockGroups: editBlockGroups }).slice(0, 500));
      await messaging.editCampaign(existingCampaignId, {
        subject,
        targetGroupName: "All Recipients",
        utmCampaign: email.name,
        blockGroups: editBlockGroups as import("@/lib/agillic/message-api").EditBlockGroup[],
      });
      console.log(`[agillic-save] Edit OK`);
    } else {
      const campaignName = `forge-email-${emailId.slice(0, 8)}-${Date.now()}`;
      console.log(`[agillic-save] Staging new campaign via V1: ${campaignName}`);

      // Use V1 staging — returns campaignId directly (needed for :test endpoint)
      const result = await messaging.stageCampaignV1({
        name: campaignName,
        subject,
        templateName: template.template_name,
        targetGroupName: "All Recipients",
        senderName: org.from_name || undefined,
        senderEmail: org.from_email || undefined,
        utmCampaign: campaignName,
        blockGroups,
      });

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
 * Build Agillic Message API block groups from parsed variables and values.
 */
function buildBlockGroups(
  parsedVariables: Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
  values: Record<string, string>
) {
  const groups = new Map<string, Record<string, string>>();

  for (const v of parsedVariables) {
    if (v.type === "editable") {
      const ns = "main";
      if (!groups.has(ns)) groups.set(ns, {});
      groups.get(ns)![v.fieldName] = values[v.raw] || "";
    } else if (v.type === "blockparam" && v.namespace) {
      const ns = v.namespace;
      if (!groups.has(ns)) groups.set(ns, {});
      groups.get(ns)![v.fieldName] = values[v.raw] || "";
    }
  }

  return Array.from(groups.entries()).map(([namespace, fields]) => ({
    blockGroupId: `blockgroup-${namespace}`,
    messages: [
      {
        name: `forge-${namespace}`,
        messageTemplate: `forge-${namespace}`,
        blockId: `block-${namespace}`,
        variants: [{ name: "MessageVariants_1", fields }],
      },
    ],
  }));
}
