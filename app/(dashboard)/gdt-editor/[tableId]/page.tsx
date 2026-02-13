import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { GdtTableDetail } from "@/components/gdt/gdt-table-detail";

export default async function GdtTableDetailPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const user = await getCurrentUser();

  if (
    user.organizations.email_provider !== "agillic" ||
    !user.organizations.agillic_credentials?.staging_key
  ) {
    redirect("/");
  }

  const { tableId } = await params;

  return <GdtTableDetail tableId={decodeURIComponent(tableId)} />;
}
