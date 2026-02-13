import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "100");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("assets")
    .select("*, asset_folders(id, name, slug)", { count: "exact" })
    .eq("org_id", user.org_id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (folderId) {
    query = query.eq("folder_id", folderId);
  }

  if (search) {
    query = query.ilike("name", `%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assets: data || [], total: count || 0 });
}
