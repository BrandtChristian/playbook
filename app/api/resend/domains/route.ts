import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export async function GET() {
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
    .select("resend_api_key")
    .eq("id", profile.org_id)
    .single();

  if (!org?.resend_api_key) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  const resend = new Resend(org.resend_api_key);
  const { data, error } = await resend.domains.list();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch domains from Resend" },
      { status: 502 }
    );
  }

  return NextResponse.json({ domains: data?.data ?? [] });
}
