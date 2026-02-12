export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { AccountClient } from "@/components/account-client";

export default async function AccountPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal profile and preferences.
        </p>
      </div>
      <AccountClient profile={user} />
    </div>
  );
}
