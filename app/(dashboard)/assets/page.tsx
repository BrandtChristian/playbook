import { requireAdmin } from "@/lib/auth/dal";
import { AssetsClient } from "@/components/assets-client";

export default async function AssetsPage() {
  await requireAdmin();

  return <AssetsClient />;
}
