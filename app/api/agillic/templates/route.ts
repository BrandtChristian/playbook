import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * List cached Agillic templates for the current org.
 */
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
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: templates } = await supabase
    .from("agillic_template_cache")
    .select("id, template_name, detected_variables, synced_at, is_active")
    .eq("org_id", profile.org_id)
    .eq("is_active", true)
    .order("template_name");

  return NextResponse.json({ templates: templates ?? [] });
}
