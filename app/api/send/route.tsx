import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, renderEmail } from "@/lib/resend";
import { renderTemplate } from "@/lib/liquid";

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
    .select("*, organizations:org_id(resend_api_key, from_email, from_name)")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const org = campaign.organizations as {
    resend_api_key: string | null;
    from_email: string | null;
    from_name: string | null;
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

  // Fetch contacts in the segment
  const { data: segmentContacts } = await supabase
    .from("segment_contacts")
    .select("contact_id")
    .eq("segment_id", campaign.segment_id);

  const contactIds = (segmentContacts ?? []).map((sc) => sc.contact_id);

  if (contactIds.length === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "failed", stats: { error: "No contacts in segment" } })
      .eq("id", campaignId);
    return NextResponse.json(
      { error: "No contacts in the target segment" },
      { status: 400 }
    );
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .in("id", contactIds)
    .eq("unsubscribed", false);

  if (!contacts || contacts.length === 0) {
    await supabase
      .from("campaigns")
      .update({ status: "failed", stats: { error: "All contacts unsubscribed" } })
      .eq("id", campaignId);
    return NextResponse.json(
      { error: "No active contacts in segment" },
      { status: 400 }
    );
  }

  const resend = getResendClient(org.resend_api_key);
  const from = org.from_name
    ? `${org.from_name} <${org.from_email}>`
    : org.from_email;

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
      const renderedSubject = await renderTemplate(
        campaign.subject,
        contactData
      );
      const html = await renderEmail({
        bodyHtml: campaign.body_html,
        data: contactData,
        fromName: org.from_name || undefined,
      });

      const { error: sendError } = await resend.emails.send({
        from,
        to: [contact.email],
        subject: renderedSubject,
        html,
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
