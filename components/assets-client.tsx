"use client";

import { useState, useRef, useCallback } from "react";
import {
  MagnifyingGlass,
  UploadSimple,
  CircleNotch,
  Trash,
  Copy,
  ImageSquare,
  X,
  ArrowsOutCardinal,
  CheckSquare,
  Square,
  Pencil,
  Sparkle,
} from "@phosphor-icons/react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";

// Snap the center of the drag overlay to the pointer
const snapCenterToCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  transform,
}) => {
  if (activatorEvent && activeNodeRect) {
    const evt = activatorEvent as PointerEvent;
    const offsetX = evt.clientX - activeNodeRect.left;
    const offsetY = evt.clientY - activeNodeRect.top;
    // 48 = half of overlay size (w-24 = 96px / 2)
    return {
      ...transform,
      x: transform.x + offsetX - 48,
      y: transform.y + offsetY - 48,
    };
  }
  return transform;
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAssets, type Asset } from "@/hooks/use-assets";
import { AssetFolderNavigation } from "@/components/assets/asset-folder-navigation";
import { FolderPickerDialog } from "@/components/assets/folder-picker-dialog";

// Draggable asset card
function DraggableAssetCard({
  asset,
  isSelected,
  selectionMode,
  selectedCount,
  onToggleSelect,
  onClick,
  onCopyUrl,
  onDelete,
  onMove,
  formatSize,
}: {
  asset: Asset;
  isSelected: boolean;
  selectionMode: boolean;
  selectedCount: number;
  onToggleSelect: (id: string) => void;
  onClick: (asset: Asset) => void;
  onCopyUrl: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
  onMove: (asset: Asset) => void;
  formatSize: (bytes: number) => string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: { type: "asset", asset },
  });

  return (
    <div
      ref={setNodeRef}
      className={`group relative border transition-all cursor-pointer ${
        isDragging
          ? "opacity-40 border-indigo-300"
          : isSelected
          ? "border-indigo-500 ring-2 ring-indigo-500/20"
          : "border-border hover:border-indigo-400"
      }`}
      onClick={() => {
        if (selectionMode) {
          onToggleSelect(asset.id);
        } else {
          onClick(asset);
        }
      }}
      {...attributes}
      {...listeners}
    >
      <div className="aspect-square overflow-hidden bg-stone-100 dark:bg-stone-800">
        <img
          src={asset.url}
          alt={asset.alt_text || asset.name}
          className="w-full h-full object-cover"
          loading="lazy"
          draggable={false}
        />
      </div>
      <div className="p-2 border-t">
        <p className="text-xs font-medium truncate">{asset.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {asset.dimensions?.width}×{asset.dimensions?.height} ·{" "}
          {formatSize(asset.file_size)}
        </p>
      </div>

      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(asset.id);
        }}
        className={`absolute top-1.5 left-1.5 h-5 w-5 flex items-center justify-center transition-opacity ${
          selectionMode || isSelected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {isSelected ? (
          <CheckSquare weight="fill" className="h-4 w-4 text-indigo-500" />
        ) : (
          <Square className="h-4 w-4 text-white drop-shadow-md" />
        )}
      </button>

      {/* Quick actions overlay */}
      {!selectionMode && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(asset);
            }}
            className="h-6 w-6 flex items-center justify-center bg-black/60 text-white hover:bg-black/80 transition-colors"
            title="Move to folder"
          >
            <ArrowsOutCardinal className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopyUrl(asset);
            }}
            className="h-6 w-6 flex items-center justify-center bg-black/60 text-white hover:bg-black/80 transition-colors"
            title="Copy URL"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(asset);
            }}
            className="h-6 w-6 flex items-center justify-center bg-black/60 text-white hover:bg-red-600 transition-colors"
            title="Delete"
          >
            <Trash className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function AssetsClient() {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [detailTarget, setDetailTarget] = useState<Asset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectionMode = selectedIds.size > 0;

  // Move dialog state
  const [movePickerOpen, setMovePickerOpen] = useState(false);
  const [moveTargetAsset, setMoveTargetAsset] = useState<Asset | null>(null);

  // Rename state
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  // Alt text state
  const [draftAltText, setDraftAltText] = useState("");
  const [generatingAlt, setGeneratingAlt] = useState(false);
  const [altTextDirty, setAltTextDirty] = useState(false);

  // Drag state
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const {
    assets,
    folders,
    loading,
    loadAssets,
    loadFolders,
    uploadAsset,
    deleteAsset,
    updateAsset,
    moveAssets,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useAssets({ folderId, search: searchDebounced });

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchDebounced(value), 300);
  }

  async function handleUpload(files: FileList | File[]) {
    setUploading(true);
    let successCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          await uploadAsset(file, folderId);
          successCount++;
        } catch (err) {
          toast.error(
            `Failed to upload ${file.name}: ${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }
      if (successCount > 0) {
        toast.success(
          `${successCount} image${successCount > 1 ? "s" : ""} uploaded`
        );
        loadAssets(folderId, searchDebounced);
        loadFolders();
      }
    } finally {
      setUploading(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteAsset(deleteTarget.id);
      toast.success("Asset deleted");
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
      loadFolders();
    } catch {
      toast.error("Failed to delete asset");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      try {
        await deleteAsset(id);
        deleted++;
      } catch {
        // continue
      }
    }
    if (deleted > 0) {
      toast.success(`${deleted} asset${deleted > 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      loadFolders();
    }
  }

  async function handleCreateFolder(name: string, parentId?: string | null) {
    try {
      await createFolder(name, parentId);
      toast.success("Folder created");
      loadFolders();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create folder"
      );
    }
  }

  async function handleRenameFolder(id: string, name: string) {
    try {
      await renameFolder(id, name);
      toast.success("Folder renamed");
      loadFolders();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to rename folder"
      );
    }
  }

  async function handleDeleteFolder(id: string) {
    try {
      await deleteFolder(id);
      toast.success("Folder deleted");
      if (folderId === id) setFolderId(null);
      loadFolders();
      loadAssets(folderId === id ? null : folderId, searchDebounced);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete folder"
      );
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(assets.map((a) => a.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  // Move helpers
  function openMoveForAsset(asset: Asset) {
    setMoveTargetAsset(asset);
    setMovePickerOpen(true);
  }

  function openMoveForSelection() {
    setMoveTargetAsset(null);
    setMovePickerOpen(true);
  }

  async function handleMoveToFolder(targetFolderId: string | null) {
    try {
      if (moveTargetAsset && !selectedIds.has(moveTargetAsset.id)) {
        await updateAsset(moveTargetAsset.id, { folder_id: targetFolderId });
        toast.success("Asset moved");
      } else {
        const ids = moveTargetAsset
          ? selectedIds.has(moveTargetAsset.id)
            ? Array.from(selectedIds)
            : [moveTargetAsset.id]
          : Array.from(selectedIds);
        const count = await moveAssets(ids, targetFolderId);
        toast.success(`${count} asset${count > 1 ? "s" : ""} moved`);
        setSelectedIds(new Set());
      }
      loadAssets(folderId, searchDebounced);
      loadFolders();
    } catch {
      toast.error("Failed to move assets");
    }
    setMoveTargetAsset(null);
  }

  // Drag-and-drop handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const targetFolderId = over.id as string;
    const draggedId = active.id as string;
    const resolvedFolderId =
      targetFolderId === "root-drop" ? null : targetFolderId;

    try {
      if (selectedIds.has(draggedId) && selectedIds.size > 1) {
        const count = await moveAssets(
          Array.from(selectedIds),
          resolvedFolderId
        );
        toast.success(`${count} asset${count > 1 ? "s" : ""} moved`);
        setSelectedIds(new Set());
      } else {
        await updateAsset(draggedId, { folder_id: resolvedFolderId });
        toast.success("Asset moved");
      }
      loadAssets(folderId, searchDebounced);
      loadFolders();
    } catch {
      toast.error("Failed to move asset");
    }
  }

  function copyUrl(asset: Asset) {
    if (asset.url) {
      navigator.clipboard.writeText(asset.url);
      toast.success("URL copied");
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Detail modal: rename
  function startRename() {
    if (!detailTarget) return;
    setDraftName(detailTarget.name);
    setEditingName(true);
  }

  async function saveRename() {
    if (!detailTarget || !draftName.trim()) return;
    try {
      const updated = await updateAsset(detailTarget.id, {
        name: draftName.trim(),
      });
      setDetailTarget(updated);
      toast.success("Renamed");
    } catch {
      toast.error("Failed to rename");
    }
    setEditingName(false);
  }

  // Detail modal: open
  const openDetail = useCallback((asset: Asset) => {
    setDetailTarget(asset);
    setDraftAltText(asset.alt_text || "");
    setAltTextDirty(false);
    setEditingName(false);
  }, []);

  // Detail modal: alt text
  async function saveAltText() {
    if (!detailTarget) return;
    try {
      const updated = await updateAsset(detailTarget.id, {
        alt_text: draftAltText,
      });
      setDetailTarget(updated);
      setAltTextDirty(false);
      toast.success("Alt text saved");
    } catch {
      toast.error("Failed to save alt text");
    }
  }

  async function generateAltText() {
    if (!detailTarget?.url) return;
    setGeneratingAlt(true);
    try {
      const res = await fetch("/api/ai/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: detailTarget.url }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate");
      setDraftAltText(json.alt);
      setAltTextDirty(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate alt text"
      );
    } finally {
      setGeneratingAlt(false);
    }
  }

  const draggedAsset = activeDragId
    ? assets.find((a) => a.id === activeDragId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h1 className="text-lg font-semibold">Assets</h1>
            <p className="text-sm text-muted-foreground">
              Manage images for your email campaigns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search..."
                className="h-8 w-52 text-sm pl-8"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSearchDebounced("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <label>
              <Button size="sm" disabled={uploading} asChild>
                <span className="cursor-pointer">
                  {uploading ? (
                    <CircleNotch className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <UploadSimple className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Upload
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleUpload(e.target.files);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - folders */}
          <div className="w-52 border-r overflow-y-auto py-2">
            <AssetFolderNavigation
              folders={folders}
              currentFolderId={folderId}
              onFolderChange={setFolderId}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              isAdmin={true}
              isDropTarget={!!activeDragId}
            />
          </div>

          {/* Asset grid */}
          <div
            className={`flex-1 overflow-y-auto p-4 transition-colors ${
              dragOver ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
            }`}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDragOver(true);
              }
            }}
            onDragLeave={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                setDragOver(false);
              }
            }}
            onDrop={handleFileDrop}
          >
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <ImageSquare className="h-12 w-12" />
                <p className="text-sm">
                  {searchDebounced
                    ? "No assets match your search"
                    : "No assets yet"}
                </p>
                <p className="text-xs">
                  {searchDebounced
                    ? "Try a different search term"
                    : "Upload images to get started"}
                </p>
                {!searchDebounced && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadSimple className="h-3.5 w-3.5 mr-1.5" />
                    Upload images
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {assets.map((asset) => (
                  <DraggableAssetCard
                    key={asset.id}
                    asset={asset}
                    isSelected={selectedIds.has(asset.id)}
                    selectionMode={selectionMode}
                    selectedCount={selectedIds.size}
                    onToggleSelect={toggleSelect}
                    onClick={openDetail}
                    onCopyUrl={copyUrl}
                    onDelete={setDeleteTarget}
                    onMove={openMoveForAsset}
                    formatSize={formatSize}
                  />
                ))}
              </div>
            )}

            {/* Drop zone overlay for file uploads */}
            {dragOver && (
              <div className="fixed inset-0 z-50 bg-indigo-500/10 flex items-center justify-center pointer-events-none">
                <div className="bg-background border-2 border-dashed border-indigo-400 px-8 py-6 flex flex-col items-center gap-2">
                  <UploadSimple className="h-8 w-8 text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    Drop images to upload
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectionMode && (
          <div className="border-t bg-background px-6 py-2.5 flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              {selectedIds.size < assets.length && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select all
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={openMoveForSelection}
              >
                <ArrowsOutCardinal className="h-3.5 w-3.5 mr-1.5" />
                Move to...
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={deselectAll}>
                <X className="h-3.5 w-3.5 mr-1" />
                Deselect
              </Button>
            </div>
          </div>
        )}

        {/* Drag overlay */}
        <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={null}>
          {draggedAsset && (
            <div className="w-24 h-24 bg-background border-2 border-indigo-400 shadow-lg overflow-hidden opacity-90 pointer-events-none relative">
              <img
                src={draggedAsset.url}
                alt={draggedAsset.name}
                className="w-full h-full object-cover"
              />
              {selectedIds.has(draggedAsset.id) && selectedIds.size > 1 && (
                <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center shadow">
                  {selectedIds.size}
                </div>
              )}
            </div>
          )}
        </DragOverlay>

        {/* Delete confirmation */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete asset</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Asset detail modal */}
        <Dialog
          open={!!detailTarget}
          onOpenChange={(open) => {
            if (!open) {
              if (altTextDirty && detailTarget) {
                updateAsset(detailTarget.id, { alt_text: draftAltText }).catch(
                  () => {}
                );
              }
              setDetailTarget(null);
              setEditingName(false);
              setAltTextDirty(false);
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              {editingName ? (
                <div className="flex items-center gap-2 pr-8">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="h-7 text-sm font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    onBlur={saveRename}
                  />
                </div>
              ) : (
                <DialogTitle
                  className="truncate pr-8 group/title cursor-pointer flex items-center gap-1.5"
                  onClick={startRename}
                  title="Click to rename"
                >
                  {detailTarget?.name}
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0" />
                </DialogTitle>
              )}
            </DialogHeader>
            {detailTarget && (
              <div className="space-y-4">
                <div className="bg-stone-100 dark:bg-stone-800 p-4 flex items-center justify-center max-h-[300px] overflow-hidden">
                  <img
                    src={detailTarget.url}
                    alt={detailTarget.alt_text || detailTarget.name}
                    className="max-w-full max-h-[280px] object-contain"
                  />
                </div>

                {/* Alt text */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">
                      Alt text
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1 text-indigo-600 dark:text-indigo-400"
                      onClick={generateAltText}
                      disabled={generatingAlt}
                    >
                      {generatingAlt ? (
                        <CircleNotch className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkle weight="fill" className="h-3 w-3" />
                      )}
                      {generatingAlt ? "Generating..." : "AI Generate"}
                    </Button>
                  </div>
                  <Textarea
                    value={draftAltText}
                    onChange={(e) => {
                      setDraftAltText(e.target.value);
                      setAltTextDirty(true);
                    }}
                    placeholder="Describe this image for accessibility..."
                    className="text-sm min-h-[60px] resize-none"
                    rows={2}
                  />
                  {altTextDirty && (
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={saveAltText}
                      >
                        Save alt text
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Dimensions
                    </span>
                    <p className="font-medium">
                      {detailTarget.dimensions?.width}×
                      {detailTarget.dimensions?.height}px
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      File size
                    </span>
                    <p className="font-medium">
                      {formatSize(detailTarget.file_size)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Type</span>
                    <p className="font-medium">{detailTarget.mime_type}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Uploaded
                    </span>
                    <p className="font-medium">
                      {formatDate(detailTarget.created_at)}
                    </p>
                  </div>
                  {detailTarget.optimization_metadata?.compression_ratio !=
                    null && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Compression
                      </span>
                      <p className="font-medium">
                        {detailTarget.optimization_metadata.compression_ratio}%
                        saved
                      </p>
                    </div>
                  )}
                  {detailTarget.asset_folders && (
                    <div>
                      <span className="text-xs text-muted-foreground">
                        Folder
                      </span>
                      <p className="font-medium">
                        {detailTarget.asset_folders.name}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMoveForAsset(detailTarget)}
                  >
                    <ArrowsOutCardinal className="h-3.5 w-3.5 mr-1.5" />
                    Move
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyUrl(detailTarget)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy URL
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDetailTarget(null);
                      setDeleteTarget(detailTarget);
                    }}
                  >
                    <Trash className="h-3.5 w-3.5 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Move to folder picker */}
        <FolderPickerDialog
          isOpen={movePickerOpen}
          onClose={() => {
            setMovePickerOpen(false);
            setMoveTargetAsset(null);
          }}
          onSelect={handleMoveToFolder}
          folders={folders}
          currentFolderId={moveTargetAsset?.folder_id ?? null}
        />
      </div>
    </DndContext>
  );
}
