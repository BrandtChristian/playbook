"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  FloppyDisk,
  Eye,
  CircleNotch,
} from "@phosphor-icons/react";
import { AiContentPanel } from "@/components/ai-content-panel";

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
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchPreview = useCallback(async (html: string) => {
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
  }, [fromName]);

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
        <Button onClick={handleSave} disabled={saving}>
          <FloppyDisk className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
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

      <div className="flex gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground self-center">
          Insert:
        </span>
        {VARIABLE_TAGS.map((tag) => (
          <Badge
            key={tag}
            variant="outline"
            className="cursor-pointer hover:bg-muted"
            onClick={() => insertVariable(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr] min-h-[500px]">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">HTML + Liquid</Label>
            <Textarea
              className="min-h-[400px] font-mono text-sm resize-none"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </div>

          {/* AI Content Assistant */}
          <AiContentPanel
            currentBody={bodyHtml}
            onInsertBody={(html) => setBodyHtml(html)}
            onInsertSubject={(s) => setSubject(s)}
          />
        </div>
        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Email Preview
            {loadingPreview && (
              <CircleNotch className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </Label>
          <Card className="min-h-[480px] overflow-auto bg-[#f6f6f6] p-0 sticky top-4">
            <CardContent className="p-0">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full min-h-[480px] border-0"
                  sandbox="allow-same-origin"
                  title="Email preview"
                />
              ) : (
                <div className="flex items-center justify-center min-h-[480px] text-sm text-muted-foreground">
                  {loadingPreview ? "Rendering preview..." : "Start typing to see preview"}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
