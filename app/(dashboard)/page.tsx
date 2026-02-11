export const dynamic = "force-dynamic";

import { getCurrentUser } from "@/lib/auth/dal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Notebook,
  PaperPlaneTilt,
  Users,
  EnvelopeSimple,
  ArrowRight,
} from "@phosphor-icons/react/dist/ssr";

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
    href: "/campaigns/new",
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

      {!user.organizations.resend_api_key && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Complete your setup</CardTitle>
            <CardDescription>
              Add your Resend API key in{" "}
              <Link href="/settings" className="text-primary underline underline-offset-4">
                Settings
              </Link>{" "}
              to start sending emails.
            </CardDescription>
          </CardHeader>
        </Card>
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
