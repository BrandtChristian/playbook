"use client";

import { motion } from "motion/react";
import { useFlow } from "../flow-provider";
import { Button } from "@/components/ui/button";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 20, stiffness: 200 },
  },
};

export function WelcomeStep() {
  const ctx = useFlow()!;

  return (
    <motion.div
      className="flex flex-col items-center text-center py-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Forge logo */}
      <motion.div
        className="relative flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground font-bold text-2xl mb-6"
        variants={item}
      >
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            damping: 12,
            stiffness: 200,
            delay: 0.5,
          }}
        >
          F
        </motion.span>
        {/* Glow ring */}
        <motion.div
          className="absolute inset-0 bg-primary/20"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.4, 1.4], opacity: [0.6, 0, 0] }}
          transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
        />
      </motion.div>

      <motion.h1
        className="text-2xl font-bold tracking-tight"
        variants={item}
      >
        Welcome to Forge
      </motion.h1>

      <motion.p
        className="text-muted-foreground mt-2 text-sm max-w-xs"
        variants={item}
      >
        Your AI-powered marketing automation platform. Let&apos;s get you set up
        in seconds.
      </motion.p>

      <motion.div variants={item} className="mt-8 w-full">
        <Button onClick={ctx.advance} className="w-full" size="lg">
          Get started
        </Button>
      </motion.div>
    </motion.div>
  );
}
