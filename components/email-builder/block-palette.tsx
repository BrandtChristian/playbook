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
} from "@phosphor-icons/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, React.ComponentType<any>> = {
  TextH,
  TextAa,
  CursorClick,
  Image,
  Minus,
  ArrowsVertical,
};

// Mini preview thumbnails — tiny CSS sketches of each block type
function BlockPreview({ type }: { type: string }) {
  switch (type) {
    case "heading":
      return (
        <div className="flex flex-col gap-[2px]">
          <div className="w-10 h-[3px] bg-stone-400 rounded-full" />
          <div className="w-6 h-[2px] bg-stone-300 rounded-full" />
        </div>
      );
    case "text":
      return (
        <div className="flex flex-col gap-[2px]">
          <div className="w-10 h-[2px] bg-stone-300 rounded-full" />
          <div className="w-8 h-[2px] bg-stone-300 rounded-full" />
          <div className="w-6 h-[2px] bg-stone-300 rounded-full" />
        </div>
      );
    case "button":
      return (
        <div className="w-10 h-[8px] bg-orange-400 rounded-sm" />
      );
    case "image":
      return (
        <div className="w-10 h-[10px] bg-stone-200 border border-stone-300 flex items-center justify-center">
          <Image className="h-2 w-2 text-stone-400" />
        </div>
      );
    case "divider":
      return (
        <div className="w-10 h-[1px] bg-stone-300" />
      );
    case "spacer":
      return (
        <div className="w-10 h-[6px] border border-dashed border-stone-300" />
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
      className={`group/item flex flex-col items-center gap-1.5 w-full px-2 py-2.5 text-center text-xs transition-all cursor-grab active:cursor-grabbing border border-transparent hover:border-stone-200 hover:bg-stone-50 hover:scale-[1.02] active:scale-[0.98] active:bg-stone-100 select-none ${isDragging ? "opacity-30" : ""}`}
    >
      <div className="flex items-center justify-center h-4">
        <BlockPreview type={item.type} />
      </div>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-stone-400 group-hover/item:text-stone-500" />}
        <span className="text-stone-600 font-medium text-[11px]">{item.label}</span>
      </div>
    </div>
  );
}

export function BlockPalette() {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 pb-1.5">
        Drag to add
      </span>
      {BLOCK_PALETTE.map((item) => (
        <DraggablePaletteItem key={item.type} item={item} />
      ))}
    </div>
  );
}
