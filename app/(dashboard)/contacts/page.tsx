export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { ContactsClient } from "@/components/contacts-client";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <ContactsClient
      contacts={contacts ?? []}
      orgId={user.organizations.id}
    />
  );
}
