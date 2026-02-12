"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  FloppyDisk,
  Eye,
  CircleNotch,
  Code,
  Cursor,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { AiContentPanel } from "@/components/ai-content-panel";
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
  const [previewHeight, setPreviewHeight] = useState(460);
  const [testEmail, setTestEmail] = useState("");
  const [showTestForm, setShowTestForm] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Listen for preview iframe height messages
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (
        e.data?.type === "preview-height" &&
        typeof e.data.height === "number"
      ) {
        setPreviewHeight(Math.max(460, e.data.height + 16));
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

  async function handleSave() {
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
      toast.error("Failed to save template");
    } else {
      toast.success("Template saved");
      onSaved(data);
    }
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
    const trimmed = result.trim();

    // Structure-aware: AI returned JSON array to fill existing blocks
    if (trimmed.startsWith("[")) {
      try {
        const fills = JSON.parse(trimmed);
        const filledBlocks = blocks.map((block, i) => {
          const fill = fills[i];
          if (!fill) return block;
          switch (block.type) {
            case "heading":
              return { ...block, text: fill.text || block.text };
            case "text":
              return { ...block, html: fill.html || block.html };
            case "button":
              return {
                ...block,
                text: fill.text || block.text,
                url: fill.url || block.url,
              };
            default:
              return block;
          }
        });
        setBlocks(filledBlocks);
        setBodyHtml(serializeBlocks(filledBlocks));
        return;
      } catch {
        // Fall through to HTML parsing
      }
    }

    // Fallback: free-form HTML → parse into new blocks
    const newBlocks = parseHtmlToBlocks(trimmed);
    setBlocks(newBlocks);
    setBodyHtml(serializeBlocks(newBlocks));
  }

  // AI inserts raw HTML (code mode fallback)
  function handleInsertBody(html: string) {
    setBodyHtml(html);
    if (editorMode === "builder") {
      setBlocks(parseHtmlToBlocks(html));
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
          <Button variant="ghost" size="icon" onClick={onBack}>
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
          <Button onClick={handleSave} disabled={saving}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
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
          <Input
            id="tplSubject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr] min-h-[500px]">
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

          {/* AI Content Assistant */}
          <AiContentPanel
            currentBody={bodyHtml}
            onInsertBody={handleInsertBody}
            onInsertSubject={(s) => setSubject(s)}
            onInsertBlocks={
              editorMode === "builder" ? handleInsertBlocks : undefined
            }
            blockStructure={
              editorMode === "builder" && blocks.length > 0
                ? blocks.map((b) => b.type)
                : undefined
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              <Eye className="h-3.5 w-3.5" />
              Preview
              {loadingPreview && (
                <CircleNotch className="h-3 w-3 animate-spin" />
              )}
            </Label>
          </div>

          {/* Device frame */}
          <div className="sticky top-4">
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
              <div className="bg-[#f6f6f6]">
                {previewHtml ? (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: `${previewHeight}px` }}
                    sandbox="allow-same-origin allow-scripts"
                    title="Email preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[460px] text-sm text-stone-400 gap-2">
                    <Eye className="h-6 w-6 text-stone-300" />
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
    </div>
  );
}
