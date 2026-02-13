"use client";

import { useState, useCallback, useEffect } from "react";

export interface Asset {
  id: string;
  org_id: string;
  name: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  dimensions: { width?: number; height?: number };
  optimization_metadata: {
    original_size?: number;
    optimized_size?: number;
    compression_ratio?: number;
  };
  folder_id: string | null;
  alt_text?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  url?: string;
  asset_folders?: { id: string; name: string; slug: string } | null;
}

export interface AssetFolder {
  id: string;
  org_id: string;
  parent_folder_id: string | null;
  name: string;
  slug: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  asset_count?: number;
  children?: AssetFolder[];
}

export function useAssets(options?: { folderId?: string | null; search?: string }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [folders, setFolders] = useState<AssetFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [total, setTotal] = useState(0);

  const loadAssets = useCallback(
    async (folderId?: string | null, search?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (folderId) params.set("folder", folderId);
        if (search) params.set("search", search);

        const res = await fetch(`/api/assets?${params.toString()}`);
        const json = await res.json();
        if (res.ok) {
          // Build public URLs from storage paths
          const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const withUrls = (json.assets || []).map((a: Asset) => ({
            ...a,
            url:
              a.url ||
              `${baseUrl}/storage/v1/object/public/organization-assets/${a.storage_path}`,
          }));
          setAssets(withUrls);
          setTotal(json.total || 0);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch("/api/assets/folders?includeCount=true");
      const json = await res.json();
      if (res.ok) {
        setFolders(json.folders || []);
      }
    } catch {
      // silent
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const uploadAsset = useCallback(
    async (file: File, folderId?: string | null) => {
      const formData = new FormData();
      formData.append("file", file);
      if (folderId) formData.append("folderId", folderId);

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      return json;
    },
    []
  );

  const deleteAsset = useCallback(async (id: string) => {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const createFolder = useCallback(
    async (name: string, parentFolderId?: string | null) => {
      const res = await fetch("/api/assets/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentFolderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create folder");
      return json.folder as AssetFolder;
    },
    []
  );

  const renameFolder = useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/assets/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to rename folder");
    return json.folder as AssetFolder;
  }, []);

  const updateAsset = useCallback(
    async (
      id: string,
      data: { name?: string; folder_id?: string | null; alt_text?: string }
    ) => {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update asset");
      // Update local state
      setAssets((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...json.asset } : a))
      );
      return json.asset as Asset;
    },
    []
  );

  const moveAssets = useCallback(
    async (assetIds: string[], folderId: string | null) => {
      const res = await fetch("/api/assets/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_ids: assetIds, folder_id: folderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to move assets");
      return json.updated as number;
    },
    []
  );

  const deleteFolder = useCallback(async (id: string) => {
    const res = await fetch(`/api/assets/folders/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete folder");
  }, []);

  // Initial load
  useEffect(() => {
    loadAssets(options?.folderId, options?.search);
  }, [options?.folderId, options?.search, loadAssets]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  return {
    assets,
    folders,
    loading,
    loadingFolders,
    total,
    loadAssets,
    loadFolders,
    uploadAsset,
    deleteAsset,
    updateAsset,
    moveAssets,
    createFolder,
    renameFolder,
    deleteFolder,
    refresh: () => {
      loadAssets(options?.folderId, options?.search);
      loadFolders();
    },
  };
}
