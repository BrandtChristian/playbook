"use client";

import type { FlowNode } from "@/lib/flows/types";
import { getNodeMeta, summarizeNode } from "@/lib/flows/types";
import {
  Lightning,
  EnvelopeSimple,
  Clock,
  SignOut,
} from "@phosphor-icons/react";

const ICONS: Record<string, React.ComponentType<{ className?: string; weight?: "regular" | "fill" | "bold" }>> = {
  Lightning,
  EnvelopeSimple,
  Clock,
  SignOut,
};

export function FlowNodeCard({
  node,
  selected,
  onClick,
  emails,
  segments,
}: {
  node: FlowNode;
  selected: boolean;
  onClick: () => void;
  emails: { id: string; name: string }[];
  segments: { id: string; name: string }[];
}) {
  const meta = getNodeMeta(node.type);
  const Icon = ICONS[meta.icon] ?? Lightning;
  const summary = summarizeNode(node, emails, segments);

  return (
    <button
      onClick={onClick}
      className={`w-full max-w-lg text-left flex items-center gap-3 px-4 py-3 bg-white dark:bg-stone-900 border transition-all ${
        selected
          ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-md"
          : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 shadow-sm"
      }`}
    >
      <div
        className={`flex-none w-9 h-9 flex items-center justify-center ${meta.color}`}
      >
        <Icon className={`w-4.5 h-4.5 ${meta.iconColor}`} weight="fill" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
          {meta.label}
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
          {summary}
        </div>
      </div>
    </button>
  );
}
