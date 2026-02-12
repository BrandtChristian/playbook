import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, renderEmail } from "@/lib/resend";
import { renderTemplate } from "@/lib/liquid";
import { getContactsForSegment } from "@/lib/segments/evaluate";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { campaignId } = await request.json();

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId is required" },
      { status: 400 }
    );
  }

  // Fetch campaign with org info
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*, organizations:org_id(resend_api_key, from_email, from_name, brand_config)")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const org = campaign.organizations as {
    resend_api_key: string | null;
    from_email: string | null;
    from_name: string | null;
    brand_config: Record<string, unknown> | null;
  };

  if (!org?.resend_api_key || !org?.from_email) {
    return NextResponse.json(
      { error: "Configure Resend API key and sender address in Settings" },
      { status: 400 }
    );
  }

  if (!campaign.segment_id) {
    return NextResponse.json(
      { error: "Campaign must have a target segment" },
      { status: 400 }
    );
  }

  if (campaign.status === "sent" || campaign.status === "sending") {
    return NextResponse.json(
      { error: "Campaign already sent or sending" },
      { status: 400 }
    );
  }

  // Update status to sending
  await supabase
    .from("campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId);

  // Resolve contacts for this segment (supports both static and dynamic segments)
  let contacts;
  try {
    contacts = await getContactsForSegment(supabase, campaign.segment_id);
  } catch {
    await supabase
      .from("campaigns")
      .update({ status: "failed", stats: { error: "Failed to resolve segment" } })
      .eq("id", campaignId);
    return NextResponse.json(
      { error: "Failed to resolve segment contacts" },
      { status: 500 }
    );
  }

  if (!contacts || contacts.length === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "failed", stats: { error: "No contacts in segment" } })
      .eq("id", campaignId);
    return NextResponse.json(
      { error: "No active contacts in the target segment" },
      { status: 400 }
    );
  }

  const resend = getResendClient(org.resend_api_key);
  const safeName = org.from_name?.replace(/[\r\n]/g, "") || "";
  const from = safeName
    ? `${safeName} <${org.from_email}>`
    : org.from_email;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  let sent = 0;
  let failed = 0;

  // Send to each contact individually
  for (const contact of contacts) {
    const contactData: Record<string, unknown> = {
      first_name: contact.first_name || "there",
      last_name: contact.last_name || "",
      email: contact.email,
      company: org.from_name || "our team",
      ...(typeof contact.data === "object" && contact.data !== null
        ? contact.data
        : {}),
    };

    try {
      // Look up or create preference token for this contact
      let unsubscribeUrl: string | undefined;
      let preferencesUrl: string | undefined;
      const { data: existingToken } = await supabase
        .from("preference_tokens")
        .select("token")
        .eq("contact_id", contact.id)
        .eq("org_id", campaign.org_id)
        .single();

      const tokenValue = existingToken?.token;
      if (!tokenValue) {
        const { data: newToken } = await supabase
          .from("preference_tokens")
          .insert({ contact_id: contact.id, org_id: campaign.org_id })
          .select("token")
          .single();
        if (newToken) {
          unsubscribeUrl = `${appUrl}/unsubscribe/${newToken.token}`;
          preferencesUrl = `${appUrl}/preferences/${newToken.token}`;
        }
      } else {
        unsubscribeUrl = `${appUrl}/unsubscribe/${tokenValue}`;
        preferencesUrl = `${appUrl}/preferences/${tokenValue}`;
      }

      const renderedSubject = await renderTemplate(
        campaign.subject,
        contactData
      );
      const brandConfig = (org.brand_config && Object.keys(org.brand_config).length > 0)
        ? org.brand_config as Record<string, string>
        : undefined;

      const html = await renderEmail({
        bodyHtml: campaign.body_html,
        data: contactData,
        fromName: org.from_name || undefined,
        brandConfig,
        unsubscribeUrl,
        preferencesUrl,
      });

      const { error: sendError } = await resend.emails.send({
        from,
        to: [contact.email],
        subject: renderedSubject,
        html,
        headers: preferencesUrl
          ? {
              "List-Unsubscribe": `<${preferencesUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      });

      if (sendError) {
        failed++;
      } else {
        sent++;
      }
    } catch {
      failed++;
    }
  }

  // Update campaign status + stats
  const finalStatus = failed === contacts.length ? "failed" : "sent";
  await supabase
    .from("campaigns")
    .update({
      status: finalStatus,
      sent_at: new Date().toISOString(),
      stats: { sent, failed, total: contacts.length },
    })
    .eq("id", campaignId);

  return NextResponse.json({
    status: finalStatus,
    sent,
    failed,
    total: contacts.length,
  });
}
