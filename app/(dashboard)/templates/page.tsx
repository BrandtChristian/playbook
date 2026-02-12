export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { TemplatesClient } from "@/components/templates-client";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
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
      orgName={user.organizations.name}
      fromName={user.organizations.from_name || user.organizations.name}
      initialEditId={params.edit}
      existingBrandConfig={
        user.organizations.brand_config &&
        typeof user.organizations.brand_config === "object" &&
        Object.keys(user.organizations.brand_config as object).length > 0
          ? (user.organizations.brand_config as { primary_color?: string; secondary_color?: string; header_bg_color?: string; text_color?: string; logo_url?: string; footer_text?: string })
          : undefined
      }
    />
  );
}
