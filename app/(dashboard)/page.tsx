export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  TreeStructure,
  PaperPlaneTilt,
  Users,
  EnvelopeSimple,
  ImageSquare,
  Table,
  Gear,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import type { OnboardingState, OnboardingStep } from "@/components/onboarding-checklist";
import { OnboardingWizard } from "@/components/onboarding-wizard";

const resendQuickActions = [
  {
    title: "Build a Flow",
    description: "Create automated email journeys",
    href: "/flows",
    icon: TreeStructure,
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

const agillicQuickActions = [
  {
    title: "New Email",
    description: "Create an email from a synced template",
    href: "/emails",
    icon: EnvelopeSimple,
  },
  {
    title: "Manage Assets",
    description: "Upload and organize media files",
    href: "/assets",
    icon: ImageSquare,
  },
  {
    title: "GDT Editor",
    description: "View and edit Global Data Tables",
    href: "/gdt-editor",
    icon: Table,
  },
  {
    title: "Settings",
    description: "Manage credentials and sync config",
    href: "/settings",
    icon: Gear,
  },
];

const resendSteps: OnboardingStep[] = [
  { key: "resend_connected", label: "Connect Resend", description: "Link your sending infrastructure so Forge can deliver emails.", href: "/settings" },
  { key: "contacts_imported", label: "Import contacts", description: "Add the people you want to reach \u2014 manually or via CSV.", href: "/contacts" },
  { key: "segment_created", label: "Create a segment", description: "Group contacts for targeted campaigns.", href: "/segments" },
  { key: "brand_built", label: "Build brand template", description: "Set your colors, logo, and footer for consistent emails.", href: "/templates" },
  { key: "playbook_launched", label: "Build a flow", description: "Create an automated email journey \u2014 start from a template or from scratch.", href: "/flows" },
  { key: "campaign_sent", label: "Send first campaign", description: "Hit send and watch the stats roll in.", href: "/campaigns" },
];

const agillicSteps: OnboardingStep[] = [
  { key: "agillic_connected", label: "Connect Agillic", description: "Add your staging and production credentials.", href: "/settings" },
  { key: "templates_synced", label: "Sync templates", description: "Import email templates from your Agillic instance.", href: "/settings" },
  { key: "target_groups_synced", label: "Sync target groups", description: "Pull target groups from Agillic for audience targeting.", href: "/settings" },
  { key: "email_created", label: "Create first email", description: "Build an email from a synced template.", href: "/emails" },
];

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const isAgillic = user.organizations.email_provider === "agillic";

  let onboardingState: OnboardingState;
  let steps: OnboardingStep[];

  if (isAgillic) {
    const creds = user.organizations.agillic_credentials as Record<string, string> | null;
    const [
      { count: templateCacheCount },
      { count: targetGroupCount },
      { count: emailCount },
    ] = await Promise.all([
      supabase.from("agillic_template_cache").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
      supabase.from("agillic_target_groups").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
      supabase.from("emails").select("*", { count: "exact", head: true }).eq("org_id", user.organizations.id),
    ]);

    onboardingState = {
      agillic_connected: !!(creds?.staging_key && creds?.prod_key),
      templates_synced: (templateCacheCount ?? 0) > 0,
      target_groups_synced: (targetGroupCount ?? 0) > 0,
      email_created: (emailCount ?? 0) > 0,
    };
    steps = agillicSteps;
  } else {
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

    onboardingState = {
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
    steps = resendSteps;
  }

  const showWizard =
    !user.organizations.onboarding_completed &&
    !user.organizations.resend_api_key &&
    !isAgillic;

  return (
    <div className="space-y-8">
      {!user.organizations.onboarding_completed ? (
        <>
          {/* First-visit hero */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  F
                </div>
                <div>
                  <CardTitle className="text-2xl">
                    Welcome to Forge, {user.full_name?.split(" ")[0] || "there"}
                  </CardTitle>
                  <CardDescription className="text-base">
                    Let&apos;s get {user.organizations.name} {isAgillic ? "creating" : "sending"} emails in minutes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isAgillic
                  ? "Connect your Agillic instance, sync your templates, and create your first email."
                  : "Follow the steps below to connect your sending infrastructure, import your contacts, and launch your first automated flow."}
              </p>
            </CardContent>
          </Card>

          {/* Onboarding wizard for brand new users */}
          {showWizard && (
            <OnboardingWizard
              orgId={user.organizations.id}
              orgName={user.organizations.name}
              open={true}
            />
          )}

          {/* Persistent checklist */}
          <OnboardingChecklist
            state={onboardingState}
            steps={steps}
            orgId={user.organizations.id}
          />
        </>
      ) : (
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user.full_name?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user.organizations.name} &mdash; {isAgillic ? "Here's your email workspace." : "Here's your campaign overview."}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(isAgillic ? agillicQuickActions : resendQuickActions).map((action) => (
          <Link key={action.href} href={action.href}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardHeader>
                <action.icon className="h-8 w-8 text-primary" weight="duotone" />
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
