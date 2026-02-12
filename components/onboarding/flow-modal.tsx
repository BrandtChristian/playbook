"use client";

import { motion, AnimatePresence } from "motion/react";
import type { FlowDefinition, FlowStepConfig } from "@/lib/onboarding/types";
import { useFlow } from "./flow-provider";
import { WelcomeStep } from "./steps/welcome-step";
import { NameStep } from "./steps/name-step";
import { JobTitleStep } from "./steps/job-title-step";
import { TestEmailStep } from "./steps/test-email-step";
import { ReadyStep } from "./steps/ready-step";
import { X } from "@phosphor-icons/react";

const STEP_COMPONENTS: Record<string, React.ComponentType> = {
  welcome: WelcomeStep,
  name: NameStep,
  "job-title": JobTitleStep,
  "test-email": TestEmailStep,
  ready: ReadyStep,
};

export function FlowModal({
  flow,
  resolvedSteps,
}: {
  flow: FlowDefinition;
  resolvedSteps: FlowStepConfig[];
}) {
  const ctx = useFlow();
  if (!ctx) return null;

  const stepConfig = resolvedSteps[ctx.currentStep];
  const StepComponent = STEP_COMPONENTS[stepConfig.component];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Modal card */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-4 bg-background border border-border p-8 shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        {/* Skip button */}
        <button
          onClick={ctx.skip}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-20"
        >
          <X className="h-5 w-5" weight="bold" />
          <span className="sr-only">Skip</span>
        </button>

        {/* Progress dots */}
        <div className="flex gap-1.5 mb-6 justify-center">
          {resolvedSteps.map((_, i) => (
            <motion.div
              key={i}
              className={`h-1.5 transition-colors ${
                i === ctx.currentStep
                  ? "bg-primary w-6"
                  : i < ctx.currentStep
                    ? "bg-primary/40 w-1.5"
                    : "bg-muted w-1.5"
              }`}
              layout
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            />
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepConfig.id}
            initial={{ opacity: 0, x: ctx.direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: ctx.direction * -40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {StepComponent && <StepComponent />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
