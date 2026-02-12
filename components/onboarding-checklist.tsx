"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  ArrowRight,
  X,
} from "@phosphor-icons/react";

export type OnboardingState = {
  resend_connected: boolean;
  contacts_imported: boolean;
  segment_created: boolean;
  brand_built: boolean;
  playbook_launched: boolean;
  campaign_sent: boolean;
};

const STEPS = [
  { key: "resend_connected", label: "Connect Resend", description: "Link your sending infrastructure so Forge can deliver emails.", href: "/settings" },
  { key: "contacts_imported", label: "Import contacts", description: "Add the people you want to reach \u2014 manually or via CSV.", href: "/contacts" },
  { key: "segment_created", label: "Create a segment", description: "Group contacts for targeted campaigns.", href: "/segments" },
  { key: "brand_built", label: "Build brand template", description: "Set your colors, logo, and footer for consistent emails.", href: "/templates" },
  { key: "playbook_launched", label: "Build a flow", description: "Create an automated email journey \u2014 start from a template or from scratch.", href: "/flows" },
  { key: "campaign_sent", label: "Send first campaign", description: "Hit send and watch the stats roll in.", href: "/campaigns" },
] as const;

export function OnboardingChecklist({
  state,
  orgId,
}: {
  state: OnboardingState;
  orgId: string;
}) {
  const router = useRouter();
  const completed = STEPS.filter((s) => state[s.key]).length;
  const total = STEPS.length;
  const allDone = completed === total;
  const progress = Math.round((completed / total) * 100);

  async function handleDismiss() {
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", orgId);
    router.refresh();
  }

  if (allDone) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Setup Progress ({completed}/{total})
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-1">
        {STEPS.map((step) => {
          const done = state[step.key];
          return (
            <Link
              key={step.key}
              href={step.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
            >
              {done ? (
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" weight="fill" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className={done ? "text-muted-foreground line-through" : "font-medium"}>
                  {step.label}
                </span>
                {!done && (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                )}
              </div>
              {!done && (
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
