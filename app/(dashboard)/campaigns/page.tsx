export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { CampaignsClient } from "@/components/campaigns-client";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", user.organizations.id)
    .order("created_at", { ascending: false });

  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, subject, body_html")
    .or(`org_id.eq.${user.organizations.id},is_system.eq.true`);

  const { data: segments } = await supabase
    .from("segments")
    .select("id, name, contact_count")
    .eq("org_id", user.organizations.id)
    .order("name");

  return (
    <CampaignsClient
      campaigns={campaigns ?? []}
      templates={templates ?? []}
      segments={segments ?? []}
      orgId={user.organizations.id}
      fromName={user.organizations.from_name || user.organizations.name}
      fromEmail={user.organizations.from_email}
      userEmail={user.organizations.from_email || ""}
    />
  );
}
