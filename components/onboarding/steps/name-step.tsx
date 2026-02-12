"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useFlow } from "../flow-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CircleNotch } from "@phosphor-icons/react";

export function NameStep() {
  const ctx = useFlow()!;
  const [name, setName] = useState(ctx.profile.full_name || "");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (name.trim() && name.trim() !== ctx.profile.full_name) {
      setSaving(true);
      await ctx.updateProfile({ full_name: name.trim() });
      setSaving(false);
    }
    ctx.advance();
  }

  const initial = (name || "?")[0]?.toUpperCase() || "?";

  return (
    <div className="flex flex-col items-center text-center py-4">
      <motion.div
        className="flex h-12 w-12 items-center justify-center bg-primary/10 text-primary font-bold text-lg mb-4"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          damping: 15,
          stiffness: 200,
          delay: 0.1,
        }}
        key={initial}
      >
        {initial}
      </motion.div>

      <h2 className="text-xl font-bold tracking-tight">
        What should we call you?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        This appears on your profile and in emails you send.
      </p>

      <div className="mt-6 w-full space-y-4">
        <div className="grid gap-2 text-left">
          <Label htmlFor="welcome-name">Full name</Label>
          <Input
            id="welcome-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Smith"
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
