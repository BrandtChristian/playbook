import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { id } = await params;

  const { data: asset, error } = await supabase
    .from("assets")
    .select("*, asset_folders(id, name, slug)")
    .eq("id", id)
    .eq("org_id", user.org_id)
    .eq("is_active", true)
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const storage = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const {
    data: { publicUrl },
  } = storage.storage
    .from("organization-assets")
    .getPublicUrl(asset.storage_path);

  return NextResponse.json({ asset: { ...asset, url: publicUrl } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (user.role !== "admin" && user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  // Soft delete
  const { error } = await supabase
    .from("assets")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", user.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
