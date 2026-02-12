"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useFlow } from "../flow-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotch, Briefcase } from "@phosphor-icons/react";

export function JobTitleStep() {
  const ctx = useFlow()!;
  const [jobTitle, setJobTitle] = useState(ctx.profile.job_title || "");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (jobTitle.trim()) {
      setSaving(true);
      await ctx.updateProfile({ job_title: jobTitle.trim() });
      setSaving(false);
    }
    ctx.advance();
  }

  return (
    <div className="flex flex-col items-center text-center py-4">
      <motion.div
        className="flex h-12 w-12 items-center justify-center bg-primary/10 text-primary mb-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring" as const,
          damping: 15,
          stiffness: 200,
          delay: 0.1,
        }}
      >
        <Briefcase className="h-6 w-6" weight="duotone" />
      </motion.div>

      <h2 className="text-xl font-bold tracking-tight">What do you do?</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Your role helps us tailor recommendations.
      </p>

      <div className="mt-6 w-full space-y-4">
        <div className="grid gap-2 text-left">
          <Label htmlFor="welcome-job-title">Job title</Label>
          <Input
            id="welcome-job-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Marketing Manager"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleContinue();
            }}
          />
        </div>

        <Button
          onClick={handleContinue}
          className="w-full"
          size="lg"
          disabled={saving}
        >
          {saving ? (
            <>
              <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>

        <button
          onClick={ctx.advance}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
