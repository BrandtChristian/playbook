export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { SegmentsClient } from "@/components/segments-client";

export default async function SegmentsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: segments } = await supabase
    .from("segments")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, email, first_name, last_name")
    .order("email");

  return (
    <SegmentsClient
      segments={segments ?? []}
      contacts={contacts ?? []}
      orgId={user.organizations.id}
    />
  );
}
