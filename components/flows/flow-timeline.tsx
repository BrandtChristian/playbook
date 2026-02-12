"use client";

import { useState } from "react";
import type { FlowNode } from "@/lib/flows/types";
import { NODE_PALETTE } from "@/lib/flows/types";
import { FlowNodeCard } from "./flow-node-card";
import { Plus } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";

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

  return (
    <div
      className="flex flex-col items-center py-8 px-4 min-h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectNode(null);
      }}
    >
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
