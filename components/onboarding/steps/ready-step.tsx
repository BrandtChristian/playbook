"use client";

import { motion } from "motion/react";
import { useFlow } from "../flow-provider";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "@phosphor-icons/react";

export function ReadyStep() {
  const ctx = useFlow()!;
  const firstName = ctx.profile.full_name?.split(" ")[0] || "there";

  return (
    <div className="flex flex-col items-center text-center py-4">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          damping: 12,
          stiffness: 200,
          delay: 0.1,
        }}
      >
        <CheckCircle className="h-16 w-16 text-primary" weight="fill" />
      </motion.div>

      <motion.h2
        className="text-xl font-bold tracking-tight mt-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        You&apos;re all set, {firstName}!
      </motion.h2>

      <motion.p
        className="text-muted-foreground mt-2 text-sm max-w-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        Explore playbooks to launch your first campaign with AI-generated
        content, or dive straight in.
      </motion.p>

      <motion.div
        className="mt-8 w-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Button onClick={ctx.complete} className="w-full" size="lg">
          Explore Forge
        </Button>
      </motion.div>
    </div>
  );
}
