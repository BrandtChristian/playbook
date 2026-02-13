import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (user.role !== "admin" && user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();

  // Check folder exists and isn't system
  const { data: existing } = await supabase
    .from("asset_folders")
    .select("*")
    .eq("id", id)
    .eq("org_id", user.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (existing.is_system) {
    return NextResponse.json(
      { error: "System folders cannot be modified" },
      { status: 403 }
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.name) {
    updates.name = body.name.trim();
    updates.slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }

  const { data: folder, error } = await supabase
    .from("asset_folders")
    .update(updates)
    .eq("id", id)
    .eq("org_id", user.org_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ folder });
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

  // Check it's not a system folder
  const { data: existing } = await supabase
    .from("asset_folders")
    .select("is_system")
    .eq("id", id)
    .eq("org_id", user.org_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  if (existing.is_system) {
    return NextResponse.json(
      { error: "System folders cannot be deleted" },
      { status: 403 }
    );
  }

  // Move assets in this folder to no folder
  await supabase
    .from("assets")
    .update({ folder_id: null, updated_at: new Date().toISOString() })
    .eq("folder_id", id)
    .eq("org_id", user.org_id);

  // Soft delete the folder
  const { error } = await supabase
    .from("asset_folders")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", user.org_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
