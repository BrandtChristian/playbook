"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CircleNotch,
  FloppyDisk,
  ArrowLeft,
  Lightning,
  PaperPlaneTilt,
  Image as ImageIcon,
  Link as LinkIcon,
  TextAa,
  TextT,
  Sparkle,
} from "@phosphor-icons/react";
import type { ParsedVariable } from "@/lib/agillic/webdav";
import { AiAgillicPromptBar } from "@/components/email-builder/ai-agillic-prompt-bar";

type AgillicVariableEditorProps = {
  email: {
    id: string;
    name: string;
    subject: string;
    agillic_template_name: string;
    agillic_variables: Record<string, string> | null;
    agillic_campaign_id: string | null;
    agillic_target_group_name: string | null;
  };
  templateHtml: string;
  variables: ParsedVariable[];
  onBack: () => void;
  onSaved: () => void;
};

function getFieldIcon(variable: ParsedVariable) {
  if (variable.type === "editable") return <TextAa className="h-4 w-4" />;
  switch (variable.dataType) {
    case "IMAGE":
      return <ImageIcon className="h-4 w-4" />;
    case "LINK":
      return <LinkIcon className="h-4 w-4" />;
    default:
      return <TextT className="h-4 w-4" />;
  }
}

function getFieldLabel(variable: ParsedVariable): string {
  const name = variable.fieldName
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (variable.namespace) {
    return `${variable.namespace.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — ${name}`;
  }
  return name;
}

function getFieldTypeBadge(variable: ParsedVariable) {
  if (variable.type === "editable") return "Rich Text";
  return variable.dataType || "Text";
}

/**
 * Substitute variable values into template HTML for preview.
 */
function renderPreview(
  html: string,
  variables: ParsedVariable[],
  values: Record<string, string>
): string {
  let result = html;

  for (const v of variables) {
    if (v.type === "editable") {
      // Replace content inside ageditable elements with matching agid
      const regex = new RegExp(
        `(ageditable=["'][^"']*["'][^>]*agid=["']${v.fieldName}["'][^>]*>)[\\s\\S]*?(</)`,
        "g"
      );
      const value = values[v.raw] || "";
      if (value) {
        result = result.replace(regex, `$1${value}$2`);
      }
    } else if (v.type === "blockparam") {
      // Replace blockparam placeholders
      const escapedRaw = v.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = `\\$\\{blockparam:${escapedRaw}\\}`;
      const regex = new RegExp(pattern, "g");
      const value = values[v.raw] || v.defaultValue || "";
      result = result.replace(regex, value);
    }
  }

  return result;
}

