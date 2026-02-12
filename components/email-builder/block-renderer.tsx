"use client";

import { useRef, useState } from "react";
import type { EmailBlock } from "@/lib/email/blocks";
import {
  Image as ImageIcon,
  Minus,
  ArrowsVertical,
  UploadSimple,
  CircleNotch,
} from "@phosphor-icons/react";
import { toast } from "sonner";

export function BlockRenderer({
  block,
  selected,
  onUpdate,
  onClick,
}: {
  block: EmailBlock;
  selected: boolean;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <HeadingRenderer
          block={block}
          selected={selected}
          onUpdate={onUpdate}
          onClick={onClick}
        />
      );
    case "text":
      return (
        <TextRenderer
          block={block}
          selected={selected}
          onUpdate={onUpdate}
          onClick={onClick}
        />
      );
    case "button":
      return (
        <ButtonRenderer block={block} onClick={onClick} />
      );
    case "image":
      return (
        <ImageRenderer block={block} onUpdate={onUpdate} onClick={onClick} />
      );
    case "divider":
      return <DividerRenderer onClick={onClick} />;
    case "spacer":
      return (
        <SpacerRenderer block={block} onClick={onClick} />
      );
  }
}

function HeadingRenderer({
  block,
  selected,
  onUpdate,
  onClick,
}: {
  block: Extract<EmailBlock, { type: "heading" }>;
  selected: boolean;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  const Tag = `h${block.level}` as "h1" | "h2" | "h3";
  const sizes = { 1: "text-2xl", 2: "text-xl", 3: "text-lg" } as const;

  return (
    <div onClick={onClick} className="cursor-text">
      <Tag
        className={`${sizes[block.level]} font-bold leading-tight outline-none`}
        style={{ textAlign: block.align }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const newText = e.currentTarget.innerHTML;
          if (newText !== block.text) {
            onUpdate({ ...block, text: newText });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        dangerouslySetInnerHTML={{ __html: block.text }}
      />
    </div>
  );
}

function TextRenderer({
  block,
  selected,
  onUpdate,
  onClick,
}: {
  block: Extract<EmailBlock, { type: "text" }>;
  selected: boolean;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-text">
      <div
        className="text-sm leading-relaxed outline-none [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-orange-600 [&_a]:underline"
        style={{ textAlign: block.align }}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const newHtml = e.currentTarget.innerHTML;
          if (newHtml !== block.html) {
            onUpdate({ ...block, html: newHtml });
          }
        }}
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </div>
  );
}

function ButtonRenderer({
  block,
  onClick,
}: {
  block: Extract<EmailBlock, { type: "button" }>;
  onClick: () => void;
}) {
  const bg = block.bgColor || "#ea580c";
  const fg = block.textColor || "#ffffff";

  return (
    <div
      onClick={onClick}
      className="cursor-pointer"
      style={{ textAlign: block.align }}
    >
      <span
        className="inline-block font-semibold text-sm shadow-sm"
        style={{
          backgroundColor: bg,
          color: fg,
          padding: "10px 28px",
        }}
      >
        {block.text}
      </span>
    </div>
  );
}

type AssetImage = { name: string; url: string; created_at: string };

function ImageRenderer({
  block,
  onUpdate,
  onClick,
}: {
  block: Extract<EmailBlock, { type: "image" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [assets, setAssets] = useState<AssetImage[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (res.ok) {
        onUpdate({ ...block, src: json.url });
        toast.success("Image uploaded");

        // Fire-and-forget: auto-generate alt text via AI vision
        fetch("/api/ai/alt-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: json.url }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.alt) {
              onUpdate({ ...block, src: json.url, alt: data.alt });
            }
          })
          .catch(() => {});
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      uploadFile(file);
    }
  }

  async function openLibrary() {
    setShowLibrary(true);
    onClick();
    if (assets.length > 0) return;
    setLoadingAssets(true);
    try {
      const res = await fetch("/api/images");
      const json = await res.json();
      if (res.ok) setAssets(json.images || []);
    } catch {
      // silent
    } finally {
      setLoadingAssets(false);
    }
  }

  function selectAsset(url: string) {
    onUpdate({ ...block, src: url });
    setShowLibrary(false);
  }

  return (
    <div
      onClick={onClick}
      className="cursor-pointer"
      style={{ textAlign: block.align }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {block.src ? (
        <img
          src={block.src}
          alt={block.alt}
          className="inline-block max-w-full h-auto"
          style={{
            width: block.width ? `${block.width}%` : "100%",
            maxWidth: block.maxWidth ? `${block.maxWidth}px` : "100%",
          }}
        />
      ) : showLibrary ? (
        /* Asset library browser */
        <div
          className="w-full border-2 border-stone-200 bg-white p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              Asset Library
            </span>
            <button
              className="text-[11px] text-stone-400 hover:text-stone-600"
              onClick={() => setShowLibrary(false)}
            >
              Back to upload
            </button>
          </div>
          {loadingAssets ? (
            <div className="flex items-center justify-center py-8 text-stone-400">
              <CircleNotch className="h-5 w-5 animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-6 text-xs text-stone-400">
              No images uploaded yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto">
              {assets.map((asset) => (
                <button
                  key={asset.name}
                  onClick={() => selectAsset(asset.url)}
                  className="aspect-square overflow-hidden border border-stone-100 hover:border-orange-400 hover:ring-1 hover:ring-orange-400 transition-all"
                >
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Upload zone */
        <div
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed w-full py-8 text-sm transition-colors ${
            dragOver
              ? "border-orange-400 bg-orange-50/50 text-orange-500"
              : uploading
                ? "border-stone-300 bg-stone-50 text-stone-400"
                : "border-stone-300 bg-gradient-to-br from-stone-50 to-stone-100 text-stone-400 hover:border-stone-400"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <>
              <CircleNotch className="h-6 w-6 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <UploadSimple className="h-6 w-6" />
              <div className="flex gap-3 text-xs">
                <button
                  className="text-stone-500 hover:text-orange-600 font-medium underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                    fileInputRef.current?.click();
                  }}
                >
                  Upload new
                </button>
                <span className="text-stone-300">or</span>
                <button
                  className="text-stone-500 hover:text-orange-600 font-medium underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    openLibrary();
                  }}
                >
                  Browse library
                </button>
              </div>
              <span className="text-[10px] text-stone-300">
                Drop image here &middot; JPEG, PNG, GIF, WebP
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DividerRenderer({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="cursor-pointer py-1">
      <hr className="border-stone-200" />
    </div>
  );
}

function SpacerRenderer({
  block,
  onClick,
}: {
  block: Extract<EmailBlock, { type: "spacer" }>;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer flex items-center justify-center text-stone-300 border border-dashed border-stone-200"
      style={{ height: `${block.height}px` }}
    >
      <ArrowsVertical className="h-3 w-3" />
      <span className="text-[10px] ml-1">{block.height}px</span>
    </div>
  );
}
