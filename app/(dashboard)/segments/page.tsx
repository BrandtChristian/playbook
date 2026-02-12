export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { SegmentsClient } from "@/components/segments-client";

export default async function SegmentsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [
    { data: segments },
    { data: contacts },
    { data: customFields },
    { data: dataTables },
  ] = await Promise.all([
    supabase
      .from("segments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .order("email"),
    supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("org_id", orgId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("data_table_definitions")
      .select("*, data_table_columns(*)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <SegmentsClient
      segments={segments ?? []}
      contacts={contacts ?? []}
      orgId={orgId}
      customFields={customFields ?? []}
      dataTables={dataTables ?? []}
    />
  );
}
