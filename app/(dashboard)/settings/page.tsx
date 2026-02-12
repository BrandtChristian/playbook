export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings-form";
import { TeamMembers } from "@/components/team-members";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: consentTypes } = await supabase
    .from("consent_types")
    .select("id, name, description, legal_text, is_active, version")
    .eq("org_id", user.organizations.id)
    .order("created_at", { ascending: true });

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, job_title, preferred_test_email, created_at")
    .eq("org_id", user.organizations.id)
    .order("created_at", { ascending: true });

  const { data: segments } = await supabase
    .from("segments")
    .select("id, name, contact_count")
    .eq("org_id", user.organizations.id)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure your organization and email sending.
        </p>
      </div>
      <SettingsForm org={user.organizations} consentTypes={consentTypes ?? []} />
      <TeamMembers
        members={members ?? []}
        currentUserId={user.id}
        currentUserRole={user.role}
        orgId={user.organizations.id}
        hasResendKey={!!user.organizations.resend_api_key}
        segments={segments ?? []}
      />
    </div>
  );
}
