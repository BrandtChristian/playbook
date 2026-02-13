import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PUT: Update team details + target group assignments.
 * DELETE: Delete a team and all its relationships.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { name, description, targetGroupIds, isActive } = await request.json();

  // Update team
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (isActive !== undefined) updates.is_active = isActive;

  if (Object.keys(updates).length > 0) {
    await supabase.from("teams").update(updates).eq("id", teamId);
  }

  // Replace target group assignments if provided
  if (targetGroupIds !== undefined) {
    await supabase.from("team_target_groups").delete().eq("team_id", teamId);
    if (targetGroupIds.length > 0) {
      const links = targetGroupIds.map((tgId: string) => ({
        team_id: teamId,
        target_group_id: tgId,
      }));
      await supabase.from("team_target_groups").insert(links);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Delete cascade: user_teams -> team_target_groups -> teams
  await supabase.from("user_teams").delete().eq("team_id", teamId);
  await supabase.from("team_target_groups").delete().eq("team_id", teamId);
  await supabase.from("teams").delete().eq("id", teamId);

  return NextResponse.json({ success: true });
}
