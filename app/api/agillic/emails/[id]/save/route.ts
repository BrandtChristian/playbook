import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStagingClient } from "@/lib/agillic/client";
import { MessageAPIClient } from "@/lib/agillic/message-api";
import type { AgillicOrgCredentials } from "@/lib/agillic/client";

/**
 * Save Agillic email variables and stage to Agillic via Message API.
 * First save → stageCampaign. Subsequent saves → editCampaign.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
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
  const { data: email } = await supabase
    .from("emails")
    .select("*, organizations:org_id(agillic_credentials, from_name, from_email)")
    .eq("id", emailId)
    .single();

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const org = email.organizations as {
    agillic_credentials: AgillicOrgCredentials | null;
    from_name: string | null;
    from_email: string | null;
  };

  if (!org.agillic_credentials) {
    return NextResponse.json({ error: "Agillic not configured" }, { status: 400 });
  }

  const { subject, variables } = await request.json();

  // Update email record locally
  await supabase
    .from("emails")
    .update({
      subject,
      agillic_variables: variables,
      updated_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  // Fetch template metadata for constructing the Message API payload
  const { data: template } = await supabase
    .from("agillic_template_cache")
    .select("template_name, detected_variables")
    .eq("org_id", profile.org_id)
    .eq("template_name", email.agillic_template_name)
    .single();

  if (!template) {
    return NextResponse.json({
      error: "Template not found in cache. Sync templates first.",
    }, { status: 400 });
  }

  // Stage/edit in Agillic
  try {
    const client = createStagingClient(org.agillic_credentials);
    const messaging = new MessageAPIClient(client);

    const existingCampaignId = email.agillic_campaign_id;

    if (existingCampaignId) {
      // Edit existing campaign
      await messaging.editCampaign(existingCampaignId, {
        subject,
        targetGroupName: "All Recipients", // Placeholder; real target group set at campaign level
        utmCampaign: email.name,
        blockGroups: buildBlockGroups(template.detected_variables, variables),
      });
    } else {
      // Stage new campaign
      const campaignName = `forge-email-${emailId.slice(0, 8)}-${Date.now()}`;
      const result = await messaging.stageCampaign({
        name: campaignName,
        subject,
        templateName: template.template_name,
        targetGroupName: "All Recipients",
        senderName: org.from_name || undefined,
        senderEmail: org.from_email || undefined,
        utmCampaign: campaignName,
        blockGroups: buildBlockGroups(template.detected_variables, variables),
      });

      // Store campaign ID
      await supabase
        .from("emails")
        .update({ agillic_campaign_id: campaignName })
        .eq("id", emailId);

      return NextResponse.json({
        success: true,
        agillicTaskId: result.taskId,
        agillicCampaignName: campaignName,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agillic staging failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Build Agillic Message API block groups from parsed variables and values.
 * Groups variables by namespace into block groups.
 */
function buildBlockGroups(
  parsedVariables: Array<{ type: string; fieldName: string; namespace?: string; raw: string }>,
  values: Record<string, string>
) {
  // Group by namespace
  const groups = new Map<string, Record<string, string>>();

  for (const v of parsedVariables) {
    if (v.type === "editable") {
      // Editable fields go to a "main" group
      const ns = "main";
      if (!groups.has(ns)) groups.set(ns, {});
      groups.get(ns)![v.fieldName] = values[v.raw] || "";
    } else if (v.type === "blockparam" && v.namespace) {
      const ns = v.namespace;
      if (!groups.has(ns)) groups.set(ns, {});
      groups.get(ns)![v.fieldName] = values[v.raw] || "";
    }
  }

  // Convert to Message API format
  return Array.from(groups.entries()).map(([namespace, fields]) => ({
    blockGroupId: `blockgroup-${namespace}`,
    messages: [
      {
        name: `forge-${namespace}`,
        messageTemplate: `forge-${namespace}`,
        blockId: `block-${namespace}`,
        variants: [
          {
            name: "MessageVariants_1",
            fields,
          },
        ],
      },
    ],
  }));
}
