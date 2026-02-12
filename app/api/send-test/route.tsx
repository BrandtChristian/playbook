import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResendClient, renderTestEmail } from "@/lib/resend";
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

  const { subject, bodyHtml, to } = await request.json();

  if (!subject || !bodyHtml || !to) {
    return NextResponse.json(
      { error: "subject, bodyHtml, and to are required" },
      { status: 400 }
    );
  }

  // Render subject with sample data
  const renderedSubject = await renderTemplate(subject, sampleData);

  // Render body with sample data + base layout
  const brandConfig = (org.brand_config && typeof org.brand_config === "object" && Object.keys(org.brand_config).length > 0)
    ? (org.brand_config as Record<string, string>)
    : undefined;

  const html = await renderTestEmail({
    bodyHtml,
    fromName: org.from_name || undefined,
    brandConfig,
  });

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

  return NextResponse.json({ id: data?.id, message: "Test email sent" });
}
