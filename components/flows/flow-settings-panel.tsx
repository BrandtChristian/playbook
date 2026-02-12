"use client";

import type { Flow } from "@/lib/flows/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Circle, CircleNotch } from "@phosphor-icons/react";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", variant: "outline" as const },
  { value: "active", label: "Active", variant: "default" as const },
  { value: "paused", label: "Paused", variant: "secondary" as const },
];

export function FlowSettingsPanel({
  flow,
  onNameChange,
  onStatusChange,
  onBack,
  saving,
}: {
  flow: Flow;
  onNameChange: (name: string) => void;
  onStatusChange: (status: Flow["status"]) => void;
  onBack: () => void;
  saving: boolean;
}) {
  const currentStatus = STATUS_OPTIONS.find((s) => s.value === flow.status) ?? STATUS_OPTIONS[0];

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onBack}
      >
        <ArrowLeft className="w-4 h-4" />
      </Button>

      <Input
        value={flow.name}
        onChange={(e) => onNameChange(e.target.value)}
        className="h-7 text-sm font-medium border-none shadow-none bg-transparent px-1 focus-visible:ring-1 max-w-xs"
      />

      <div className="flex items-center gap-1.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onStatusChange(opt.value as Flow["status"])}
            className={`px-2.5 py-0.5 text-[11px] font-medium border transition-colors ${
              flow.status === opt.value
                ? opt.value === "active"
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : opt.value === "paused"
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-300 dark:border-stone-600"
                : "bg-transparent text-stone-400 dark:text-stone-500 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
        {saving ? (
          <>
            <CircleNotch className="w-3 h-3 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" weight="fill" />
            Saved
          </>
        )}
      </div>
    </div>
  );
}
