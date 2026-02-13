import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET: List all teams with their target groups and user counts.
 * POST: Create a new team with target group assignments.
 * Requires admin/owner role.
 */
export async function GET() {
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

  // Fetch teams with target group relationships
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, description, is_active, created_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true });

  if (!teams) return NextResponse.json({ teams: [] });

  // Enrich with target groups and user counts
  const enriched = await Promise.all(
    teams.map(async (team) => {
      const [{ data: tgLinks }, { data: userLinks }] = await Promise.all([
        supabase
          .from("team_target_groups")
          .select("target_group_id, agillic_target_groups(id, name, description, is_active)")
          .eq("team_id", team.id),
        supabase
          .from("user_teams")
          .select("user_id")
          .eq("team_id", team.id),
      ]);

      return {
        ...team,
        target_groups: (tgLinks ?? []).map((link) => (link as Record<string, unknown>).agillic_target_groups).filter(Boolean),
        user_count: userLinks?.length ?? 0,
      };
    })
  );

  return NextResponse.json({ teams: enriched });
}

export async function POST(request: NextRequest) {
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

  if (!name?.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  // Create team
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      org_id: profile.org_id,
      name: name.trim(),
      description: description?.trim() || null,
      is_active: isActive ?? true,
    })
    .select()
    .single();

  if (teamError || !team) {
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  // Assign target groups
  if (targetGroupIds?.length > 0) {
    const links = targetGroupIds.map((tgId: string) => ({
      team_id: team.id,
      target_group_id: tgId,
    }));
    await supabase.from("team_target_groups").insert(links);
  }

  return NextResponse.json({ team }, { status: 201 });
}
