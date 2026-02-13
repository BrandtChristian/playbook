"use client";

import { useState, useRef } from "react";
import {
  MagnifyingGlass,
  UploadSimple,
  CircleNotch,
  Trash,
  Copy,
  ImageSquare,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const {
    assets,
    folders,
    loading,
    loadAssets,
    loadFolders,
    uploadAsset,
    deleteAsset,
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
          toast.error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }
      if (successCount > 0) {
        toast.success(`${successCount} image${successCount > 1 ? "s" : ""} uploaded`);
        loadAssets(folderId, searchDebounced);
        loadFolders();
      }
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
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
      loadFolders();
    } catch {
      toast.error("Failed to delete asset");
    }
  }

  async function handleCreateFolder(name: string, parentId?: string | null) {
    try {
      await createFolder(name, parentId);
      toast.success("Folder created");
      loadFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    }
  }

  async function handleRenameFolder(id: string, name: string) {
    try {
      await renameFolder(id, name);
      toast.success("Folder renamed");
      loadFolders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename folder");
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
      toast.error(err instanceof Error ? err.message : "Failed to delete folder");
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

  return (
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
          />
        </div>

        {/* Asset grid */}
        <div
          className={`flex-1 overflow-y-auto p-4 transition-colors ${
            dragOver ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
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
                <div
                  key={asset.id}
                  className="group relative border border-border hover:border-indigo-400 transition-all cursor-pointer"
                  onClick={() => setDetailTarget(asset)}
                >
                  <div className="aspect-square overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2 border-t">
                    <p className="text-xs font-medium truncate">{asset.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {asset.dimensions?.width}×{asset.dimensions?.height} · {formatSize(asset.file_size)}
                    </p>
                  </div>
                  {/* Quick actions overlay */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyUrl(asset);
                      }}
                      className="h-6 w-6 flex items-center justify-center bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(asset);
                      }}
                      className="h-6 w-6 flex items-center justify-center bg-black/60 text-white hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone overlay */}
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

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete asset</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
            This action cannot be undone.
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
      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{detailTarget?.name}</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-4">
              <div className="bg-stone-100 dark:bg-stone-800 p-4 flex items-center justify-center max-h-[300px] overflow-hidden">
                <img
                  src={detailTarget.url}
                  alt={detailTarget.name}
                  className="max-w-full max-h-[280px] object-contain"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Dimensions</span>
                  <p className="font-medium">
                    {detailTarget.dimensions?.width}×{detailTarget.dimensions?.height}px
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">File size</span>
                  <p className="font-medium">{formatSize(detailTarget.file_size)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium">{detailTarget.mime_type}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Uploaded</span>
                  <p className="font-medium">{formatDate(detailTarget.created_at)}</p>
                </div>
                {detailTarget.optimization_metadata?.compression_ratio != null && (
                  <div>
                    <span className="text-xs text-muted-foreground">Compression</span>
                    <p className="font-medium">
                      {detailTarget.optimization_metadata.compression_ratio}% saved
                    </p>
                  </div>
                )}
                {detailTarget.asset_folders && (
                  <div>
                    <span className="text-xs text-muted-foreground">Folder</span>
                    <p className="font-medium">{detailTarget.asset_folders.name}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
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
    </div>
  );
}
