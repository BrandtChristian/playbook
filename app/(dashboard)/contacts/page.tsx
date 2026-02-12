export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { ContactsClient } from "@/components/contacts-client";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [{ data: contacts }, { data: customFields }] = await Promise.all([
    supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <ContactsClient
      contacts={contacts ?? []}
      orgId={orgId}
      customFields={customFields ?? []}
    />
  );
}
