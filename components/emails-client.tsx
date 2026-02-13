"use client";

import { useState, useEffect } from "react";
import { TemplateEditor } from "@/components/template-editor";
import { AgillicVariableEditor } from "@/components/agillic-variable-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Plus, EnvelopeSimple, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { ParsedVariable } from "@/lib/agillic/webdav";

type Email = {
  id: string;
  org_id: string;
  template_id: string | null;
  name: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
  templates: { name: string } | null;
  agillic_template_name?: string | null;
  agillic_variables?: Record<string, string> | null;
  agillic_campaign_id?: string | null;
  agillic_target_group_name?: string | null;
};

type AgillicTemplate = {
  id: string;
  template_name: string;
  detected_variables: ParsedVariable[];
  synced_at: string;
};

type Template = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  category: string | null;
  is_system: boolean;
};

export function EmailsClient({
  emails: initialEmails,
  templates,
  orgId,
  fromName,
  emailProvider = "resend",
}: {
  emails: Email[];
  templates: Template[];
  orgId: string;
  fromName: string;
  emailProvider?: "resend" | "agillic";
}) {
  const [emails, setEmails] = useState(initialEmails);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedAgillicTemplate, setSelectedAgillicTemplate] = useState<AgillicTemplate | null>(null);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [hideSystemInPicker, setHideSystemInPicker] = useState(false);
  const [agillicTemplates, setAgillicTemplates] = useState<AgillicTemplate[]>([]);
  const [agillicTemplateHtml, setAgillicTemplateHtml] = useState<string>("");
  const router = useRouter();
  const supabase = createClient();

  // Fetch Agillic templates for the picker
  useEffect(() => {
    if (emailProvider !== "agillic") return;
    fetch("/api/agillic/templates")
      .then((r) => r.json())
      .then((json) => setAgillicTemplates(json.templates ?? []))
      .catch(() => {});
  }, [emailProvider]);

  const editingEmail = emails.find((e) => e.id === editingEmailId);

  // ── Create email from template ──────────────────────────

  function selectTemplate(tpl: Template) {
    setSelectedTemplateId(tpl.id);
    setNewName("");
    setNewSubject(tpl.subject);
  }

  async function handleCreate() {
    if (!newName.trim() || !selectedTemplateId) return;
    setCreating(true);

    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tpl) return;

    try {
      const { data, error } = await supabase
        .from("emails")
        .insert({
          org_id: orgId,
          template_id: selectedTemplateId,
          name: newName.trim(),
          subject: newSubject.trim() || tpl.subject,
          body_html: tpl.body_html,
        })
        .select("*, templates(name)")
        .single();

      if (error || !data) throw error;

      setEmails([data, ...emails]);
      setShowCreate(false);
      setSelectedTemplateId(null);
      setNewName("");
      setNewSubject("");
      setEditingEmailId(data.id);
      toast.success("Email created");
    } catch {
      toast.error("Failed to create email");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(emailId: string) {
    const { error } = await supabase.from("emails").delete().eq("id", emailId);
    if (error) {
      toast.error("Failed to delete email");
      return;
    }
    setEmails(emails.filter((e) => e.id !== emailId));
    toast.success("Email deleted");
  }

  // ── Agillic email creation ─────────────────────────────────

  async function handleCreateAgillic() {
    if (!newName.trim() || !selectedAgillicTemplate) return;
    setCreating(true);

    try {
      const { data, error } = await supabase
        .from("emails")
        .insert({
          org_id: orgId,
          name: newName.trim(),
          subject: newSubject.trim() || "New Email",
          body_html: "",
          agillic_template_name: selectedAgillicTemplate.template_name,
          agillic_variables: {},
        })
        .select("*, templates(name)")
        .single();

      if (error || !data) throw error;

      setEmails([data, ...emails]);
      setShowCreate(false);
      setSelectedAgillicTemplate(null);
      setNewName("");
      setNewSubject("");
      setEditingEmailId(data.id);
      toast.success("Email created");
    } catch {
      toast.error("Failed to create email");
    } finally {
      setCreating(false);
    }
  }

  // ── Editor view ──────────────────────────────────────────

  // ── Agillic Variable Editor ─────────────────────────────
  if (editingEmail && emailProvider === "agillic" && editingEmail.agillic_template_name) {
    const agTpl = agillicTemplates.find(
      (t) => t.template_name === editingEmail.agillic_template_name
    );

    // Fetch template HTML if not loaded
    if (!agillicTemplateHtml && agTpl) {
      supabase
        .from("agillic_template_cache")
        .select("html_content")
        .eq("id", agTpl.id)
        .single()
        .then(({ data }) => {
          if (data?.html_content) setAgillicTemplateHtml(data.html_content);
        });
    }

    if (agillicTemplateHtml && agTpl) {
      return (
        <AgillicVariableEditor
          email={{
            id: editingEmail.id,
            name: editingEmail.name,
            subject: editingEmail.subject,
            agillic_template_name: editingEmail.agillic_template_name,
            agillic_variables: editingEmail.agillic_variables ?? null,
            agillic_campaign_id: editingEmail.agillic_campaign_id ?? null,
            agillic_target_group_name: editingEmail.agillic_target_group_name ?? null,
          }}
          templateHtml={agillicTemplateHtml}
          variables={agTpl.detected_variables ?? []}
          onBack={() => {
            setEditingEmailId(null);
            setAgillicTemplateHtml("");
            router.refresh();
          }}
          onSaved={() => router.refresh()}
        />
      );
    }

    // Loading state while template HTML loads
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  // ── Forge Template Editor (Resend mode) ────────────────
  if (editingEmail) {
    return (
      <TemplateEditor
        template={{
          id: editingEmail.id,
          org_id: editingEmail.org_id,
          name: editingEmail.name,
          description: null,
          subject: editingEmail.subject,
          body_html: editingEmail.body_html,
          category: null,
          is_system: false,
          created_at: editingEmail.created_at,
        }}
        fromName={fromName}
        saveTable="emails"
        onBack={() => {
          setEditingEmailId(null);
          router.refresh();
        }}
        onSaved={(updated) => {
          setEmails(
            emails.map((e) =>
              e.id === updated.id
                ? { ...e, name: updated.name, subject: updated.subject, body_html: updated.body_html }
                : e
            )
          );
        }}
      />
    );
  }

  // ── List view ────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            Emails
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Individual messages built from templates. Used in campaigns and flows.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          New Email
        </Button>
      </div>

      {emails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 flex items-center justify-center bg-stone-100 dark:bg-stone-800 mb-4">
              <EnvelopeSimple className="w-6 h-6 text-stone-400" />
            </div>
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">
              No emails yet
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 max-w-sm">
              Create your first email from a template. Emails are individual
              messages you can use in campaigns and flows.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Email
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {emails.map((email) => (
            <Card
              key={email.id}
              className="cursor-pointer hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
              onClick={() => setEditingEmailId(email.id)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="w-10 h-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 shrink-0">
                  <EnvelopeSimple className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                      {email.name}
                    </h3>
                    {email.templates?.name && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {email.templates.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                    {email.subject}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                    {new Date(email.updated_at).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-stone-400 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(email.id);
                    }}
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create from template dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setSelectedTemplateId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplateId ? "Name your email" : "Choose a template"}
            </DialogTitle>
          </DialogHeader>

          {emailProvider === "agillic" && !selectedAgillicTemplate ? (
            <div className="grid gap-2 py-2 max-h-80 overflow-y-auto">
              {agillicTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No Agillic templates synced. Sync from Settings first.
                </p>
              ) : (
                agillicTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => { setSelectedAgillicTemplate(tpl); setNewSubject(""); }}
                    className="text-left px-3 py-2.5 border border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 flex items-center justify-center bg-stone-100 dark:bg-stone-800 shrink-0">
                      <EnvelopeSimple className="w-4 h-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                        {tpl.template_name.replace(".html", "")}
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {(tpl.detected_variables ?? []).length} variables
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Agillic</Badge>
                  </button>
                ))
              )}
            </div>
          ) : emailProvider === "agillic" && selectedAgillicTemplate ? (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="email-name">Email name</Label>
                <Input id="email-name" placeholder="e.g. February Newsletter" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email-subject">Subject line</Label>
                <Input id="email-subject" placeholder="e.g. Your monthly update" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateAgillic()} />
              </div>
            </div>
          ) : !selectedTemplateId ? (
            <div className="grid gap-2 py-2 max-h-80 overflow-y-auto">
              <label className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 cursor-pointer pb-1">
                <input
                  type="checkbox"
                  checked={!hideSystemInPicker}
                  onChange={(e) => setHideSystemInPicker(!e.target.checked)}
                  className="accent-indigo-500"
                />
                Show system templates
              </label>
              {templates.filter((t) => !hideSystemInPicker || !t.is_system).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl)}
                  className="text-left px-3 py-2.5 border border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-stone-100 dark:bg-stone-800 shrink-0">
                    <EnvelopeSimple className="w-4 h-4 text-stone-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      {tpl.name}
                    </div>
                    {tpl.category && (
                      <span className="text-[10px] text-stone-400 capitalize">
                        {tpl.category}
                      </span>
                    )}
                  </div>
                  {tpl.is_system && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      System
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="email-name">Email name</Label>
                <Input
                  id="email-name"
                  placeholder="e.g. Welcome Email"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email-subject">Subject line</Label>
                <Input
                  id="email-subject"
                  placeholder="e.g. Welcome to {{ company }}"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {(selectedTemplateId || selectedAgillicTemplate) && (
              <Button variant="outline" onClick={() => { setSelectedTemplateId(null); setSelectedAgillicTemplate(null); }}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => { setShowCreate(false); setSelectedTemplateId(null); setSelectedAgillicTemplate(null); }}>
              Cancel
            </Button>
            {selectedAgillicTemplate && (
              <Button onClick={handleCreateAgillic} disabled={!newName.trim() || creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            )}
            {selectedTemplateId && (
              <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
