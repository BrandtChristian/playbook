"use client";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import { DotsSixVertical, StackSimple } from "@phosphor-icons/react";
import type { EmailBlock } from "@/lib/email/blocks";
import { BlockRenderer } from "./block-renderer";
import { BlockProperties } from "./block-properties";

const TYPE_LABELS: Record<string, string> = {
  heading: "H",
  text: "TEXT",
  button: "BTN",
  image: "IMG",
  divider: "DIV",
  spacer: "GAP",
  social: "SOCIAL",
  columns: "2-COL",
  quote: "QUOTE",
  video: "VIDEO",
  html: "HTML",
};

function DropIndicatorLine() {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.3 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="h-0.5 bg-indigo-500 relative origin-left"
    >
      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-indigo-500" />
    </motion.div>
  );
}

// Invisible gap between blocks — becomes a visible drop target while dragging
function DropGap({ id, isDragging, isOver }: { id: string; isDragging: boolean; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${isDragging ? "min-h-[20px] -my-1" : "min-h-[2px]"}`}
    >
      <AnimatePresence>
        {isOver && <DropIndicatorLine />}
      </AnimatePresence>
    </div>
  );
}

function SortableBlock({
  block,
  selected,
  onSelect,
  onDeselect,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  block: EmailBlock;
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onUpdate: (updated: EmailBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
      className={`group relative ${isDragging ? "z-50" : ""}`}
    >
      {/* Dragging placeholder */}
      {isDragging ? (
        <div className="border-2 border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 px-3 py-2 min-h-[40px]" />
      ) : (
        <div
          className={`relative transition-all duration-150 ${
            selected
              ? "ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-stone-900 bg-white dark:bg-stone-900 shadow-sm"
              : "bg-white dark:bg-stone-900 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
          }`}
        >
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="absolute -left-7 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-1 text-stone-300 dark:text-stone-600 hover:text-stone-500 dark:hover:text-stone-400"
          >
            <DotsSixVertical className="h-4 w-4" weight="bold" />
          </div>

          {/* Type badge (top-right) */}
          {selected && (
            <span className="absolute -top-2.5 right-2 text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 leading-none">
              {TYPE_LABELS[block.type] || block.type}
            </span>
          )}

          {/* Block content */}
          <div className="px-3 py-2">
            <BlockRenderer
              block={block}
              selected={selected}
              onUpdate={onUpdate}
              onClick={onSelect}
            />
          </div>
        </div>
      )}

      {/* Inline properties panel */}
      <AnimatePresence>
        {selected && !isDragging && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <BlockProperties
              block={block}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onClose={onDeselect}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EmptyCanvas({ isDragging, overId }: { isDragging: boolean; overId: string | null }) {
  const { setNodeRef } = useDroppable({ id: "gap-0" });
  const isOver = overId === "gap-0";

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed transition-colors ${
        isDragging
          ? isOver
            ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40"
            : "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/30"
          : "border-stone-200 dark:border-stone-700"
      }`}
    >
      <StackSimple
        className={`h-8 w-8 mb-2 ${isDragging ? "text-indigo-400" : "text-stone-300 dark:text-stone-600"}`}
      />
      <span
        className={`text-sm ${isDragging ? "text-indigo-500 font-medium" : "text-stone-400 dark:text-stone-500"}`}
      >
        {isDragging ? "Drop here" : "Drag blocks here or click to add"}
      </span>
    </div>
  );
}

export function BlockCanvas({
  blocks,
  selectedBlockId,
  overId,
  isDragging,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
}: {
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  overId: string | null;
  isDragging: boolean;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (id: string, updated: EmailBlock) => void;
  onDeleteBlock: (id: string) => void;
  onDuplicateBlock: (id: string) => void;
}) {
  return (
    <div
      className="min-h-[400px] pl-8 bg-[radial-gradient(circle,#d6d3d1_0.5px,transparent_0.5px)] dark:bg-[radial-gradient(circle,#44403c_0.5px,transparent_0.5px)] [background-size:16px_16px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelectBlock(null);
      }}
    >
      {blocks.length === 0 ? (
        <EmptyCanvas isDragging={isDragging} overId={overId} />
      ) : (
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col py-2">
            {blocks.map((block, i) => (
              <div key={block.id}>
                {/* Gap drop zone before each block */}
                <DropGap
                  id={`gap-${i}`}
                  isDragging={isDragging}
                  isOver={overId === `gap-${i}`}
                />
                <AnimatePresence initial={false}>
                  <SortableBlock
                    block={block}
                    selected={selectedBlockId === block.id}
                    onSelect={() => onSelectBlock(block.id)}
                    onDeselect={() => onSelectBlock(null)}
                    onUpdate={(updated) => onUpdateBlock(block.id, updated)}
                    onDelete={() => onDeleteBlock(block.id)}
                    onDuplicate={() => onDuplicateBlock(block.id)}
                  />
                </AnimatePresence>
              </div>
            ))}
            {/* Gap after last block */}
            <DropGap
              id={`gap-${blocks.length}`}
              isDragging={isDragging}
              isOver={overId === `gap-${blocks.length}`}
            />
          </div>
        </SortableContext>
      )}
    </div>
  );
}
