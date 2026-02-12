"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/dal";
import type { FlowContextValue, FlowStepConfig, ProfileUpdatePayload } from "@/lib/onboarding/types";
import { getNextUnseenFlow, resolveSteps } from "@/lib/onboarding/flows";
import { FlowModal } from "./flow-modal";
import { AnimatePresence } from "motion/react";

const FlowContext = createContext<FlowContextValue | null>(null);
export const useFlow = () => useContext(FlowContext);

export function FlowProvider({
  profile: initialProfile,
}: {
  profile: Profile;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [dismissed, setDismissed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const flow = getNextUnseenFlow(initialProfile);

  // Resolve steps once on mount so completing a field mid-flow doesn't shift indices
  const [resolvedSteps] = useState<FlowStepConfig[]>(() =>
    flow ? resolveSteps(flow, initialProfile) : []
  );

  const showFlow = flow && !dismissed && resolvedSteps.length > 2;

  const markComplete = useCallback(
    async (flowId: string) => {
      setDismissed(true);
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId }),
      });
      setProfile((prev) => ({
        ...prev,
        seen_flows: {
          ...(prev.seen_flows || {}),
          [flowId]: new Date().toISOString(),
        },
      }));
      router.refresh();
    },
    [router]
  );

  const advance = useCallback(() => {
    if (!flow) return;
    if (currentStep < resolvedSteps.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      markComplete(flow.id);
    }
  }, [flow, currentStep, resolvedSteps.length, markComplete]);

  const skip = useCallback(() => {
    if (!flow) return;
    markComplete(flow.id);
  }, [flow, markComplete]);

  const updateProfile = useCallback(
    async (data: ProfileUpdatePayload) => {
      const supabase = createClient();
      await supabase.from("profiles").update(data).eq("id", profile.id);
      setProfile((prev) => ({ ...prev, ...data }));
    },
    [profile.id]
  );

  const contextValue: FlowContextValue | null = flow
    ? {
        currentStep,
        totalSteps: resolvedSteps.length,
        flowId: flow.id,
        advance,
        skip,
        complete: () => markComplete(flow.id),
        updateProfile,
        profile,
        direction,
      }
    : null;

  return (
    <FlowContext.Provider value={contextValue}>
      <AnimatePresence>
        {showFlow && flow && (
          <FlowModal flow={flow} resolvedSteps={resolvedSteps} />
        )}
      </AnimatePresence>
    </FlowContext.Provider>
  );
}
