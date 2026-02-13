"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { EmailBlock } from "@/lib/email/blocks";
import {
  Image as ImageIcon,
  Minus,
  ArrowsVertical,
  UploadSimple,
  CircleNotch,
  PlayCircle,
  Quotes,
  ShareNetwork,
  Code,
  Columns,
  CaretUp,
  CaretDown,
  X,
  LinkedinLogo,
  XLogo,
  FacebookLogo,
  InstagramLogo,
  YoutubeLogo,
  TiktokLogo,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { AssetSelector } from "@/components/assets/asset-selector";

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
    case "social":
      return <SocialRenderer block={block} onClick={onClick} />;
    case "columns":
      return (
        <ColumnsRenderer
          block={block}
          onUpdate={onUpdate}
          onClick={onClick}
        />
      );
    case "quote":
      return (
        <QuoteRenderer
          block={block}
          onUpdate={onUpdate}
          onClick={onClick}
        />
      );
    case "video":
      return <VideoRenderer block={block} onClick={onClick} />;
    case "html":
      return (
        <HtmlRenderer
          block={block}
          onUpdate={onUpdate}
          onClick={onClick}
        />
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
      <style>{`.text-block-content p { margin-bottom: 0.5rem; } .text-block-content ul { list-style: disc; padding-left: 1.25rem; } .text-block-content ol { list-style: decimal; padding-left: 1.25rem; } .text-block-content a { color: #6366f1; text-decoration: underline; }`}</style>
      <div
        className="text-block-content text-sm leading-relaxed outline-none"
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
  const bg = block.bgColor || "#6366f1";
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
  const [showAssetSelector, setShowAssetSelector] = useState(false);

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

  return (
    <>
    <AssetSelector
      isOpen={showAssetSelector}
      onClose={() => setShowAssetSelector(false)}
      onSelect={(asset) => {
        onUpdate({ ...block, src: asset.url });
        // Auto-generate alt text
        fetch("/api/ai/alt-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: asset.url }),
        })
          .then((r) => r.json())
          .then((data) => { if (data.alt) onUpdate({ ...block, src: asset.url, alt: data.alt }); })
          .catch(() => {});
      }}
    />
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
        <div
          className="relative group inline-block"
          style={{
            maxWidth: block.maxWidth ? `${block.maxWidth}px` : "100%",
            width: block.width && block.width < 100 ? `${block.width}%` : "100%",
          }}
        >
          {!block.alt?.trim() && (
            <span className="absolute top-1 left-1 z-10 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 leading-none">
              Missing alt text
            </span>
          )}
          <img
            src={block.src}
            alt={block.alt}
            className={`max-h-[300px] w-auto max-w-full h-auto block object-contain ${
              block.align === "center" ? "mx-auto" : block.align === "right" ? "ml-auto" : ""
            }`}
          />
          <span className="absolute bottom-1 right-1 z-10 bg-black/60 text-white text-[9px] px-1.5 py-0.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {block.width && block.width < 100 ? `${block.width}%` : ""}{block.width && block.width < 100 && block.maxWidth ? " · " : ""}{block.maxWidth ? `max ${block.maxWidth}px` : ""}
          </span>
        </div>
      ) : (
        /* Upload zone */
        <div
          className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed w-full py-8 text-sm transition-colors ${
            dragOver
              ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/50 text-indigo-500"
              : uploading
                ? "border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500"
                : "border-stone-300 dark:border-stone-700 bg-gradient-to-br from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-900 text-stone-400 dark:text-stone-500 hover:border-stone-400"
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
                  className="text-stone-500 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                    fileInputRef.current?.click();
                  }}
                >
                  Upload new
                </button>
                <span className="text-stone-300 dark:text-stone-600">or</span>
                <button
                  className="text-stone-500 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAssetSelector(true);
                  }}
                >
                  Browse assets
                </button>
              </div>
              <span className="text-[10px] text-stone-300 dark:text-stone-600">
                Drop image here &middot; JPEG, PNG, GIF, WebP
              </span>
            </>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function DividerRenderer({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} className="cursor-pointer py-1">
      <hr className="border-stone-200 dark:border-stone-700" />
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
      className="cursor-pointer flex items-center justify-center text-stone-300 dark:text-stone-600 border border-dashed border-stone-200 dark:border-stone-700"
      style={{ height: `${block.height}px` }}
    >
      <ArrowsVertical className="h-3 w-3" />
      <span className="text-[10px] ml-1">{block.height}px</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLATFORM_ICONS: Record<string, React.ComponentType<any>> = {
  twitter: XLogo,
  facebook: FacebookLogo,
  instagram: InstagramLogo,
  linkedin: LinkedinLogo,
  youtube: YoutubeLogo,
  tiktok: TiktokLogo,
};

const BRAND_COLORS: Record<string, string> = {
  twitter: "#000000",
  facebook: "#1877F2",
  instagram: "#E4405F",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#000000",
};

function SocialRenderer({
  block, onClick,
}: {
  block: Extract<EmailBlock, { type: "social" }>;
  onClick: () => void;
}) {
  const style = block.iconStyle || "color";
  return (
    <div onClick={onClick} className="cursor-pointer" style={{ textAlign: block.align }}>
      <div className="inline-flex items-center gap-2 py-2">
        {block.links.map((link, i) => {
          const Icon = PLATFORM_ICONS[link.platform];
          const iconColor =
            style === "color" ? (BRAND_COLORS[link.platform] || "#78716c") :
            style === "grey" ? "#78716c" :
            style === "black" ? "#1c1917" :
            "#ffffff";
          const bgColor = style === "white" ? "#1c1917" : "transparent";
          return (
            <span key={i} className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: bgColor }} title={link.platform}>
              {Icon ? <Icon className="h-5 w-5" weight="fill" style={{ color: iconColor }} /> : <span className="text-xs font-bold" style={{ color: iconColor }}>{link.platform[0].toUpperCase()}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Block types allowed inside columns (no nested columns)
const COLUMN_BLOCK_TYPES = [
  { type: "text", label: "Text" },
  { type: "heading", label: "Heading" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
] as const;

function ColumnZone({
  children,
  side,
  block,
  onUpdate,
}: {
  children: EmailBlock[];
  side: "left" | "right";
  block: Extract<EmailBlock, { type: "columns" }>;
  onUpdate: (updated: EmailBlock) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [dragOverZone, setDragOverZone] = useState(false);
  const [editingChild, setEditingChild] = useState<{ index: number; block: EmailBlock } | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `col-${block.id}-${side}`,
    data: { columnBlockId: block.id, side },
  });

  const combinedRef = (el: HTMLDivElement | null) => {
    setDropRef(el);
    (zoneRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };

  function addChild(type: string) {
    const { BLOCK_PALETTE } = require("@/lib/email/blocks");
    const paletteItem = BLOCK_PALETTE.find((p: { type: string }) => p.type === type);
    if (!paletteItem) return;
    const newChild = paletteItem.factory();
    const newChildren = [...children, newChild];
    onUpdate({ ...block, [side]: newChildren });
    setShowAdd(false);
    if (type === "image" || type === "video") {
      setEditingChild({ index: newChildren.length - 1, block: newChild });
    }
  }

  function removeChild(index: number) {
    onUpdate({ ...block, [side]: children.filter((_, i) => i !== index) });
  }

  function moveChild(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= children.length) return;
    const arr = [...children];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    onUpdate({ ...block, [side]: arr });
  }

  function updateChild(index: number, updated: EmailBlock) {
    const arr = [...children];
    arr[index] = updated;
    onUpdate({ ...block, [side]: arr });
  }

  function getInsertIndex(clientY: number): number {
    if (!zoneRef.current) return children.length;
    const els = zoneRef.current.querySelectorAll("[data-col-child]");
    for (let i = 0; i < els.length; i++) {
      const rect = els[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return children.length;
  }

  async function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverZone(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const insertAt = getInsertIndex(e.clientY);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        const imgBlock: EmailBlock = {
          id: crypto.randomUUID(), type: "image", src: json.url, alt: "",
          width: 100, maxWidth: 280, align: "center" as const,
        };
        const arr = [...children];
        arr.splice(insertAt, 0, imgBlock);
        onUpdate({ ...block, [side]: arr });
        toast.success("Image added");
        fetch("/api/ai/alt-text", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: json.url }),
        }).then((r) => r.json()).then((data) => {
          if (data.alt) { const u = [...arr]; u[insertAt] = { ...imgBlock, alt: data.alt }; onUpdate({ ...block, [side]: u }); }
        }).catch(() => {});
      }
    } catch { toast.error("Upload failed"); }
  }

  // Lazy import to avoid circular deps
  const { BlockEditModal } = require("./block-edit-modal");

  return (
    <>
      <div
        ref={combinedRef}
        className={`border border-dashed p-2 min-h-[70px] flex flex-col gap-1.5 transition-colors ${
          isOver || dragOverZone ? "border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/30" : "border-stone-200 dark:border-stone-700"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOverZone(true); }}
        onDragLeave={() => setDragOverZone(false)}
        onDrop={handleFileDrop}
      >
        {children.length === 0 && !isOver && !dragOverZone ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-stone-300 dark:text-stone-600 py-4">Drop blocks or images here</div>
        ) : children.length === 0 && (isOver || dragOverZone) ? (
          <div className="flex-1 flex items-center justify-center text-[10px] text-indigo-500 font-medium py-4">Drop here</div>
        ) : (
          children.map((child, i) => (
            <div key={child.id} className="group/child relative" data-col-child>
              <div className="absolute right-0 -top-1 flex items-center gap-0.5 opacity-0 group-hover/child:opacity-100 transition-opacity z-10 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm">
                {i > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); moveChild(i, -1); }}
                    className="h-5 w-5 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700" title="Move up">
                    <CaretUp className="h-3 w-3" weight="bold" />
                  </button>
                )}
                {i < children.length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); moveChild(i, 1); }}
                    className="h-5 w-5 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700" title="Move down">
                    <CaretDown className="h-3 w-3" weight="bold" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); removeChild(i); }}
                  className="h-5 w-5 flex items-center justify-center text-stone-400 dark:text-stone-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950" title="Remove">
                  <X className="h-3 w-3" weight="bold" />
                </button>
              </div>
              <div className="hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors"
                onClick={() => { if (child.type === "image" || child.type === "video") setEditingChild({ index: i, block: child }); }}>
                <BlockRenderer block={child} selected={false}
                  onUpdate={(updated) => updateChild(i, updated)}
                  onClick={() => { if (child.type === "image" || child.type === "video") setEditingChild({ index: i, block: child }); }} />
              </div>
            </div>
          ))
        )}

        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
            className="w-full py-1.5 text-[11px] text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 border border-dashed border-stone-200 dark:border-stone-700 transition-colors font-medium">
            + Add block
          </button>
          {showAdd && (
            <div className="absolute bottom-full left-0 right-0 z-20 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 shadow-lg py-1 mb-1">
              {COLUMN_BLOCK_TYPES.map(({ type, label }) => (
                <button key={type} onClick={(e) => { e.stopPropagation(); addChild(type); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 font-medium">
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {editingChild && (
        <BlockEditModal
          block={editingChild.block}
          open={true}
          onClose={() => setEditingChild(null)}
          onUpdate={(updated: EmailBlock) => {
            updateChild(editingChild.index, updated);
            setEditingChild({ ...editingChild, block: updated });
          }}
        />
      )}
    </>
  );
}

function ColumnsRenderer({
  block, onUpdate, onClick,
}: {
  block: Extract<EmailBlock, { type: "columns" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-default">
      <div className="grid grid-cols-2 gap-2">
        <ColumnZone children={block.left} side="left" block={block} onUpdate={onUpdate} />
        <ColumnZone children={block.right} side="right" block={block} onUpdate={onUpdate} />
      </div>
    </div>
  );
}

function QuoteRenderer({
  block, onUpdate, onClick,
}: {
  block: Extract<EmailBlock, { type: "quote" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-text">
      <div className="py-1" style={{ borderLeft: "3px solid #6366f1", paddingLeft: "16px", textAlign: block.align }}>
        <div
          className="text-sm italic text-stone-600 dark:text-stone-300 outline-none"
          contentEditable suppressContentEditableWarning
          onBlur={(e) => {
            const t = e.currentTarget.textContent || "";
            if (t !== block.text) onUpdate({ ...block, text: t.replace(/^[""\u201C]|[""\u201D]$/g, "") });
          }}
        >
          &ldquo;{block.text}&rdquo;
        </div>
        <div
          className="text-xs text-stone-400 dark:text-stone-500 mt-1 outline-none"
          contentEditable suppressContentEditableWarning
          onBlur={(e) => {
            const a = (e.currentTarget.textContent || "").replace(/^—\s*/, "");
            if (a !== block.attribution) onUpdate({ ...block, attribution: a });
          }}
        >
          — {block.attribution}
        </div>
      </div>
    </div>
  );
}

function VideoRenderer({
  block, onClick,
}: {
  block: Extract<EmailBlock, { type: "video" }>;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-pointer" style={{ textAlign: block.align }}>
      {block.thumbnailUrl ? (
        <div className="relative inline-block">
          <img src={block.thumbnailUrl} alt={block.alt} className="max-w-full h-auto" />
          <div className="absolute inset-0 flex items-center justify-center">
            <PlayCircle className="h-12 w-12 text-white drop-shadow-lg" weight="fill" />
          </div>
        </div>
      ) : (
        <div className="inline-flex flex-col items-center justify-center gap-2 border-2 border-dashed border-stone-300 bg-gradient-to-br from-stone-800 to-stone-900 text-stone-300 py-12 w-full">
          <PlayCircle className="h-10 w-10" weight="fill" />
          <span className="text-xs">Video thumbnail</span>
          <span className="text-[10px] text-stone-500 dark:text-stone-400">Set thumbnail & URL in properties</span>
        </div>
      )}
    </div>
  );
}

function HtmlRenderer({
  block, onUpdate, onClick,
}: {
  block: Extract<EmailBlock, { type: "html" }>;
  onUpdate: (updated: EmailBlock) => void;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} className="cursor-text">
      <div className="flex items-center gap-1.5 text-[10px] text-stone-400 dark:text-stone-500 mb-1">
        <Code className="h-3 w-3" />
        Custom HTML
      </div>
      <textarea
        className="w-full font-mono text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-2 resize-none outline-none focus:border-stone-300 min-h-[60px]"
        value={block.code}
        onChange={(e) => onUpdate({ ...block, code: e.target.value })}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
