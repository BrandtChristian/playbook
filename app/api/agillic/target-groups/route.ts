import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Fetch target groups for the current user.
 * Reads from local agillic_target_groups table (synced from Agillic Discovery API).
 *
 * Access control:
 * - Owner/Admin: see all active target groups in the org
 * - Member: see only target groups from their assigned teams
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
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("email_provider")
    .eq("id", profile.org_id)
    .single();

  if (!org || org.email_provider !== "agillic") {
    return NextResponse.json(
      { error: "Not an Agillic organization" },
      { status: 400 }
    );
  }

  // Admin/Owner: return all active target groups
  if (profile.role === "admin" || profile.role === "owner") {
    const { data: targetGroups } = await supabase
      .from("agillic_target_groups")
      .select("id, name, description, is_static, is_active, synced_at")
      .eq("org_id", profile.org_id)
      .eq("is_active", true)
      .order("name");

    return NextResponse.json({ targetGroups: targetGroups ?? [] });
  }

  // Member: return only target groups from their assigned teams
  const { data: userTeams } = await supabase
    .from("user_teams")
    .select("team_id")
    .eq("user_id", user.id);

  if (!userTeams || userTeams.length === 0) {
    return NextResponse.json({ targetGroups: [] });
  }

  const teamIds = userTeams.map((ut) => ut.team_id);

  const { data: teamTgLinks } = await supabase
    .from("team_target_groups")
    .select("target_group_id")
    .in("team_id", teamIds);

  if (!teamTgLinks || teamTgLinks.length === 0) {
    return NextResponse.json({ targetGroups: [] });
  }

  // Deduplicate target group IDs (user may be in multiple teams with overlapping target groups)
  const tgIds = [...new Set(teamTgLinks.map((link) => link.target_group_id))];

  const { data: targetGroups } = await supabase
    .from("agillic_target_groups")
    .select("id, name, description, is_static, is_active, synced_at")
    .in("id", tgIds)
    .eq("is_active", true)
    .order("name");

  return NextResponse.json({ targetGroups: targetGroups ?? [] });
}
