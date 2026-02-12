"use client";

import { useState } from "react";
import { Lightning, CircleNotch } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { EmailBlock } from "@/lib/email/blocks";

type AiMode = "generate" | "fill" | "improve";

const IMPROVABLE_TYPES = new Set(["heading", "text", "button"]);

function getMode(
  blocks: EmailBlock[],
  selectedBlockId: string | null
): AiMode {
  if (selectedBlockId) {
    const block = blocks.find((b) => b.id === selectedBlockId);
    if (block && IMPROVABLE_TYPES.has(block.type)) {
      return "improve";
    }
  }
  if (blocks.length > 0) return "fill";
  return "generate";
}

function getPlaceholder(mode: AiMode, selectedBlock?: EmailBlock): string {
  switch (mode) {
    case "generate":
      return "Describe your email and AI will build it...";
    case "fill":
      return "Describe content to fill all blocks...";
    case "improve": {
      const type = selectedBlock?.type || "block";
      return `Improve this ${type}...`;
    }
  }
}

function getModeLabel(mode: AiMode): string {
  switch (mode) {
    case "generate":
      return "Generate email";
    case "fill":
      return "Fill blocks";
    case "improve":
      return "Improve block";
  }
}

export function AiPromptBar({
  blocks,
  selectedBlockId,
  onGenerateEmail,
  onFillBlocks,
  onImproveBlock,
}: {
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  onGenerateEmail: (html: string) => void;
  onFillBlocks: (result: string) => void;
  onImproveBlock: (blockId: string, result: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const mode = getMode(blocks, selectedBlockId);
  const selectedBlock = selectedBlockId
    ? blocks.find((b) => b.id === selectedBlockId)
    : undefined;

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    try {
      let body: Record<string, unknown>;

      switch (mode) {
        case "generate":
          body = { type: "body", prompt: prompt.trim() };
          break;
        case "fill":
          body = {
            type: "body",
            prompt: prompt.trim(),
            structure: blocks.map((b) => b.type),
          };
          break;
        case "improve": {
          if (!selectedBlock) return;
          let currentContent = "";
          if (selectedBlock.type === "heading") currentContent = selectedBlock.text;
          else if (selectedBlock.type === "text") currentContent = selectedBlock.html;
          else if (selectedBlock.type === "button")
            currentContent = JSON.stringify({
              text: selectedBlock.text,
              url: selectedBlock.url,
            });
          body = {
            type: "improve-block",
            prompt: prompt.trim(),
            blockType: selectedBlock.type,
            currentContent,
          };
          break;
        }
      }

      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error || "AI generation failed");
        return;
      }

      switch (mode) {
        case "generate":
          onGenerateEmail(json.result);
          break;
        case "fill":
          onFillBlocks(json.result);
          break;
        case "improve":
          if (selectedBlockId) {
            onImproveBlock(selectedBlockId, json.result);
          }
          break;
      }

      setPrompt("");
      toast.success(
        mode === "generate"
          ? "Email generated"
          : mode === "fill"
            ? "Blocks filled"
            : "Block improved"
      );
    } catch {
      toast.error("AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2 pb-3 mb-1 border-b border-stone-100 dark:border-stone-800">
      <div className="flex items-center gap-1.5 text-indigo-500">
        <Lightning className="h-3.5 w-3.5" weight="fill" />
        <span className="text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap">
          {getModeLabel(mode)}
        </span>
      </div>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
          }
        }}
        placeholder={getPlaceholder(mode, selectedBlock)}
        disabled={generating}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600 disabled:opacity-50"
      />
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="shrink-0 h-7 px-3 text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5"
      >
        {generating ? (
          <CircleNotch className="h-3 w-3 animate-spin" />
        ) : (
          <Lightning className="h-3 w-3" weight="fill" />
        )}
        {generating ? "Generating..." : "Go"}
      </button>
    </div>
  );
}
