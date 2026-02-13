import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();

  if (user.role !== "admin" && user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { asset_ids, folder_id } = body;

  if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
    return NextResponse.json(
      { error: "asset_ids must be a non-empty array" },
      { status: 400 }
    );
  }

  if (asset_ids.length > 100) {
    return NextResponse.json(
      { error: "Maximum 100 assets per bulk operation" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .update({
      folder_id: folder_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .in("id", asset_ids)
    .eq("org_id", user.org_id)
    .eq("is_active", true)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
