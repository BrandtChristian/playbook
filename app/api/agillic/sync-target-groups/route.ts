import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createProductionClient } from "@/lib/agillic/client";
import { DiscoveryAPIClient } from "@/lib/agillic/discovery-api";

/**
 * Sync target groups from Agillic Discovery API into local table.
 * Uses PRODUCTION credentials (target groups are discovered from production).
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("email_provider, agillic_credentials")
    .eq("id", profile.org_id)
    .single();

  if (!org || org.email_provider !== "agillic" || !org.agillic_credentials) {
    return NextResponse.json(
      { error: "Agillic not configured" },
      { status: 400 }
    );
  }

  const creds = org.agillic_credentials as {
    staging_key: string;
    staging_secret: string;
    prod_key: string;
    prod_secret: string;
    instance_url: string;
  };

  if (!creds.prod_key || !creds.prod_secret) {
    return NextResponse.json(
      { error: "Production credentials required for target group sync" },
      { status: 400 }
    );
  }

  try {
    // Use production credentials for discovery
    const client = createProductionClient(creds);
    const discovery = new DiscoveryAPIClient(client);
    const agillicGroups = await discovery.listTargetGroups();

    const now = new Date().toISOString();

    // Upsert all discovered target groups
    for (const group of agillicGroups) {
      await supabase
        .from("agillic_target_groups")
        .upsert(
          {
            org_id: profile.org_id,
            name: group.name,
            description: group.description || null,
            is_static: group.static,
            synced_at: now,
          },
          { onConflict: "org_id,name" }
        );
    }

    // Deactivate target groups that no longer exist in Agillic
    const agillicNames = agillicGroups.map((g) => g.name);
    const { data: localGroups } = await supabase
      .from("agillic_target_groups")
      .select("id, name")
      .eq("org_id", profile.org_id);

    if (localGroups) {
      const staleGroups = localGroups.filter((lg) => !agillicNames.includes(lg.name));
      for (const stale of staleGroups) {
        await supabase
          .from("agillic_target_groups")
          .update({ is_active: false })
          .eq("id", stale.id);
      }
    }

    return NextResponse.json({
      synced: agillicGroups.length,
      message: `Synced ${agillicGroups.length} target groups from Agillic`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
