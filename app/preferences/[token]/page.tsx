import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { PreferenceCenter } from "@/components/preference-center";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function PreferencePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = getServiceClient();

  // Look up token
  const { data: prefToken } = await supabase
    .from("preference_tokens")
    .select("contact_id, org_id, expires_at")
    .eq("token", token)
    .single();

  if (!prefToken) notFound();
  if (new Date(prefToken.expires_at) < new Date()) notFound();

  // Fetch contact, org, consent types, and current consents in parallel
  const [
    { data: contact },
    { data: org },
    { data: consentTypes },
    { data: currentConsents },
  ] = await Promise.all([
    supabase.from("contacts").select("email").eq("id", prefToken.contact_id).single(),
    supabase.from("organizations").select("name, brand_config").eq("id", prefToken.org_id).single(),
    supabase.from("consent_types").select("id, name, description").eq("org_id", prefToken.org_id).eq("is_active", true),
    supabase.from("contact_consents").select("consent_type_id, granted").eq("contact_id", prefToken.contact_id),
  ]);

  if (!contact || !org) notFound();

  return (
    <PreferenceCenter
      token={token}
      contactEmail={contact.email}
      orgName={org.name}
      brandConfig={org.brand_config as { primary_color?: string; header_bg_color?: string } | null}
      consentTypes={consentTypes ?? []}
      currentConsents={currentConsents ?? []}
    />
  );
}
