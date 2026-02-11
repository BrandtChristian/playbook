export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { PlaybooksClient } from "@/components/playbooks-client";

export default async function PlaybooksPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: playbooks } = await supabase
    .from("playbooks")
    .select("*")
    .order("name");

  const { data: segments } = await supabase
    .from("segments")
    .select("id, name, contact_count")
    .eq("org_id", user.organizations.id)
    .order("name");

  return (
    <PlaybooksClient
      playbooks={playbooks ?? []}
      segments={segments ?? []}
      orgId={user.organizations.id}
      fromName={user.organizations.from_name || user.organizations.name}
    />
  );
}
