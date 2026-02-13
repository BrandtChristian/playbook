"use client";

import { useState, useEffect, useRef } from "react";
import { Lightning, CircleNotch, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { ParsedVariable } from "@/lib/agillic/webdav";

type AiAgillicMode = "fill" | "improve" | "subject";

function getPlaceholder(mode: AiAgillicMode, fieldName?: string): string {
  switch (mode) {
    case "fill":
      return "Describe the email content and AI will fill all fields...";
    case "improve":
      return `Improve "${fieldName ?? "this field"}"...`;
    case "subject":
      return "Describe the email to generate subject lines...";
  }
}

function getModeLabel(mode: AiAgillicMode): string {
  switch (mode) {
    case "fill":
      return "Fill all fields";
    case "improve":
      return "Improve field";
    case "subject":
      return "Generate subjects";
  }
}

export function AiAgillicPromptBar({
  variables,
  selectedVariable,
  currentFieldValue,
  currentValues,
  mode: forcedMode,
  templateName,
  onFillVariables,
  onImproveField,
  onSelectSubject,
  onClearSelection,
}: {
  variables: ParsedVariable[];
  selectedVariable: ParsedVariable | null;
  currentFieldValue?: string;
  currentValues?: Record<string, string>;
  mode?: AiAgillicMode;
  templateName?: string;
  onFillVariables: (values: Record<string, string>) => void;
  onImproveField: (raw: string, content: string) => void;
  onSelectSubject: (subjects: string[]) => void;
  onClearSelection: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine mode from context
  const mode: AiAgillicMode = forcedMode ?? (selectedVariable ? "improve" : "fill");

  // Focus input when mode changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [mode, selectedVariable]);

  // Get the label for the selected field
  const selectedFieldLabel = selectedVariable
    ? selectedVariable.fieldName
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : undefined;

  async function handleGenerate() {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    try {
      let body: Record<string, unknown>;

      switch (mode) {
        case "fill":
          body = {
            type: "fill-agillic",
            prompt: prompt.trim(),
            templateName,
            agillicVariables: variables.map((v) => ({
              raw: v.raw,
              fieldName: v.fieldName,
              type: v.type,
              dataType: v.dataType,
              namespace: v.namespace,
            })),
          };
          break;
        case "improve": {
          if (!selectedVariable) return;
          body = {
            type: "improve-agillic-field",
            prompt: prompt.trim(),
            templateName,
            currentContent: currentFieldValue ?? "",
            agillicFieldName: selectedVariable.fieldName,
            agillicFieldDataType: selectedVariable.dataType ?? "STRING",
            agillicFieldType: selectedVariable.type,
          };
          break;
        }
        case "subject": {
          // Build context from current variable values so the AI knows the email content
          let emailContext = "";
          if (currentValues && Object.keys(currentValues).length > 0) {
            const contentParts: string[] = [];
            for (const v of variables) {
              const val = currentValues[v.raw];
              if (val && v.dataType !== "IMAGE") {
                const label = v.fieldName.replace(/-/g, " ").replace(/_/g, " ");
                contentParts.push(`${label}: ${val}`);
              }
            }
            if (contentParts.length > 0) {
              emailContext = contentParts.join("\n");
            }
          }
          body = {
            type: "subject",
            prompt: prompt.trim(),
            templateName,
            context: emailContext ? emailContext.slice(0, 3800) : undefined,
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
        if (json.code === "RATE_LIMITED") {
          toast.error(json.error || "Rate limited. Try again shortly.");
        } else {
          toast.error(json.error || "AI generation failed");
        }
        return;
      }

      switch (mode) {
        case "fill": {
          const values = JSON.parse(json.result) as Record<string, string>;
          // Filter out null values (IMAGE fields)
          const filtered: Record<string, string> = {};
          for (const [key, val] of Object.entries(values)) {
            if (val !== null && val !== undefined) {
              filtered[key] = String(val);
            }
          }
          onFillVariables(filtered);
          toast.success("AI filled all text fields");
          setPrompt("");
          break;
        }
        case "improve": {
          if (!selectedVariable) return;
          onImproveField(selectedVariable.raw, json.result);
          toast.success("Field improved");
          setPrompt("");
          onClearSelection();
          break;
        }
        case "subject": {
          const subjects = json.subjects as string[];
          if (subjects && subjects.length > 0) {
            onSelectSubject(subjects);
            toast.success(`Generated ${subjects.length} subject lines`);
          } else {
            toast.error("No subject lines generated");
          }
          setPrompt("");
          break;
        }
      }
    } catch (err) {
      console.error("AI generation error:", err);
      toast.error("AI generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Mode indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightning className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-medium text-muted-foreground">
            {getModeLabel(mode)}
          </span>
        </div>
        {(selectedVariable || forcedMode) && (
          <button
            type="button"
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        )}
      </div>

      {/* Prompt input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          placeholder={getPlaceholder(mode, selectedFieldLabel)}
          disabled={generating}
          className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className="inline-flex items-center justify-center rounded-md h-8 px-3 text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? (
            <CircleNotch className="h-4 w-4 animate-spin" />
          ) : (
            <Lightning className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
