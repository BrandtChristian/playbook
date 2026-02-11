export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: consentTypes } = await supabase
    .from("consent_types")
    .select("id, name, description, legal_text, is_active")
    .eq("org_id", user.organizations.id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your organization and email sending.
        </p>
      </div>
      <SettingsForm org={user.organizations} consentTypes={consentTypes ?? []} />
    </div>
  );
}
