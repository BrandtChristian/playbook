import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PreferenceCenter } from "@/components/preference-center";
import { redirect } from "next/navigation";

export default async function PreferencePreviewPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login");
  }

  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [{ data: org }, { data: consentTypes }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, brand_config")
      .eq("id", orgId)
      .single(),
    supabase
      .from("consent_types")
      .select("id, name, description, legal_text, version")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  if (!org) redirect("/settings");

  return (
    <PreferenceCenter
      token="preview"
      contactEmail="contact@example.com"
      orgName={org.name}
      brandConfig={
        org.brand_config as {
          primary_color?: string;
          header_bg_color?: string;
        } | null
      }
      consentTypes={consentTypes ?? []}
      currentConsents={[]}
      readOnly
    />
  );
}
