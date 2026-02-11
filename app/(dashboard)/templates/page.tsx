export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { TemplatesClient } from "@/components/templates-client";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <TemplatesClient
      templates={templates ?? []}
      orgId={user.organizations.id}
      fromName={user.organizations.from_name || user.organizations.name}
    />
  );
}
