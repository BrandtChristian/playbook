import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { UnsubscribePage } from "@/components/unsubscribe-page";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function UnsubscribeRoute({
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

  // Fetch contact, org, and active consent types
  const [{ data: contact }, { data: org }, { data: consentTypes }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("email")
        .eq("id", prefToken.contact_id)
        .single(),
      supabase
        .from("organizations")
        .select("name, brand_config")
        .eq("id", prefToken.org_id)
        .single(),
      supabase
        .from("consent_types")
        .select("id")
        .eq("org_id", prefToken.org_id)
        .eq("is_active", true),
    ]);

  if (!contact || !org) notFound();

  const brandConfig = org.brand_config as {
    primary_color?: string;
    header_bg_color?: string;
  } | null;

  return (
    <UnsubscribePage
      token={token}
      contactEmail={contact.email}
      orgName={org.name}
      brandConfig={brandConfig}
      consentTypeIds={(consentTypes ?? []).map((ct) => ct.id)}
    />
  );
}
