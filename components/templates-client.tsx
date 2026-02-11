"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, PencilSimple, Trash, EnvelopeSimple } from "@phosphor-icons/react";
import { TemplateEditor } from "@/components/template-editor";

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

export function TemplatesClient({
  templates: initialTemplates,
  orgId,
  fromName,
}: {
  templates: Template[];
  orgId: string;
  fromName?: string;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("templates")
      .insert({
        org_id: orgId,
        name,
        subject,
        body_html: `<h1>Hello {{ first_name }}</h1>\n<p>Write your email here...</p>`,
      })
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error("Failed to create template");
    } else {
      setTemplates([data, ...templates]);
      setName("");
      setSubject("");
      toast.success("Template created");
      setEditingTemplate(data);
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete template");
    } else {
      setTemplates(templates.filter((t) => t.id !== id));
      if (editingTemplate?.id === id) setEditingTemplate(null);
      toast.success("Template deleted");
    }
  }

  function handleSaved(updated: Template) {
    setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        fromName={fromName}
        onBack={() => setEditingTemplate(null)}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-1">
            Email templates with Liquid variables for personalization.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create template</DialogTitle>
              <DialogDescription>Start with a name and subject line.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tplName">Template name</Label>
                <Input id="tplName" placeholder="Welcome email" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tplSubject">Subject line</Label>
                <Input id="tplSubject" placeholder="Welcome to {{ company }}" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={adding}>{adding ? "Creating..." : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <EnvelopeSimple className="h-12 w-12 text-muted-foreground mb-4" weight="duotone" />
            <p className="text-muted-foreground">No templates yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first email template to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-1">
                      Subject: {template.subject}
                    </CardDescription>
                  </div>
                  {template.is_system && <Badge variant="secondary">System</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingTemplate(template)}>
                    <PencilSimple className="mr-1 h-3 w-3" />Edit
                  </Button>
                  {!template.is_system && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                      <Trash className="mr-1 h-3 w-3" />Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
