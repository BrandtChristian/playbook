"use client";

import { useState } from "react";
import type { FlowNode } from "@/lib/flows/types";
import { NODE_PALETTE } from "@/lib/flows/types";
import { FlowNodeCard } from "./flow-node-card";
import { Plus, CheckCircle, Circle, X } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";

type SetupItem = {
  nodeId: string;
  label: string;
  done: boolean;
};

function getSetupItems(
  nodes: FlowNode[],
  emails: { id: string; name: string }[],
): SetupItem[] {
  const items: SetupItem[] = [];

  for (const node of nodes) {
    const cfg = node.config as Record<string, unknown>;

    if (node.type === "trigger" && cfg.segment_hint) {
      items.push({
        nodeId: node.id,
        label: `Set trigger segment`,
        done: !!cfg.segment_id,
      });
    }

    if (node.type === "send_email" && cfg.hint) {
      const emailId = cfg.email_id as string | null;
      const email = emailId ? emails.find((e) => e.id === emailId) : null;
      // Extract just the title part (before the dash)
      const hintTitle = (cfg.hint as string).split(" — ")[0];
      items.push({
        nodeId: node.id,
        label: email ? `"${email.name}"` : `Configure "${hintTitle}" email`,
        done: !!emailId,
      });
    }
  }

  return items;
}

export function FlowTimeline({
  nodes,
  selectedNodeId,
  onSelectNode,
  onInsertNode,
  emails,
  segments,
}: {
  nodes: FlowNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onInsertNode: (afterPosition: number, type: string) => void;
  emails: { id: string; name: string }[];
  segments: { id: string; name: string }[];
}) {
  const sorted = [...nodes].sort((a, b) => a.position - b.position);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Compute setup items for template-derived flows
  const setupItems = getSetupItems(sorted, emails);
  const hasSetupItems = setupItems.length > 0;
  const allDone = setupItems.every((item) => item.done);
  const showBanner = hasSetupItems && !allDone && !bannerDismissed;

  return (
    <div
      className="flex flex-col items-center py-8 px-4 min-h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectNode(null);
      }}
    >
      {/* Setup checklist banner for template-derived flows */}
      {showBanner && (
        <div className="w-full max-w-lg mb-6">
          <div className="bg-white dark:bg-stone-900 border border-indigo-200 dark:border-indigo-800/50 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Suggested setup
                </h3>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                  A starting point — add, remove, or rearrange steps freely.
                </p>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid gap-1">
              {setupItems.map((item) => (
                <button
                  key={item.nodeId}
                  onClick={() => onSelectNode(item.nodeId)}
                  className={`flex items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-800 -mx-1 ${
                    item.done ? "opacity-60" : ""
                  }`}
                >
                  {item.done ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" weight="fill" />
                  ) : (
                    <Circle className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" />
                  )}
                  <span
                    className={`text-xs ${
                      item.done
                        ? "text-stone-400 dark:text-stone-500 line-through"
                        : "text-stone-700 dark:text-stone-300"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {sorted.map((node, i) => (
          <motion.div
            key={node.id}
            layout
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center w-full max-w-lg"
          >
            <FlowNodeCard
              node={node}
              selected={selectedNodeId === node.id}
              onClick={() => onSelectNode(node.id)}
              emails={emails}
              segments={segments}
            />
            {/* Connector + insert button between nodes (not after last) */}
            {i < sorted.length - 1 && (
              <InsertButton
                afterPosition={node.position}
                onInsert={onInsertNode}
              />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {sorted.length === 0 && (
        <div className="text-center text-stone-400 dark:text-stone-500 py-20">
          <p className="text-sm">This flow has no steps yet.</p>
        </div>
      )}
    </div>
  );
}

function InsertButton({
  afterPosition,
  onInsert,
}: {
  afterPosition: number;
  onInsert: (afterPosition: number, type: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex flex-col items-center">
      {/* Vertical connector line */}
      <div className="w-px h-4 bg-stone-300 dark:bg-stone-600" />

      {/* Plus button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-7 h-7 flex items-center justify-center border transition-all ${
          open
            ? "bg-indigo-500 border-indigo-500 text-white"
            : "bg-white dark:bg-stone-800 border-stone-300 dark:border-stone-600 text-stone-400 dark:text-stone-500 hover:border-indigo-400 hover:text-indigo-500"
        }`}
      >
        <Plus className="w-3.5 h-3.5" weight="bold" />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 z-10 w-48 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-lg py-1"
          >
            {NODE_PALETTE.map((item) => (
              <button
                key={item.type}
                onClick={() => {
                  onInsert(afterPosition, item.type);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-stone-50 dark:hover:bg-stone-700/50 transition-colors"
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center ${item.color}`}
                >
                  <div className={`w-2 h-2 rounded-full ${item.iconColor.replace("text-", "bg-")}`} />
                </div>
                <div>
                  <div className="text-xs font-medium text-stone-900 dark:text-stone-100">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom connector line */}
      <div className="w-px h-4 bg-stone-300 dark:bg-stone-600" />
    </div>
  );
}
