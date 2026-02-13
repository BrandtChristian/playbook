import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const hierarchical = searchParams.get("hierarchical") === "true";
  const includeCount = searchParams.get("includeCount") === "true";

  const query = supabase
    .from("asset_folders")
    .select("*")
    .eq("org_id", user.org_id)
    .eq("is_active", true)
    .order("name");

  const { data: folders, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let result = folders || [];

  // Add asset counts if requested
  if (includeCount && result.length > 0) {
    const folderIds = result.map((f) => f.id);
    const { data: counts } = await supabase
      .from("assets")
      .select("folder_id")
      .eq("org_id", user.org_id)
      .eq("is_active", true)
      .in("folder_id", folderIds);

    const countMap: Record<string, number> = {};
    (counts || []).forEach((c) => {
      if (c.folder_id) {
        countMap[c.folder_id] = (countMap[c.folder_id] || 0) + 1;
      }
    });

    result = result.map((f) => ({
      ...f,
      asset_count: countMap[f.id] || 0,
    }));
  }

  if (hierarchical) {
    // Build tree structure
    const tree = buildTree(result, null);
    return NextResponse.json({ folders: tree });
  }

  return NextResponse.json({ folders: result });
}

function buildTree(
  folders: Array<Record<string, unknown>>,
  parentId: string | null
): Array<Record<string, unknown>> {
  return folders
    .filter((f) => f.parent_folder_id === parentId)
    .map((f) => ({
      ...f,
      children: buildTree(folders, f.id as string),
    }));
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (user.role !== "admin" && user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const { name, parentFolderId } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const { data: folder, error } = await supabase
    .from("asset_folders")
    .insert({
      org_id: user.org_id,
      name: name.trim(),
      slug,
      parent_folder_id: parentFolderId || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A folder with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ folder });
}
