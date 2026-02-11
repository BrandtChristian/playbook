import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(request: NextRequest) {
  const { token, consents } = (await request.json()) as {
    token?: string;
    consents?: { consent_type_id: string; granted: boolean }[];
  };

  if (!token || !consents) {
    return NextResponse.json(
      { error: "token and consents are required" },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  // Validate token
  const { data: prefToken, error: tokenError } = await supabase
    .from("preference_tokens")
    .select("contact_id, org_id, expires_at")
    .eq("token", token)
    .single();

  if (tokenError || !prefToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (new Date(prefToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 410 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Upsert each consent
  for (const consent of consents) {
    const now = new Date().toISOString();
    await supabase.from("contact_consents").upsert(
      {
        contact_id: prefToken.contact_id,
        consent_type_id: consent.consent_type_id,
        granted: consent.granted,
        granted_at: consent.granted ? now : null,
        revoked_at: consent.granted ? null : now,
        ip_address: ip,
        source: "preference_center",
      },
      { onConflict: "contact_id,consent_type_id" }
    );
  }

  // If all consents revoked, mark contact as unsubscribed
  const allRevoked = consents.every((c) => !c.granted);
  if (allRevoked) {
    await supabase
      .from("contacts")
      .update({ unsubscribed: true })
      .eq("id", prefToken.contact_id);
  } else {
    // Re-subscribe if they've opted back in to anything
    await supabase
      .from("contacts")
      .update({ unsubscribed: false })
      .eq("id", prefToken.contact_id);
  }

  return NextResponse.json({ success: true });
}
