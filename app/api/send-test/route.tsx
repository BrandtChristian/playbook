import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, renderTestEmail, renderEmail } from "@/lib/resend";
import { renderTemplate, sampleData } from "@/lib/liquid";
import { createStagingClient } from "@/lib/agillic/client";
import { MessageAPIClient } from "@/lib/agillic/message-api";
import { AssetsAPIClient } from "@/lib/agillic/assets-api";
import { DiscoveryAPIClient } from "@/lib/agillic/discovery-api";
import { RecipientsAPIClient } from "@/lib/agillic/recipients-api";
import { convertLiquidToAgillic } from "@/lib/agillic/variable-map";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: org } = await supabase
    .from("organizations")
    .select("resend_api_key, from_email, from_name, brand_config, email_provider, agillic_credentials")
    .eq("id", profile.org_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const { subject, bodyHtml, to, realLinks } = await request.json();

  if (!subject || !bodyHtml || !to) {
    return NextResponse.json(
      { error: "subject, bodyHtml, and to are required" },
      { status: 400 }
    );
  }

  // === AGILLIC TEST PATH ===
  if (org.email_provider === "agillic") {
    return handleAgillicTest(org, subject, bodyHtml, to);
  }

  // === RESEND TEST PATH (original, unchanged) ===
  if (!org.resend_api_key || !org.from_email) {
    return NextResponse.json(
      { error: "Configure Resend API key and sender address in Settings first" },
      { status: 400 }
    );
  }

  // Render subject with sample data
  const renderedSubject = await renderTemplate(subject, sampleData);

  const brandConfig = (org.brand_config && typeof org.brand_config === "object" && Object.keys(org.brand_config).length > 0)
    ? (org.brand_config as Record<string, string>)
    : undefined;

  let html: string;

  if (realLinks) {
    // Find or create a contact for the test email address
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("org_id", profile.org_id)
      .eq("email", to)
      .single();

    let contactId: string;
    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from("contacts")
        .insert({ org_id: profile.org_id, email: to, first_name: "Test" })
        .select("id")
        .single();
      if (contactErr || !newContact) {
        return NextResponse.json(
          { error: "Failed to create test contact" },
          { status: 500 }
        );
      }
      contactId = newContact.id;
    }

    // Find or create a preference token
    const { data: existingToken } = await supabase
      .from("preference_tokens")
      .select("token")
      .eq("contact_id", contactId)
      .eq("org_id", profile.org_id)
      .single();

    let tokenValue: string;
    if (existingToken) {
      tokenValue = existingToken.token;
    } else {
      const { data: newToken, error: tokenErr } = await supabase
        .from("preference_tokens")
        .insert({ contact_id: contactId, org_id: profile.org_id })
        .select("token")
        .single();
      if (tokenErr || !newToken) {
        return NextResponse.json(
          { error: "Failed to create preference token" },
          { status: 500 }
        );
      }
      tokenValue = newToken.token;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

    html = await renderEmail({
      bodyHtml,
      data: sampleData,
      fromName: org.from_name || undefined,
      brandConfig,
      unsubscribeUrl: `${appUrl}/unsubscribe/${tokenValue}`,
      preferencesUrl: `${appUrl}/preferences/${tokenValue}`,
    });
  } else {
    html = await renderTestEmail({
      bodyHtml,
      fromName: org.from_name || undefined,
      brandConfig,
    });
  }

  const resend = getResendClient(org.resend_api_key);
  const safeName = org.from_name?.replace(/[\r\n]/g, "") || "";
  const from = safeName
    ? `${safeName} <${org.from_email}>`
    : org.from_email;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject: renderedSubject,
    html,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to send test email" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    id: data?.id,
    message: realLinks
      ? "Test email sent with real unsubscribe/preference links"
      : "Test email sent",
  });
}

/**
 * Send a test email via Agillic Decentralised Messaging API.
 *
 * Flow: Upload template -> Stage test campaign -> Wait -> Test with recipient
 */
