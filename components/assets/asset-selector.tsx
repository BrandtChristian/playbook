"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MagnifyingGlass,
  CircleNotch,
  ImageSquare,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Asset, AssetFolder } from "@/hooks/use-assets";

interface AssetSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: { url: string; name: string; width?: number; height?: number }) => void;
}

export function AssetSelector({ isOpen, onClose, onSelect }: AssetSelectorProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Asset | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folder", folderId);
      if (search) params.set("search", search);

      const res = await fetch(`/api/assets?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const withUrls = (json.assets || []).map((a: Asset) => ({
          ...a,
          url: `${baseUrl}/storage/v1/object/public/organization-assets/${a.storage_path}`,
        }));
        setAssets(withUrls);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [folderId, search]);

  useEffect(() => {
    if (isOpen) {
      loadAssets();
      // Load folders
      fetch("/api/assets/folders")
        .then((r) => r.json())
        .then((json) => setFolders(json.folders || []))
        .catch(() => {});
    }
  }, [isOpen, loadAssets]);

  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setSearch("");
      setFolderId(null);
    }
  }, [isOpen]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) formData.append("folderId", folderId);
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        // Select the newly uploaded asset immediately
        onSelect({
          url: json.url,
          name: json.asset?.name || file.name,
          width: json.width,
          height: json.height,
        });
        onClose();
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  }

  function handleSelect(asset: Asset) {
    setSelected(asset);
  }

  function confirmSelection() {
    if (!selected) return;
    onSelect({
      url: selected.url!,
      name: selected.name,
      width: selected.dimensions?.width,
      height: selected.dimensions?.height,
    });
    onClose();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Select image</DialogTitle>
            <label className="inline-flex">
              <Button variant="outline" size="sm" disabled={uploading} asChild>
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
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search assets..."
                className="h-8 text-sm pl-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <select
              value={folderId || ""}
              onChange={(e) => setFolderId(e.target.value || null)}
              className="h-8 text-sm border border-input bg-background px-2 min-w-[140px]"
            >
              <option value="">All folders</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <CircleNotch className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <ImageSquare className="h-10 w-10" />
              <span className="text-sm">
                {search ? "No assets matching your search" : "No assets uploaded yet"}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleSelect(asset)}
                  className={`group relative aspect-square overflow-hidden border-2 transition-all ${
                    selected?.id === asset.id
                      ? "border-indigo-500 ring-2 ring-indigo-500/20"
                      : "border-border hover:border-indigo-400"
                  }`}
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] font-medium truncate">
                      {asset.name}
                    </p>
                    <p className="text-white/70 text-[9px]">
                      {asset.dimensions?.width}×{asset.dimensions?.height} · {formatSize(asset.file_size)}
                    </p>
                  </div>
                  {selected?.id === asset.id && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-500 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer with selection info */}
        <div className="border-t px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {selected ? (
              <>
                Selected: <span className="font-medium text-foreground">{selected.name}</span>
                {" · "}
                {selected.dimensions?.width}×{selected.dimensions?.height}
              </>
            ) : (
              `${assets.length} asset${assets.length !== 1 ? "s" : ""}`
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmSelection} disabled={!selected}>
              Select
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
