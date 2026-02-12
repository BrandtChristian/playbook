"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  type EmailBlock,
  BLOCK_PALETTE,
  serializeBlocks,
} from "@/lib/email/blocks";
import { BlockPalette } from "./block-palette";
import { BlockCanvas } from "./block-canvas";
import { BlockRenderer } from "./block-renderer";

export function EmailBuilder({
  blocks,
  onChange,
  onBlocksChange,
}: {
  blocks: EmailBlock[];
  onChange: (html: string) => void;
  onBlocksChange: (blocks: EmailBlock[]) => void;
}) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateBlocks = useCallback(
    (newBlocks: EmailBlock[]) => {
      onBlocksChange(newBlocks);
      onChange(serializeBlocks(newBlocks));
    },
    [onChange, onBlocksChange]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const activeData = active.data.current;

    // Dragging from palette → insert new block
    if (activeData?.fromPalette) {
      const type = activeData.blockType as string;
      const paletteItem = BLOCK_PALETTE.find((p) => p.type === type);
      if (!paletteItem) return;

      const newBlock = paletteItem.factory();
      const overIndex = blocks.findIndex((b) => b.id === over.id);
      const insertIndex = overIndex >= 0 ? overIndex : blocks.length;

      const newBlocks = [...blocks];
      newBlocks.splice(insertIndex, 0, newBlock);
      updateBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
      return;
    }

    // Reordering within canvas
    if (active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        updateBlocks(arrayMove(blocks, oldIndex, newIndex));
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverId(null);
  }

  function handleUpdateBlock(id: string, updated: EmailBlock) {
    const newBlocks = blocks.map((b) => (b.id === id ? updated : b));
    updateBlocks(newBlocks);
  }

  function handleDeleteBlock(id: string) {
    const newBlocks = blocks.filter((b) => b.id !== id);
    if (selectedBlockId === id) setSelectedBlockId(null);
    updateBlocks(newBlocks);
  }

  function handleDuplicateBlock(id: string) {
    const index = blocks.findIndex((b) => b.id === id);
    if (index < 0) return;
    const original = blocks[index];
    const duplicate = { ...original, id: crypto.randomUUID() };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, duplicate);
    updateBlocks(newBlocks);
    setSelectedBlockId(duplicate.id);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedBlockId) return;

      // Don't capture when editing text
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;

      if (e.key === "Escape") {
        setSelectedBlockId(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteBlock(selectedBlockId);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Active drag block for DragOverlay
  const activeBlock = activeId
    ? blocks.find((b) => b.id === activeId)
    : null;
  const activePaletteType = activeId?.startsWith("palette-")
    ? activeId.replace("palette-", "")
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-[160px_1fr] gap-3 min-h-[400px]">
        {/* Palette */}
        <div className="border-r border-stone-100 pr-2">
          <BlockPalette />
        </div>

        {/* Canvas */}
        <BlockCanvas
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          overId={overId}
          isDragging={!!activeId}
          onSelectBlock={setSelectedBlockId}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
          onDuplicateBlock={handleDuplicateBlock}
        />
      </div>

      {/* Drag overlay — lifted card with rotation */}
      <DragOverlay>
        {activeBlock ? (
          <div
            className="bg-white border border-orange-300 shadow-xl shadow-stone-900/10 px-3 py-2 max-w-[300px]"
            style={{ transform: "rotate(1deg) scale(0.97)" }}
          >
            <BlockRenderer
              block={activeBlock}
              selected={false}
              onUpdate={() => {}}
              onClick={() => {}}
            />
          </div>
        ) : activePaletteType ? (
          <div
            className="bg-white border border-orange-300 shadow-xl shadow-stone-900/10 px-4 py-2 text-sm font-medium text-stone-600"
            style={{ transform: "rotate(1deg) scale(0.97)" }}
          >
            {BLOCK_PALETTE.find((p) => p.type === activePaletteType)
              ?.label || "Block"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
