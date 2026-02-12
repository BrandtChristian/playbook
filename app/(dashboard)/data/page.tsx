export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DataClient } from "./data-client";

export default async function DataPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const orgId = user.organizations.id;

  const [
    { data: customFields },
    { data: tableDefs },
    { data: contacts },
  ] = await Promise.all([
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
    supabase
      .from("contacts")
      .select("id, email, first_name, last_name")
      .eq("org_id", orgId)
      .order("email"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data</h1>
        <p className="text-muted-foreground mt-1">
          Manage custom fields, relation tables, and global data.
        </p>
      </div>
      <DataClient
        customFields={customFields ?? []}
        tableDefs={tableDefs ?? []}
        contacts={contacts ?? []}
        orgId={orgId}
      />
    </div>
  );
}
