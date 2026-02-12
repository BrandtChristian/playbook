"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { EmailBlock } from "@/lib/email/blocks";
import {
  UploadSimple,
  CircleNotch,
  Lightning,
  Image as ImageIcon,
  PlayCircle,
} from "@phosphor-icons/react";
import { toast } from "sonner";

type AssetImage = { name: string; url: string; created_at: string };

export function BlockEditModal({
  block,
  open,
  onClose,
  onUpdate,
}: {
  block: EmailBlock;
  open: boolean;
  onClose: () => void;
  onUpdate: (updated: EmailBlock) => void;
}) {
  if (block.type === "image") {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          <ImageEditor block={block} onUpdate={onUpdate} onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
  }

  if (block.type === "video") {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
          </DialogHeader>
          <VideoEditor block={block} onUpdate={onUpdate} onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

function ImageEditor({
  block,
  onUpdate,
  onClose,
}: {
  block: Extract<EmailBlock, { type: "image" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingAlt, setGeneratingAlt] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [assets, setAssets] = useState<AssetImage[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [localBlock, setLocalBlock] = useState(block);

  function update(partial: Partial<typeof block>) {
    const updated = { ...localBlock, ...partial };
    setLocalBlock(updated);
    onUpdate(updated);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        update({ src: json.url });
        toast.success("Image uploaded");
        // Auto alt text
        fetch("/api/ai/alt-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: json.url }),
        })
          .then((r) => r.json())
          .then((data) => { if (data.alt) update({ src: json.url, alt: data.alt }); })
          .catch(() => {});
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  async function loadAssets() {
    setShowLibrary(true);
    if (assets.length > 0) return;
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/images");
      const json = await res.json();
      if (res.ok) setAssets(json.images || []);
    } catch {} finally { setLoadingAssets(false); }
  }

  async function generateAlt() {
    if (!localBlock.src) return;
    setGeneratingAlt(true);
    try {
      const res = await fetch("/api/ai/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: localBlock.src }),
      });
      const json = await res.json();
      if (res.ok && json.alt) {
        update({ alt: json.alt });
        toast.success("Alt text generated");
      }
    } catch {} finally { setGeneratingAlt(false); }
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }} />

      {/* Preview or upload zone */}
      {localBlock.src ? (
        <div className="relative bg-stone-100 dark:bg-stone-800 p-4 flex justify-center">
          <img src={localBlock.src} alt={localBlock.alt} className="max-h-[200px] max-w-full object-contain" />
          <Button variant="outline" size="sm" className="absolute top-2 right-2 text-xs"
            onClick={() => update({ src: "" })}>
            Change
          </Button>
        </div>
      ) : showLibrary ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Asset Library</span>
            <button className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300" onClick={() => setShowLibrary(false)}>
              Back to upload
            </button>
          </div>
          {loadingAssets ? (
            <div className="flex items-center justify-center py-8"><CircleNotch className="h-5 w-5 animate-spin text-stone-400 dark:text-stone-500" /></div>
          ) : assets.length === 0 ? (
            <div className="text-center py-6 text-xs text-stone-400 dark:text-stone-500">No images uploaded yet</div>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
              {assets.map((a) => (
                <button key={a.name} onClick={() => { update({ src: a.url }); setShowLibrary(false); }}
                  className="aspect-square overflow-hidden border border-stone-100 dark:border-stone-700 hover:border-indigo-400 hover:ring-1 hover:ring-indigo-400 transition-all">
                  <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 py-10 cursor-pointer hover:border-stone-400 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) uploadFile(f); }}
        >
          {uploading ? (
            <><CircleNotch className="h-8 w-8 animate-spin text-stone-400" /><span className="text-sm text-stone-400 dark:text-stone-500">Uploading...</span></>
          ) : (
            <>
              <UploadSimple className="h-8 w-8 text-stone-400 dark:text-stone-500" />
              <span className="text-sm text-stone-500 dark:text-stone-400">Drop image or click to upload</span>
              <button onClick={(e) => { e.stopPropagation(); loadAssets(); }}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                Browse library
              </button>
            </>
          )}
        </div>
      )}

      {/* URL input */}
      <div className="space-y-1.5">
        <Label className="text-xs">Image URL</Label>
        <Input value={localBlock.src} onChange={(e) => update({ src: e.target.value })} placeholder="https://..." className="text-sm" />
      </div>

      {/* Alt text — required */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Alt Text <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            value={localBlock.alt}
            onChange={(e) => update({ alt: e.target.value })}
            placeholder="Describe the image (required)"
            className={`text-sm flex-1 ${localBlock.src && !localBlock.alt?.trim() ? "border-amber-400 focus:border-amber-500" : ""}`}
          />
          {localBlock.src && (
            <Button variant="outline" size="sm" onClick={generateAlt} disabled={generatingAlt} className="shrink-0">
              {generatingAlt ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <Lightning className="h-3.5 w-3.5" weight="fill" />}
              <span className="ml-1.5">AI</span>
            </Button>
          )}
        </div>
        {localBlock.src && !localBlock.alt?.trim() && (
          <p className="text-[11px] text-amber-600">Add alt text manually or click AI to generate it.</p>
        )}
      </div>

      {/* Max width */}
      <div className="flex gap-4">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs">Max Width (px)</Label>
          <Input type="number" value={localBlock.maxWidth ?? ""} onChange={(e) => update({ maxWidth: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="600" className="text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Align</Label>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} onClick={() => update({ align: a })}
                className={`px-3 py-1.5 text-xs border ${localBlock.align === a ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300" : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"}`}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {localBlock.src && !localBlock.alt?.trim() && (
          <span className="text-xs text-amber-600">Alt text required</span>
        )}
        <Button
          onClick={onClose}
          disabled={!!(localBlock.src && !localBlock.alt?.trim())}
        >
          Done
        </Button>
      </div>
    </div>
  );
}

function VideoEditor({
  block,
  onUpdate,
  onClose,
}: {
  block: Extract<EmailBlock, { type: "video" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClose: () => void;
}) {
  const [localBlock, setLocalBlock] = useState(block);

  function update(partial: Partial<typeof block>) {
    const updated = { ...localBlock, ...partial };
    setLocalBlock(updated);
    onUpdate(updated);
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="bg-stone-900 flex items-center justify-center py-8">
        {localBlock.thumbnailUrl ? (
          <img src={localBlock.thumbnailUrl} alt={localBlock.alt} className="max-h-[160px] max-w-full object-contain" />
        ) : (
          <div className="text-center text-stone-400 dark:text-stone-500">
            <PlayCircle className="h-12 w-12 mx-auto mb-2" weight="fill" />
            <span className="text-xs">No thumbnail set</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Video URL</Label>
        <Input value={localBlock.videoUrl} onChange={(e) => update({ videoUrl: e.target.value })}
          placeholder="https://youtube.com/watch?v=..." className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Thumbnail Image URL</Label>
        <Input value={localBlock.thumbnailUrl} onChange={(e) => update({ thumbnailUrl: e.target.value })}
          placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg" className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Alt Text</Label>
        <Input value={localBlock.alt} onChange={(e) => update({ alt: e.target.value })}
          placeholder="Watch our video" className="text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Align</Label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as const).map((a) => (
            <button key={a} onClick={() => update({ align: a })}
              className={`px-3 py-1.5 text-xs border ${localBlock.align === a ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300" : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800"}`}>
              {a[0].toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
