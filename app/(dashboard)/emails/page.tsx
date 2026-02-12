import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmailsClient } from "@/components/emails-client";

export default async function EmailsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [{ data: emails }, { data: templates }] = await Promise.all([
    supabase
      .from("emails")
      .select("*, templates(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("templates")
      .select("id, name, subject, body_html, category, is_system")
      .or(`org_id.eq.${orgId},is_system.eq.true`)
      .order("name"),
  ]);

  return (
    <EmailsClient
      emails={emails ?? []}
      templates={templates ?? []}
      orgId={orgId}
      fromName={user.organizations.from_name ?? user.organizations.name}
    />
  );
}
