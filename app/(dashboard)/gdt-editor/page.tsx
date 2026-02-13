import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { GdtTableList } from "@/components/gdt/gdt-table-list";

export default async function GdtEditorPage() {
  const user = await getCurrentUser();

  if (
    user.organizations.email_provider !== "agillic" ||
    !user.organizations.agillic_credentials?.staging_key
  ) {
    redirect("/");
  }

  return <GdtTableList />;
}
