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

export type OnboardingState = Record<string, boolean>;

export type OnboardingStep = {
  key: string;
  label: string;
  description: string;
  href: string;
};

export function OnboardingChecklist({
  state,
  steps,
  orgId,
}: {
  state: OnboardingState;
  steps: OnboardingStep[];
  orgId: string;
}) {
  const router = useRouter();
  const completed = steps.filter((s) => state[s.key]).length;
  const total = steps.length;
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
        {steps.map((step) => {
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