export function AgillicVariableEditor({
  email,
  templateHtml,
  variables,
  onBack,
  onSaved,
}: AgillicVariableEditorProps) {
  const [subject, setSubject] = useState(email.subject);
  const [values, setValues] = useState<Record<string, string>>(
    email.agillic_variables ?? {}
  );
  const [targetGroupName, setTargetGroupName] = useState(email.agillic_target_group_name || "");
  const [targetGroups, setTargetGroups] = useState<Array<{ name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<ParsedVariable | null>(null);
  const [aiMode, setAiMode] = useState<"fill" | "improve" | "subject" | undefined>(undefined);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch target groups
  useEffect(() => {
    fetch("/api/agillic/target-groups")
      .then((r) => r.json())
      .then((json) => setTargetGroups(json.targetGroups ?? []))
      .catch(() => {});
  }, []);

  // Initialize default values from template
  useEffect(() => {
    if (Object.keys(values).length === 0) {
      const defaults: Record<string, string> = {};
      for (const v of variables) {
        if (v.defaultValue) defaults[v.raw] = v.defaultValue;
      }
      if (Object.keys(defaults).length > 0) {
        setValues(defaults);
      }
    }
  }, [variables, values]);

  // Update preview when values change
  useEffect(() => {
    if (!previewRef.current) return;
    const previewHtml = renderPreview(templateHtml, variables, values);
    const doc = previewRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(previewHtml);
      doc.close();
    }
  }, [templateHtml, variables, values]);

  const updateValue = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setDirty(true);

      // Auto-save with 3s debounce
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        handleSave(true);
      }, 3000);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subject]
  );

  async function handleSave(silent = false) {
    setSaving(true);
    try {
      const res = await fetch(`/api/agillic/emails/${email.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          variables: values,
          targetGroupName,
        }),
      });

      if (res.ok) {
        setDirty(false);
        if (!silent) toast.success("Saved and staged in Agillic");
        onSaved();
      } else {
        const json = await res.json();
        toast.error(json.error || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail) return;
    setSendingTest(true);
    try {
      // Save first to ensure campaign is staged with latest content
      if (dirty) {
        await handleSave(true);
      }
      // Test the staged campaign via Agillic
      const res = await fetch(`/api/agillic/emails/${email.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || "Test email sent via Agillic");
      } else {
        toast.error(json.error || "Test send failed");
      }
    } catch {
      toast.error("Test send failed");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{email.name}</h2>
            <p className="text-xs text-muted-foreground">
              Template: {email.agillic_template_name}
              {email.agillic_campaign_id && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Staged
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <Button onClick={() => handleSave(false)} disabled={saving}>
            {saving ? (
              <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FloppyDisk className="mr-2 h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Split Pane */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Variable Editor */}
        <div className="w-[420px] border-r overflow-y-auto p-4 space-y-4">
          {/* Subject */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Subject Line</Label>
              <button
                type="button"
                onClick={() => {
                  setSelectedVariable(null);
                  setAiMode("subject");
                  setSubjectSuggestions([]);
                }}
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                title="Generate subject lines with AI"
              >
                <Sparkle className="h-3 w-3" />
                AI
              </button>
            </div>
            <Input
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setDirty(true);
              }}
              placeholder="Email subject"
            />
            {subjectSuggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pick a subject line:</p>
                {subjectSuggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSubject(s);
                      setDirty(true);
                      setSubjectSuggestions([]);
                      setAiMode(undefined);
                    }}
                    className="block w-full text-left text-sm px-2 py-1.5 rounded border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target Group (required for staging) */}
          <div className="grid gap-2">
            <Label className="font-medium">
              Target Group <span className="text-xs text-muted-foreground">(for staging)</span>
            </Label>
            <select
              value={targetGroupName}
              onChange={(e) => {
                setTargetGroupName(e.target.value);
                setDirty(true);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select target group...</option>
              {targetGroups.map((tg) => (
                <option key={tg.name} value={tg.name}>
                  {tg.name}
                </option>
              ))}
            </select>
            {!targetGroupName && (
              <p className="text-xs text-muted-foreground">
                Required for staging campaigns in Agillic (not needed for test sends)
              </p>
            )}
          </div>

          {/* Variables */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Template Variables ({variables.length})
            </p>
            {variables.map((v) => (
              <div key={v.raw} className="grid gap-1.5">
                <Label className="flex items-center gap-2 text-sm">
                  {getFieldIcon(v)}
                  {getFieldLabel(v)}
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {getFieldTypeBadge(v)}
                  </Badge>
                  {/* Per-field AI improve button (not for IMAGE) */}
                  {v.dataType !== "IMAGE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVariable(v);
                        setAiMode("improve");
                        setSubjectSuggestions([]);
                      }}
                      className={`ml-auto inline-flex items-center justify-center h-5 w-5 rounded transition-colors ${
                        selectedVariable?.raw === v.raw
                          ? "text-amber-600 bg-amber-100 dark:bg-amber-900/30"
                          : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      }`}
                      title="Improve with AI"
                    >
                      <Sparkle className="h-3 w-3" />
                    </button>
                  )}
                </Label>
                {v.type === "editable" ? (
                  <Textarea
                    value={values[v.raw] ?? ""}
                    onChange={(e) => updateValue(v.raw, e.target.value)}
                    placeholder="Rich text content..."
                    className="min-h-[80px] text-sm"
                  />
                ) : v.dataType === "IMAGE" ? (
                  <Input
                    value={values[v.raw] ?? v.defaultValue ?? ""}
                    onChange={(e) => updateValue(v.raw, e.target.value)}
                    placeholder="https://cdn.example.com/image.jpg"
                    type="url"
                  />
                ) : v.dataType === "LINK" ? (
                  <Input
                    value={values[v.raw] ?? v.defaultValue ?? ""}
                    onChange={(e) => updateValue(v.raw, e.target.value)}
                    placeholder="https://example.com"
                    type="url"
                  />
                ) : (
                  <Input
                    value={values[v.raw] ?? v.defaultValue ?? ""}
                    onChange={(e) => updateValue(v.raw, e.target.value)}
                    placeholder={v.defaultValue || "Enter text..."}
                  />
                )}
              </div>
            ))}
          </div>

          {/* AI Assist */}
          <div className="border-t pt-4">
            <AiAgillicPromptBar
              variables={variables}
              selectedVariable={selectedVariable}
              currentFieldValue={selectedVariable ? (values[selectedVariable.raw] ?? "") : undefined}
              mode={aiMode}
              templateName={email.agillic_template_name}
              onFillVariables={(filled) => {
                setValues((prev) => {
                  const next = { ...prev };
                  for (const [key, val] of Object.entries(filled)) {
                    next[key] = val;
                  }
                  return next;
                });
                setDirty(true);
              }}
              onImproveField={(raw, content) => {
                updateValue(raw, content);
              }}
              onSelectSubject={(subjects) => {
                setSubjectSuggestions(subjects);
              }}
              onClearSelection={() => {
                setSelectedVariable(null);
                setAiMode(undefined);
                setSubjectSuggestions([]);
              }}
            />
          </div>

          {/* Test Email */}
          <div className="border-t pt-4 grid gap-2">
            <Label className="text-sm font-medium">Send Test Email</Label>
            <div className="flex gap-2">
              <Input
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                type="email"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={sendingTest || !testEmail}
                onClick={handleSendTest}
              >
                {sendingTest ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : (
                  <PaperPlaneTilt className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="flex-1 bg-stone-100 dark:bg-stone-900 p-4">
          <div className="bg-white dark:bg-stone-800 h-full shadow-sm overflow-hidden">
            <iframe
              ref={previewRef}
              className="w-full h-full border-0"
              title="Email Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
