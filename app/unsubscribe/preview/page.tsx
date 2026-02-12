import { getCurrentUser } from "@/lib/auth/dal";
import { redirect } from "next/navigation";
import { UnsubscribePage } from "@/components/unsubscribe-page";

export default async function UnsubscribePreviewPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    redirect("/login");
  }

  const brandConfig = user.organizations.brand_config as {
    primary_color?: string;
    header_bg_color?: string;
  } | null;

  return (
    <UnsubscribePage
      token="preview"
      contactEmail="contact@example.com"
      orgName={user.organizations.name}
      brandConfig={brandConfig}
      consentTypeIds={[]}
      readOnly
    />
  );
}
