import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, renderTestEmail, renderEmail } from "@/lib/resend";
import { renderTemplate, sampleData } from "@/lib/liquid";

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
    .select("resend_api_key, from_email, from_name, brand_config")
    .eq("id", profile.org_id)
    .single();

  if (!org?.resend_api_key || !org?.from_email) {
    return NextResponse.json(
      { error: "Configure Resend API key and sender address in Settings first" },
      { status: 400 }
    );
  }

  const { subject, bodyHtml, to, realLinks } = await request.json();

  if (!subject || !bodyHtml || !to) {
    return NextResponse.json(
      { error: "subject, bodyHtml, and to are required" },
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
