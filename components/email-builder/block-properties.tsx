"use client";

import type { EmailBlock, SocialIconStyle } from "@/lib/email/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  Trash,
  Copy,
  UploadSimple,
  Lightning,
  CircleNotch,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useState } from "react";

const VARIABLE_TAGS = [
  "{{ first_name }}",
  "{{ last_name }}",
  "{{ email }}",
  "{{ company }}",
];

export function BlockProperties({
  block,
  onUpdate,
  onDelete,
  onDuplicate,
  onClose,
}: {
  block: EmailBlock;
  onUpdate: (updated: EmailBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-1 flex-wrap">
        {/* Alignment (for blocks that support it) */}
        {"align" in block && (
          <>
            <AlignButton
              active={block.align === "left"}
              onClick={() =>
                onUpdate({ ...block, align: "left" } as EmailBlock)
              }
            >
              <TextAlignLeft className="h-3.5 w-3.5" />
            </AlignButton>
            <AlignButton
              active={block.align === "center"}
              onClick={() =>
                onUpdate({ ...block, align: "center" } as EmailBlock)
              }
            >
              <TextAlignCenter className="h-3.5 w-3.5" />
            </AlignButton>
            <AlignButton
              active={block.align === "right"}
              onClick={() =>
                onUpdate({ ...block, align: "right" } as EmailBlock)
              }
            >
              <TextAlignRight className="h-3.5 w-3.5" />
            </AlignButton>
            <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
          </>
        )}

        {/* Type-specific controls */}
        {block.type === "heading" && (
          <>
            {([1, 2, 3] as const).map((level) => (
              <AlignButton
                key={level}
                active={block.level === level}
                onClick={() => onUpdate({ ...block, level })}
              >
                <span className="text-[11px] font-bold">H{level}</span>
              </AlignButton>
            ))}
            <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
          </>
        )}

        {block.type === "spacer" && (
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-stone-500 dark:text-stone-400">Height</Label>
            <input
              type="range"
              min={8}
              max={80}
              value={block.height}
              onChange={(e) =>
                onUpdate({ ...block, height: parseInt(e.target.value) })
              }
              className="w-20 h-1 accent-indigo-500"
            />
            <span className="text-[11px] text-stone-500 dark:text-stone-400 w-8">
              {block.height}px
            </span>
            <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-1" />
          </div>
        )}

        {/* Liquid variable insert for text/heading blocks */}
        {(block.type === "heading" || block.type === "text") && (
          <div className="flex gap-1 flex-wrap">
            {VARIABLE_TAGS.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="cursor-pointer text-[10px] px-1.5 py-0 h-5 hover:bg-white dark:hover:bg-stone-800"
                onClick={() => {
                  if (block.type === "heading") {
                    onUpdate({ ...block, text: block.text + tag });
                  } else if (block.type === "text") {
                    onUpdate({ ...block, html: block.html + tag });
                  }
                }}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Spacer to push actions right */}
        <div className="flex-1" />

        {/* Actions */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
          onClick={onDuplicate}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-stone-400 hover:text-red-500"
          onClick={onDelete}
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-4 bg-stone-200 dark:bg-stone-700 mx-0.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
          onClick={onClose}
          title="Close"
        >
          <X className="h-3.5 w-3.5" weight="bold" />
        </Button>
      </div>

      {/* Extended controls for button and image */}
      {block.type === "button" && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Button text"
              value={block.text}
              onChange={(e) => onUpdate({ ...block, text: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="flex-1">
            <Input
              placeholder="URL"
              value={block.url}
              onChange={(e) => onUpdate({ ...block, url: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div className="w-20">
            <Input
              type="color"
              value={block.bgColor || "#6366f1"}
              onChange={(e) =>
                onUpdate({ ...block, bgColor: e.target.value })
              }
              className="h-7 p-0.5 cursor-pointer"
            />
          </div>
        </div>
      )}

      {block.type === "image" && (
        <ImageProperties block={block} onUpdate={onUpdate} />
      )}

      {block.type === "social" && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase text-stone-400">Icon Style</Label>
          <div className="flex gap-1">
            {(["color", "grey", "black", "white"] as SocialIconStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => onUpdate({ ...block, iconStyle: style })}
                className={`h-7 px-2.5 text-[11px] capitalize border ${
                  (block.iconStyle || "color") === style
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
          {block.links.map((link, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                value={link.platform}
                onChange={(e) => {
                  const links = [...block.links];
                  links[i] = { ...link, platform: e.target.value };
                  onUpdate({ ...block, links });
                }}
                className="h-7 text-xs w-20"
                placeholder="platform"
              />
              <Input
                value={link.url}
                onChange={(e) => {
                  const links = [...block.links];
                  links[i] = { ...link, url: e.target.value };
                  onUpdate({ ...block, links });
                }}
                className="h-7 text-xs flex-1"
                placeholder="URL"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-stone-400 hover:text-red-500 shrink-0"
                onClick={() => {
                  const links = block.links.filter((_, j) => j !== i);
                  onUpdate({ ...block, links });
                }}
              >
                <Trash className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 text-stone-500 dark:text-stone-400"
            onClick={() => {
              onUpdate({
                ...block,
                links: [...block.links, { platform: "twitter", url: "https://" }],
              });
            }}
          >
            + Add link
          </Button>
        </div>
      )}

      {block.type === "video" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Input
              placeholder="Video URL (YouTube, Vimeo, etc.)"
              value={block.videoUrl}
              onChange={(e) => onUpdate({ ...block, videoUrl: e.target.value })}
              className="h-7 text-xs flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Thumbnail image URL"
              value={block.thumbnailUrl}
              onChange={(e) => onUpdate({ ...block, thumbnailUrl: e.target.value })}
              className="h-7 text-xs flex-1"
            />
            <Input
              placeholder="Alt text"
              value={block.alt}
              onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
              className="h-7 text-xs w-24"
            />
          </div>
        </div>
      )}

      {block.type === "quote" && (
        <div className="flex gap-2">
          <Input
            placeholder="Attribution (e.g. Jane Smith, CEO)"
            value={block.attribution}
            onChange={(e) => onUpdate({ ...block, attribution: e.target.value })}
            className="h-7 text-xs flex-1"
          />
        </div>
      )}
    </div>
  );
}

function ImageProperties({
  block,
  onUpdate,
}: {
  block: Extract<EmailBlock, { type: "image" }>;
  onUpdate: (updated: EmailBlock) => void;
}) {
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        onUpdate({ ...block, src: json.url });
        toast.success("Image uploaded");
      } else {
        toast.error(json.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Image URL"
            value={block.src}
            onChange={(e) => onUpdate({ ...block, src: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <label className="inline-flex items-center gap-1 px-2 h-7 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
          <UploadSimple className="h-3 w-3" />
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
        <button
          className="inline-flex items-center gap-1 px-2 h-7 text-xs bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors"
          onClick={() => onUpdate({ ...block, src: "" })}
          title="Clear image to browse library"
        >
          Change
        </button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Alt text"
            value={block.alt}
            onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        {block.src && (
          <AltTextButton
            imageUrl={block.src}
            onGenerated={(alt) => onUpdate({ ...block, alt })}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Label className="text-[10px] text-stone-500 dark:text-stone-400 whitespace-nowrap">Max W</Label>
        <Input
          type="number"
          placeholder="600"
          value={block.maxWidth ?? ""}
          onChange={(e) =>
            onUpdate({
              ...block,
              maxWidth: e.target.value ? parseInt(e.target.value) : undefined,
            })
          }
          className="h-7 text-xs w-20"
        />
        <span className="text-[10px] text-stone-400 dark:text-stone-500">px</span>
      </div>
    </div>
  );
}

function AltTextButton({
  imageUrl,
  onGenerated,
}: {
  imageUrl: string;
  onGenerated: (alt: string) => void;
}) {
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const json = await res.json();
      if (res.ok && json.alt) {
        onGenerated(json.alt);
        toast.success("Alt text generated");
      } else {
        toast.error("Failed to generate alt text");
      }
    } catch {
      toast.error("Failed to generate alt text");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={generating}
      className="inline-flex items-center gap-1 px-1.5 h-7 text-[10px] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors disabled:opacity-50"
      title="Generate alt text with AI"
    >
      {generating ? (
        <CircleNotch className="h-3 w-3 animate-spin" />
      ) : (
        <Lightning className="h-3 w-3" weight="fill" />
      )}
    </button>
  );
}

function AlignButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-6 w-6 flex items-center justify-center transition-colors ${
        active
          ? "bg-indigo-200 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
          : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      {children}
    </button>
  );
}
