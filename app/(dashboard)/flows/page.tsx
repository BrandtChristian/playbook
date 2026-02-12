import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { FlowsClient } from "@/components/flows/flows-client";

export default async function FlowsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [{ data: flows }, { data: emails }, { data: templates }, { data: segments }, { data: playbooks }] =
    await Promise.all([
      supabase
        .from("flows")
        .select("*, flow_nodes(*)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("emails")
        .select("id, name, subject, body_html")
        .eq("org_id", orgId)
        .order("name"),
      supabase
        .from("templates")
        .select("id, name, subject, body_html, is_system")
        .or(`org_id.eq.${orgId},is_system.eq.true`)
        .order("name"),
      supabase
        .from("segments")
        .select("id, name, contact_count")
        .eq("org_id", orgId)
        .order("name"),
      supabase
        .from("playbooks")
        .select("id, name, description, category, icon, steps")
        .order("name"),
    ]);

  return (
    <FlowsClient
      flows={flows ?? []}
      emails={emails ?? []}
      templates={templates ?? []}
      segments={segments ?? []}
      playbooks={playbooks ?? []}
      orgId={orgId}
      fromName={user.organizations.from_name ?? user.organizations.name}
    />
  );
}
