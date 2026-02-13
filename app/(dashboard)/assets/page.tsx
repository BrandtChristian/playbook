import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/dal";
import { AssetsClient } from "@/components/assets-client";

export default async function AssetsPage() {
  const user = await requireAdmin();

  if (user.organizations.email_provider !== "agillic") {
    redirect("/");
  }

  return <AssetsClient />;
}
