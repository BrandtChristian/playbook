export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Notebook,
  PaperPlaneTilt,
  Users,
  EnvelopeSimple,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import type { OnboardingState } from "@/components/onboarding-checklist";
import { OnboardingWizard } from "@/components/onboarding-wizard";

const quickActions = [
  {
    title: "Browse Playbooks",
    description: "Get started with proven email strategies",
    href: "/playbooks",
    icon: Notebook,
    badge: "Start here",
  },
  {
    title: "Create Campaign",
    description: "Compose and send an email campaign",
    href: "/campaigns",
    icon: PaperPlaneTilt,
  },
  {
    title: "Import Contacts",
    description: "Add your audience via CSV or manually",
    href: "/contacts",
    icon: Users,
  },
  {
    title: "Edit Templates",
    description: "Customize email templates with Liquid",
    href: "/templates",
    icon: EnvelopeSimple,
  },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  // Compute onboarding state from actual data
  const [
    { count: contactCount },
    { count: segmentCount },
    { count: campaignCount },
    { count: sentCount },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
    supabase.from("segments").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id).eq("status", "sent"),
  ]);

  const onboardingState: OnboardingState = {
    resend_connected: !!user.organizations.resend_api_key,
    contacts_imported: (contactCount ?? 0) > 0,
    segment_created: (segmentCount ?? 0) > 0,
    brand_built: !!(
      user.organizations.brand_config &&
      typeof user.organizations.brand_config === "object" &&
      Object.keys(user.organizations.brand_config).length > 0
    ),
    playbook_launched: (campaignCount ?? 0) > 0,
    campaign_sent: (sentCount ?? 0) > 0,
  };

  const showWizard =
    !user.organizations.onboarding_completed &&
    !user.organizations.resend_api_key;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {user.organizations.name} &mdash; Let&apos;s get your campaigns running.
        </p>
      </div>

      {/* Onboarding wizard for brand new users */}
      {showWizard && (
        <OnboardingWizard
          orgId={user.organizations.id}
          orgName={user.organizations.name}
          open={true}
        />
      )}

      {/* Persistent checklist */}
      {!user.organizations.onboarding_completed && (
        <OnboardingChecklist
          state={onboardingState}
          orgId={user.organizations.id}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <action.icon className="h-8 w-8 text-primary" weight="duotone" />
                  {action.badge && (
                    <Badge variant="secondary">{action.badge}</Badge>
                  )}
                </div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {action.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{action.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
