"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Lightning,
  CircleNotch,
  ArrowsClockwise,
  TextT,
  Article,
} from "@phosphor-icons/react";

type AiMode = "body" | "subject" | "improve";

const QUICK_PROMPTS = [
  "Welcome email for new signups, friendly and warm",
  "Monthly newsletter update, professional tone",
  "Win-back email for inactive users, with urgency",
  "Product launch announcement, exciting tone",
  "Thank you email after purchase",
];

export function AiContentPanel({
  currentBody,
  onInsertBody,
  onInsertSubject,
}: {
  currentBody: string;
  onInsertBody: (html: string) => void;
  onInsertSubject: (subject: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<AiMode>("body");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Enter a description");
      return;
    }

    setGenerating(true);
    setResult("");

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: mode,
          prompt: prompt.trim(),
          currentContent: mode === "improve" ? currentBody : undefined,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setResult(json.result);
      } else {
        toast.error(json.error || "AI generation failed");
      }
    } catch {
      toast.error("Failed to connect to AI");
    } finally {
      setGenerating(false);
    }
  }

  function handleInsert() {
    if (!result) return;

    if (mode === "subject") {
      // Take the first subject line suggestion (strip number prefix)
      const firstLine = result.split("\n").find((l) => l.trim());
      if (firstLine) {
        const cleaned = firstLine.replace(/^\d+\.\s*/, "").trim();
        onInsertSubject(cleaned);
        toast.success("Subject line inserted");
      }
    } else {
      onInsertBody(result);
      toast.success("Content inserted into editor");
    }
    setResult("");
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Lightning className="h-4 w-4" weight="fill" />
          <CardTitle className="text-base">AI Content Assistant</CardTitle>
        </div>
        <CardDescription>
          Describe what you want and let AI write it for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mode selector */}
        <div className="flex gap-1.5">
          <Button
            variant={mode === "body" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("body")}
          >
            <Article className="mr-1.5 h-3.5 w-3.5" />
            Write Body
          </Button>
          <Button
            variant={mode === "subject" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("subject")}
          >
            <TextT className="mr-1.5 h-3.5 w-3.5" />
            Subject Lines
          </Button>
          <Button
            variant={mode === "improve" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("improve")}
            disabled={!currentBody.trim()}
          >
            <ArrowsClockwise className="mr-1.5 h-3.5 w-3.5" />
            Improve
          </Button>
        </div>

        {/* Quick prompts */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_PROMPTS.slice(0, 3).map((qp) => (
            <Badge
              key={qp}
              variant="outline"
              className="cursor-pointer hover:bg-muted text-xs"
              onClick={() => setPrompt(qp)}
            >
              {qp.split(",")[0]}
            </Badge>
          ))}
        </div>

        {/* Prompt input */}
        <Textarea
          placeholder={
            mode === "improve"
              ? "How should the email be improved? (e.g., 'make it shorter', 'add urgency')"
              : "Describe the email you want (e.g., 'welcome email for new signups, friendly tone')"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="min-h-[80px] text-sm resize-none"
        />

        <Button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="w-full"
        >
          {generating ? (
            <>
              <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Lightning className="mr-2 h-4 w-4" weight="fill" />
              Generate{" "}
              {mode === "subject"
                ? "Subject Lines"
                : mode === "improve"
                  ? "Improved Version"
                  : "Email Body"}
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <Label className="text-xs">AI Result</Label>
            <div className="border p-3 text-sm max-h-60 overflow-y-auto whitespace-pre-wrap bg-muted/30 font-mono text-xs">
              {result}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleInsert}>
                {mode === "subject"
                  ? "Use First Subject"
                  : mode === "improve"
                    ? "Replace Body"
                    : "Insert into Editor"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResult("");
                  handleGenerate();
                }}
              >
                <ArrowsClockwise className="mr-1.5 h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
