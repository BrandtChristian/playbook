"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  FloppyDisk,
  Eye,
  CircleNotch,
  Code,
  Cursor,
  PaperPlaneTilt,
  Lightning,
  Check,
  CloudArrowUp,
} from "@phosphor-icons/react";
import { EmailBuilder } from "@/components/email-builder/email-builder";
import {
  type EmailBlock,
  serializeBlocks,
  parseHtmlToBlocks,
} from "@/lib/email/blocks";

type Template = {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  category: string | null;
  is_system: boolean;
  created_at: string;
};

const VARIABLE_TAGS = [
  "{{ first_name }}",
  "{{ last_name }}",
  "{{ email }}",
  "{{ company }}",
  "{{ phone }}",
  "{{ job_title }}",
  "{{ city }}",
  "{{ country }}",
];

export function TemplateEditor({
  template,
  fromName,
  onBack,
  onSaved,
}: {
  template: Template;
  fromName?: string;
  onBack: () => void;
  onSaved: (t: Template) => void;
}) {
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [blocks, setBlocks] = useState<EmailBlock[]>(() =>
    parseHtmlToBlocks(template.body_html)
  );
  const [editorMode, setEditorMode] = useState<"builder" | "code">("builder");
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(600);
  const [testEmail, setTestEmail] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [realLinks, setRealLinks] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Pre-fill test email from user's preferred test email
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("preferred_test_email")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }) => {
          if (profile?.preferred_test_email) {
            setTestEmail(profile.preferred_test_email);
          }
        });
    });
  }, []);

  // Track last-saved values for dirty detection
  const savedRef = useRef({ name: template.name, subject: template.subject, bodyHtml: template.body_html });
  const isDirty = name !== savedRef.current.name || subject !== savedRef.current.subject || bodyHtml !== savedRef.current.bodyHtml;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for preview iframe height messages
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (
        e.data?.type === "preview-height" &&
        typeof e.data.height === "number"
      ) {
        setPreviewHeight(Math.max(200, e.data.height + 16));
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const fetchPreview = useCallback(
    async (html: string) => {
      setLoadingPreview(true);
      try {
        const res = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bodyHtml: html,
            fromName: fromName || "Your Company",
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setPreviewHtml(json.html);
        }
      } catch {
        // Silently fail preview — user can still edit
      } finally {
        setLoadingPreview(false);
      }
    },
    [fromName]
  );

  // Debounced preview fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPreview(bodyHtml);
    }, 500);
    return () => clearTimeout(timer);
  }, [bodyHtml, fetchPreview]);

  // Check all image blocks (including inside columns) for missing alt text
  function findMissingAltText(blockList: EmailBlock[]): boolean {
    for (const b of blockList) {
      if (b.type === "image" && b.src && !b.alt?.trim()) return true;
      if (b.type === "columns") {
        if (findMissingAltText(b.left) || findMissingAltText(b.right)) return true;
      }
    }
    return false;
  }

  async function handleSave(silent = false) {
    // Validate alt text on all images (only block on manual save)
    if (!silent && editorMode === "builder" && findMissingAltText(blocks)) {
      toast.error("All images need alt text. Add it manually or click the AI button.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("templates")
      .update({ name, subject, body_html: bodyHtml })
      .eq("id", template.id)
      .select()
      .single();

    setSaving(false);
    if (error) {
      if (!silent) toast.error("Failed to save template");
    } else {
      savedRef.current = { name, subject, bodyHtml };
      if (!silent) toast.success("Template saved");
      onSaved(data);
    }
  }

  // Auto-save: debounce 2s after any change
  useEffect(() => {
    if (!isDirty) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave(true);
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subject, bodyHtml]);

  function handleBack() {
    if (isDirty) {
      setShowLeaveDialog(true);
    } else {
      onBack();
    }
  }

  async function handleSaveAndLeave() {
    await handleSave(true);
    setShowLeaveDialog(false);
    onBack();
  }

  async function handleSendTest() {
    if (!testEmail.trim()) {
      toast.error("Enter an email address");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          bodyHtml,
          to: testEmail.trim(),
          realLinks,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Test sent to ${testEmail}`);
        setShowTestForm(false);
      } else {
        toast.error(json.error || "Failed to send test");
      }
    } catch {
      toast.error("Failed to send test");
    } finally {
      setSendingTest(false);
    }
  }

  // Builder mode: blocks changed → update bodyHtml
  function handleBuilderChange(html: string) {
    setBodyHtml(html);
  }

  function handleBlocksChange(newBlocks: EmailBlock[]) {
    setBlocks(newBlocks);
  }

  // AI inserts content → either fill existing blocks (JSON) or parse HTML into new blocks
  function handleInsertBlocks(result: string) {
    // Strip markdown fences if AI wrapped the response
    let cleaned = result.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    }

    console.log("[AI Fill] Raw result:", result.slice(0, 200));
    console.log("[AI Fill] Cleaned:", cleaned.slice(0, 200));
    console.log("[AI Fill] Blocks on canvas:", blocks.map(b => b.type));

    // Structure-aware: AI returned JSON array to fill existing blocks
    if (cleaned.startsWith("[")) {
      try {
        const fills = JSON.parse(cleaned);
        console.log("[AI Fill] Parsed JSON:", fills);

        const filledBlocks = blocks.map((block, i) => {
          const raw = fills[i];
          if (!raw) return block;

          // Handle both flat { "text": "..." } and nested { "heading": { "text": "..." } }
          const fill = raw[block.type] || raw;

          console.log(`[AI Fill] Block ${i} (${block.type}):`, fill);

          switch (block.type) {
            case "heading":
              return { ...block, text: fill?.text ?? block.text };
            case "text":
              return { ...block, html: fill?.html ?? block.html };
            case "button":
              return {
                ...block,
                text: fill?.text ?? block.text,
                url: fill?.url ?? block.url,
              };
            default:
              return block;
          }
        });
        setBlocks(filledBlocks);
        setBodyHtml(serializeBlocks(filledBlocks));
        return;
      } catch (e) {
        console.error("[AI Fill] JSON parse failed:", e);
        // Fall through to HTML parsing
      }
    }

    console.log("[AI Fill] Falling through to HTML parsing");
    // Fallback: free-form HTML → parse into new blocks
    const newBlocks = parseHtmlToBlocks(cleaned);
    setBlocks(newBlocks);
    setBodyHtml(serializeBlocks(newBlocks));
  }

  // AI generates full email from scratch
  function handleGenerateEmail(html: string) {
    const newBlocks = parseHtmlToBlocks(html);
    setBlocks(newBlocks);
    setBodyHtml(serializeBlocks(newBlocks));
  }

  // AI improves a single block
  function handleImproveBlock(blockId: string, result: string) {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    let updated: EmailBlock;
    switch (block.type) {
      case "heading":
        updated = { ...block, text: result.trim() };
        break;
      case "text":
        updated = { ...block, html: result.trim() };
        break;
      case "button": {
        try {
          const parsed = JSON.parse(result);
          updated = {
            ...block,
            text: parsed.text || block.text,
            url: parsed.url || block.url,
          };
        } catch {
          updated = { ...block, text: result.trim() };
        }
        break;
      }
      default:
        return;
    }

    const newBlocks = blocks.map((b) => (b.id === blockId ? updated : b));
    setBlocks(newBlocks);
    setBodyHtml(serializeBlocks(newBlocks));
  }

  // AI generates subject line from body content
  const [generatingSubject, setGeneratingSubject] = useState(false);
  async function handleGenerateSubject() {
    if (!bodyHtml.trim()) {
      toast.error("Add some content first");
      return;
    }
    setGeneratingSubject(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subject",
          prompt: `Based on this email body, generate subject lines:\n\n${bodyHtml.slice(0, 500)}`,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const firstLine = json.result.split("\n").find((l: string) => l.trim());
        if (firstLine) {
          setSubject(firstLine.replace(/^\d+\.\s*/, "").trim());
          toast.success("Subject generated");
        }
      }
    } catch {
      toast.error("Failed to generate subject");
    } finally {
      setGeneratingSubject(false);
    }
  }

  // Handle mode switch
  function handleModeSwitch(mode: string) {
    if (mode === "builder" && editorMode === "code") {
      setBlocks(parseHtmlToBlocks(bodyHtml));
    }
    setEditorMode(mode as "builder" | "code");
  }

  function insertVariable(tag: string) {
    setBodyHtml((prev) => prev + tag);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Edit Template
            </h1>
            <p className="text-sm text-muted-foreground">{template.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showTestForm ? (
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="you@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="h-8 w-48 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendTest();
                  if (e.key === "Escape") setShowTestForm(false);
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setRealLinks(!realLinks)}
                className={`h-8 px-2 text-[10px] font-medium border rounded-sm whitespace-nowrap transition-colors ${
                  realLinks
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-input hover:bg-muted"
                }`}
                title="Include working unsubscribe and preference center links"
              >
                Real links
              </button>
              <Button
                size="sm"
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail.trim()}
              >
                {sendingTest ? (
                  <CircleNotch className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTestForm(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTestForm(true)}
              disabled={!subject.trim() || !bodyHtml.trim()}
            >
              <PaperPlaneTilt className="mr-1.5 h-3.5 w-3.5" />
              Send Test
            </Button>
          )}
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <CloudArrowUp className="h-3.5 w-3.5 animate-pulse" />
                Saving...
              </span>
            ) : isDirty ? (
              <span className="flex items-center gap-1.5 text-xs text-amber-500">
                <FloppyDisk className="h-3.5 w-3.5" />
                Unsaved
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                <Check className="h-3.5 w-3.5" weight="bold" />
                Saved
              </span>
            )}
            <Button onClick={() => handleSave(false)} disabled={saving || !isDirty} size="sm" variant="outline">
              <FloppyDisk className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="tplName">Name</Label>
          <Input
            id="tplName"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tplSubject">Subject</Label>
          <div className="flex gap-1.5">
            <Input
              id="tplSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-stone-400 dark:text-stone-500 hover:text-indigo-500 dark:hover:text-indigo-400"
              onClick={handleGenerateSubject}
              disabled={generatingSubject || !bodyHtml.trim()}
              title="Generate subject with AI"
            >
              {generatingSubject ? (
                <CircleNotch className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Lightning className="h-3.5 w-3.5" weight="fill" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Tabs
            value={editorMode}
            onValueChange={handleModeSwitch}
          >
            <TabsList className="h-8">
              <TabsTrigger value="builder" className="text-xs gap-1.5">
                <Cursor className="h-3.5 w-3.5" />
                Builder
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs gap-1.5">
                <Code className="h-3.5 w-3.5" />
                Code
              </TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="mt-3">
              <EmailBuilder
                blocks={blocks}
                onChange={handleBuilderChange}
                onBlocksChange={handleBlocksChange}
                onGenerateEmail={handleGenerateEmail}
                onFillBlocks={handleInsertBlocks}
                onImproveBlock={handleImproveBlock}
              />
            </TabsContent>

            <TabsContent value="code" className="mt-3 space-y-3">
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground self-center">
                  Insert:
                </span>
                {VARIABLE_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center border px-2.5 py-0.5 text-xs cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => insertVariable(tag)}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Textarea
                className="min-h-[400px] font-mono text-sm resize-none"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </TabsContent>
          </Tabs>

        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              <Eye className="h-3.5 w-3.5" />
              Preview
              {loadingPreview && (
                <CircleNotch className="h-3 w-3 animate-spin" />
              )}
            </Label>
          </div>

          {/* Device frame */}
          <div>
            <div className="bg-stone-800 p-3 pb-0 shadow-xl shadow-stone-900/20">
              {/* Browser chrome bar */}
              <div className="flex items-center gap-1.5 pb-2.5">
                <div className="w-2 h-2 rounded-full bg-stone-600" />
                <div className="w-2 h-2 rounded-full bg-stone-600" />
                <div className="w-2 h-2 rounded-full bg-stone-600" />
                <div className="flex-1 mx-3 h-4 bg-stone-700 flex items-center px-2">
                  <span className="text-[9px] text-stone-500 truncate">
                    mail.example.com
                  </span>
                </div>
              </div>

              {/* Email content */}
              <div className="bg-[#f6f6f6] dark:bg-stone-900">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: `${previewHeight}px` }}
                    sandbox="allow-same-origin allow-scripts"
                    title="Email preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[200px] text-sm text-stone-400 gap-2">
                    <Eye className="h-6 w-6 text-stone-300 dark:text-stone-600" />
                    {loadingPreview
                      ? "Rendering..."
                      : "Preview appears here"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes to this template. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowLeaveDialog(false); onBack(); }}>
              Leave without saving
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveAndLeave}>
              Save and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