async function handleAgillicTest(
  org: {
    from_name: string | null;
    from_email: string | null;
    agillic_credentials: unknown;
  },
  subject: string,
  bodyHtml: string,
  to: string,
) {
  const creds = org.agillic_credentials as {
    staging_key: string;
    staging_secret: string;
    staging_url: string;
    prod_key: string;
    prod_secret: string;
    prod_url: string;
  } | null;

  if (!creds) {
    return NextResponse.json(
      { error: "Configure Agillic credentials in Settings first" },
      { status: 400 }
    );
  }

  try {
    console.log(`[agillic-test] Starting test send to "${to}"`);
    console.log(`[agillic-test] Using staging key: ${creds.staging_key?.slice(0, 4)}...`);

    const client = createStagingClient(creds);
    const discovery = new DiscoveryAPIClient(client);
    const recipients = new RecipientsAPIClient(client);

    // Step 1: Verify recipient exists in Agillic
    console.log(`[agillic-test] Step 1: Looking up recipient ID field...`);
    const recipientIdField = await discovery.getRecipientIdField();
    console.log(`[agillic-test] Recipient ID field: ${recipientIdField?.name ?? "not found, defaulting to EMAIL"}`);

    console.log(`[agillic-test] Step 1b: Looking up recipient by email: ${to}`);
    const recipient = await recipients.getByEmail(to);

    if (!recipient) {
      console.log(`[agillic-test] Recipient not found in Agillic`);
      return NextResponse.json(
        { error: `Recipient "${to}" not found in Agillic. The test email address must exist as a recipient in your Agillic instance.` },
        { status: 400 }
      );
    }

    const recipientIdFieldName = recipientIdField?.name || "EMAIL";
    const recipientId = recipient.personData?.[recipientIdFieldName] || to;
    console.log(`[agillic-test] Recipient found, ID: ${recipientId}`);

    // Step 2: Convert and upload template
    console.log(`[agillic-test] Step 2: Uploading template...`);
    const assets = new AssetsAPIClient(client);
    const agillicHtml = convertLiquidToAgillic(bodyHtml);
    const testId = `test-${Date.now()}`;
    const templateFilename = `forge-test-${testId}.html`;
    await assets.uploadTemplate(agillicHtml, templateFilename);
    console.log(`[agillic-test] Template uploaded: ${templateFilename}`);

    // Step 3: Stage test campaign
    const targetGroup = "All Recipients";
    const campaignName = `forge-test-${testId}`;
    console.log(`[agillic-test] Step 3: Staging campaign "${campaignName}" targeting "${targetGroup}"`);

    const messaging = new MessageAPIClient(client);
    const stageResult = await messaging.stageCampaign({
      name: campaignName,
      subject,
      templateName: templateFilename,
      targetGroupName: targetGroup,
      senderName: org.from_name || undefined,
      senderEmail: org.from_email || undefined,
      utmCampaign: campaignName,
      blockGroups: [],
    });
    console.log(`[agillic-test] Staged, taskId: ${stageResult.taskId}`);

    // Step 4: Wait for propagation
    console.log(`[agillic-test] Step 4: Waiting 5s for propagation...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));

    for (let i = 0; i < 10; i++) {
      try {
        const status = await messaging.getTaskStatus(stageResult.taskId);
        console.log(`[agillic-test] Poll ${i + 1}: status=${status.status}`);
        if (status.status === "completed") break;
        if (status.status === "failed") {
          throw new Error("Test campaign staging failed in Agillic");
        }
      } catch (pollErr) {
        if (pollErr instanceof Error && pollErr.message.includes("staging failed")) throw pollErr;
        console.log(`[agillic-test] Poll ${i + 1}: error (retrying)`, pollErr instanceof Error ? pollErr.message : pollErr);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Step 5: Send the test
    console.log(`[agillic-test] Step 5: Sending test to ${recipientId}`);
    const testResult = await messaging.testCampaign(
      campaignName,
      recipientId,
      true
    );
    console.log(`[agillic-test] Test result: success=${testResult.success}, message=${testResult.message}`);

    return NextResponse.json({
      message: testResult.success
        ? "Test email sent via Agillic"
        : "Test email may have been sent — check Agillic for status",
      agillicResponse: testResult.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agillic test send failed";
    console.error(`[agillic-test] FAILED:`, message);
    if (error instanceof Error && error.stack) {
      console.error(`[agillic-test] Stack:`, error.stack);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
