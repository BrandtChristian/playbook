import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET: List users assigned to a team.
 * POST: Replace user assignments for a team (full replacement).
 */
export async function GET(
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

  const { data: userTeams } = await supabase
    .from("user_teams")
    .select("user_id, profiles(id, full_name, avatar_url, role)")
    .eq("team_id", teamId);

  const users = (userTeams ?? [])
    .map((ut) => (ut as Record<string, unknown>).profiles)
    .filter(Boolean);

  return NextResponse.json({ users });
}

export async function POST(
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

  const { userIds } = await request.json();

  // Full replacement: remove all, then add specified users
  await supabase.from("user_teams").delete().eq("team_id", teamId);

  if (userIds?.length > 0) {
    const links = userIds.map((userId: string) => ({
      user_id: userId,
      team_id: teamId,
    }));
    await supabase.from("user_teams").insert(links);
  }

  return NextResponse.json({ success: true });
}
