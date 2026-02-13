"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
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
import { BlockEditModal } from "./block-edit-modal";
import { AiPromptBar } from "./ai-prompt-bar";

export function EmailBuilder({
  blocks,
  onChange,
  onBlocksChange,
  onGenerateEmail,
  onFillBlocks,
  onImproveBlock,
  templateName,
}: {
  blocks: EmailBlock[];
  onChange: (html: string) => void;
  onBlocksChange: (blocks: EmailBlock[]) => void;
  onGenerateEmail: (html: string) => void;
  onFillBlocks: (result: string) => void;
  onImproveBlock: (blockId: string, result: string) => void;
  templateName?: string;
}) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
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

  // Custom collision: pointerWithin first (gap zones), then closestCenter (sortable blocks)
  // pointerWithin returns nothing when pointer is outside all droppables → enables cancel
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pw = pointerWithin(args);
    // Prefer gap/column zones if pointer is inside one
    const gapHit = pw.find((c) => String(c.id).startsWith("gap-") || String(c.id).startsWith("col-"));
    if (gapHit) return [gapHit];
    if (pw.length > 0) return pw;
    // Fallback to closestCenter for sortable reordering (only if pointer is somewhat close)
    return closestCenter(args);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    // Collapse any open properties panel so it doesn't shift layout mid-drag
    setSelectedBlockId(null);
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
    const overData = over.data.current;

    const overId = String(over.id);

    // Dragging from palette
    if (activeData?.fromPalette) {
      const type = activeData.blockType as string;
      // Don't allow nested columns
      if (type === "columns" && overData?.columnBlockId) return;

      const paletteItem = BLOCK_PALETTE.find((p) => p.type === type);
      if (!paletteItem) return;
      const newBlock = paletteItem.factory();

      // Dropped onto a column zone → add child to that column
      if (overData?.columnBlockId && overData?.side) {
        const parentId = overData.columnBlockId as string;
        const side = overData.side as "left" | "right";
        const newBlocks = blocks.map((b) => {
          if (b.id !== parentId || b.type !== "columns") return b;
          return {
            ...b,
            [side]: [...b[side], newBlock],
          };
        });
        updateBlocks(newBlocks);
        return;
      }

      // Dropped onto a gap zone → insert at gap index
      if (overId.startsWith("gap-")) {
        const insertIndex = parseInt(overId.replace("gap-", ""), 10);
        const newBlocks = [...blocks];
        newBlocks.splice(insertIndex, 0, newBlock);
        updateBlocks(newBlocks);
        setSelectedBlockId(newBlock.id);
        if (newBlock.type === "image" || newBlock.type === "video") {
          setEditingBlockId(newBlock.id);
        }
        return;
      }

      // Dropped onto an existing block → insert before it
      const overIndex = blocks.findIndex((b) => b.id === over.id);
      const insertIndex = overIndex >= 0 ? overIndex : blocks.length;
      const newBlocks = [...blocks];
      newBlocks.splice(insertIndex, 0, newBlock);
      updateBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
      if (newBlock.type === "image" || newBlock.type === "video") {
        setEditingBlockId(newBlock.id);
      }
      return;
    }

    // Reordering within canvas — handle gap drops
    if (overId.startsWith("gap-")) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      if (oldIndex < 0) return;
      let targetIndex = parseInt(overId.replace("gap-", ""), 10);
      // Adjust: if moving down, account for removal shifting indices
      if (oldIndex < targetIndex) targetIndex--;
      if (oldIndex !== targetIndex) {
        updateBlocks(arrayMove(blocks, oldIndex, targetIndex));
      }
    } else if (active.id !== over.id) {
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
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* AI Prompt Bar — spans full width above the palette+canvas grid */}
      <AiPromptBar
        blocks={blocks}
        selectedBlockId={selectedBlockId}
        onGenerateEmail={onGenerateEmail}
        onFillBlocks={onFillBlocks}
        onImproveBlock={onImproveBlock}
        templateName={templateName}
      />

      <div className="grid grid-cols-[160px_1fr] gap-3 min-h-[400px]">
        {/* Palette */}
        <div className="border-r border-stone-100 dark:border-stone-800 pr-2">
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
            className="bg-white dark:bg-stone-900 border border-indigo-300 shadow-xl shadow-stone-900/10 px-3 py-2 max-w-[300px]"
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
            className="bg-white dark:bg-stone-900 border border-indigo-300 shadow-xl shadow-stone-900/10 px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-300"
            style={{ transform: "rotate(1deg) scale(0.97)" }}
          >
            {BLOCK_PALETTE.find((p) => p.type === activePaletteType)
              ?.label || "Block"}
          </div>
        ) : null}
      </DragOverlay>

      {/* Edit modal for image/video blocks added to main canvas */}
      {editingBlockId && (() => {
        const blk = blocks.find((b) => b.id === editingBlockId);
        if (!blk || (blk.type !== "image" && blk.type !== "video")) return null;
        return (
          <BlockEditModal
            block={blk}
            open={true}
            onClose={() => setEditingBlockId(null)}
            onUpdate={(updated) => handleUpdateBlock(editingBlockId, updated)}
          />
        );
      })()}
    </DndContext>
  );
}
