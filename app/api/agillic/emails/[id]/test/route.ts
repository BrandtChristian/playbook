import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createStagingClient } from "@/lib/agillic/client";
import { MessageAPIClient } from "@/lib/agillic/message-api";
import { DiscoveryAPIClient } from "@/lib/agillic/discovery-api";
import { RecipientsAPIClient } from "@/lib/agillic/recipients-api";
import type { AgillicOrgCredentials } from "@/lib/agillic/client";

/**
 * Test send an Agillic email that's already been staged via the save endpoint.
 * Uses the existing agillic_campaign_id — no template upload needed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params;
  const { to } = await request.json();

  if (!to) {
    return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
  }

  console.log(`[agillic-test] Testing email ${emailId} → ${to}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "No profile" }, { status: 400 });

  // Fetch email with org credentials
  const { data: email } = await supabase
    .from("emails")
    .select("agillic_campaign_id, name, organizations:org_id(agillic_credentials)")
    .eq("id", emailId)
    .single();

  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  const campaignId = email.agillic_campaign_id;
  if (!campaignId) {
    return NextResponse.json(
      { error: "Email not yet staged in Agillic. Save it first." },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const org = (email as any).organizations as { agillic_credentials: AgillicOrgCredentials | null };
  if (!org?.agillic_credentials) {
    return NextResponse.json({ error: "Agillic not configured" }, { status: 400 });
  }

  try {
    const client = createStagingClient(org.agillic_credentials);
    const discovery = new DiscoveryAPIClient(client);
    const recipients = new RecipientsAPIClient(client);
    const messaging = new MessageAPIClient(client);

    // Look up recipient
    console.log(`[agillic-test] Looking up recipient: ${to}`);
    const recipientIdField = await discovery.getRecipientIdField();
    const recipient = await recipients.getByEmail(to);

    if (!recipient) {
      return NextResponse.json(
        { error: `Recipient "${to}" not found in Agillic. They must exist as a recipient.` },
        { status: 400 }
      );
    }

    const recipientIdFieldName = recipientIdField?.name || "EMAIL";
    const recipientId = recipient.personData?.[recipientIdFieldName] || to;
    console.log(`[agillic-test] Recipient ID: ${recipientId}`);

    // Test the already-staged campaign
    console.log(`[agillic-test] Testing campaign: ${campaignId}`);
    const result = await messaging.testCampaign(campaignId, recipientId, true);
    console.log(`[agillic-test] Result: success=${result.success}, message=${result.message}`);

    return NextResponse.json({
      message: result.success
        ? "Test email sent via Agillic"
        : "Test sent — check Agillic for delivery status",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test send failed";
    console.error(`[agillic-test] FAILED:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
