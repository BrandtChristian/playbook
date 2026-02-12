"use client";

import { useDraggable } from "@dnd-kit/core";
import { BLOCK_PALETTE, type PaletteItem } from "@/lib/email/blocks";
import {
  TextH,
  TextAa,
  CursorClick,
  Image,
  Minus,
  ArrowsVertical,
  Quotes,
  PlayCircle,
  Columns,
  ShareNetwork,
  Code,
} from "@phosphor-icons/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, React.ComponentType<any>> = {
  TextH, TextAa, CursorClick, Image, Minus, ArrowsVertical,
  Quotes, PlayCircle, Columns, ShareNetwork, Code,
};

function BlockPreview({ type }: { type: string }) {
  switch (type) {
    case "heading":
      return (
        <div className="flex flex-col gap-[2px]">
          <div className="w-10 h-[3px] bg-stone-400 dark:bg-stone-500 rounded-full" />
          <div className="w-6 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-[2px]">
          <div className="w-10 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
          <div className="w-8 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
          <div className="w-6 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
        </div>
      );
    case "button":
      return <div className="w-10 h-[8px] bg-indigo-400 rounded-sm" />;
    case "image":
      return (
        <div className="w-10 h-[10px] bg-stone-200 dark:bg-stone-700 border border-stone-300 dark:border-stone-600 flex items-center justify-center">
          <Image className="h-2 w-2 text-stone-400 dark:text-stone-500" />
        </div>
      );
    case "quote":
      return (
        <div className="flex gap-[2px]">
          <div className="w-[2px] h-[10px] bg-indigo-400" />
          <div className="flex flex-col gap-[2px]">
            <div className="w-8 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
            <div className="w-5 h-[2px] bg-stone-300 dark:bg-stone-600 rounded-full" />
          </div>
        </div>
      );
    case "video":
      return (
        <div className="w-10 h-[10px] bg-stone-800 flex items-center justify-center">
          <div className="w-0 h-0 border-l-[4px] border-l-white border-y-[3px] border-y-transparent" />
        </div>
      );
    case "columns":
      return (
        <div className="flex gap-[3px]">
          <div className="w-[18px] h-[10px] bg-stone-200 dark:bg-stone-700 border border-stone-300 dark:border-stone-600" />
          <div className="w-[18px] h-[10px] bg-stone-200 dark:bg-stone-700 border border-stone-300 dark:border-stone-600" />
        </div>
      );
    case "social":
      return (
        <div className="flex gap-[2px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[8px] h-[8px] bg-stone-700 dark:bg-stone-500 rounded-full" />
          ))}
        </div>
      );
    case "divider":
      return <div className="w-10 h-[1px] bg-stone-300 dark:bg-stone-600" />;
    case "spacer":
      return <div className="w-10 h-[6px] border border-dashed border-stone-300 dark:border-stone-600" />;
    case "html":
      return (
        <div className="flex items-center gap-[2px]">
          <span className="text-[6px] text-stone-400 dark:text-stone-500 font-mono">&lt;/&gt;</span>
        </div>
      );
    default:
      return null;
  }
}

function DraggablePaletteItem({ item }: { item: PaletteItem }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { fromPalette: true, blockType: item.type },
  });

  const Icon = ICONS[item.icon];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group/item flex flex-col items-center gap-1.5 w-full px-2 py-2 text-center text-xs transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-stone-200 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 hover:scale-[1.02] active:scale-[0.98] active:bg-stone-100 dark:active:bg-stone-700 select-none ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="flex items-center justify-center h-4">
        <BlockPreview type={item.type} />
      </div>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-stone-400 dark:text-stone-500 group-hover/item:text-stone-500 dark:group-hover/item:text-stone-400" />}
        <span className="text-stone-600 dark:text-stone-400 font-medium text-[11px]">{item.label}</span>
      </div>
    </div>
  );
}

export function BlockPalette() {
  // Group palette items
  const contentBlocks = BLOCK_PALETTE.filter((p) => p.group === "Content");
  const layoutBlocks = BLOCK_PALETTE.filter((p) => p.group === "Layout");

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest px-2 pb-1">
        Content
      </span>
      {contentBlocks.map((item) => (
        <DraggablePaletteItem key={item.type} item={item} />
      ))}
      <span className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest px-2 pt-2 pb-1">
        Layout
      </span>
      {layoutBlocks.map((item) => (
        <DraggablePaletteItem key={item.type} item={item} />
      ))}
    </div>
  );
}
