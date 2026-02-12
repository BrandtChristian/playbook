"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, PencilSimple, Trash, EnvelopeSimple, PaintBrush, CaretRight, CaretDown, Notebook } from "@phosphor-icons/react";
import { TemplateEditor } from "@/components/template-editor";
import { BrandBuilder } from "@/components/brand-builder";
import type { BrandConfig } from "@/components/brand-builder";

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
  orgName,
  fromName,
  existingBrandConfig,
  initialEditId,
}: {
  templates: Template[];
  orgId: string;
  orgName: string;
  fromName?: string;
  existingBrandConfig?: BrandConfig;
  initialEditId?: string;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(
    () => (initialEditId ? initialTemplates.find((t) => t.id === initialEditId) ?? null : null)
  );

  function editTemplate(template: Template) {
    setEditingTemplate(template);
    router.replace(`/templates?edit=${template.id}`);
  }

  function closeEditor() {
    setEditingTemplate(null);
    router.replace("/templates");
  }
  const [showBrandBuilder, setShowBrandBuilder] = useState(false);
  const [brandConfig, setBrandConfig] = useState<BrandConfig | undefined>(existingBrandConfig);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showSystemTemplates, setShowSystemTemplates] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("forge:showSystemTemplates") !== "false";
    }
    return true;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("templates")
      .insert({
        org_id: orgId,
        name,
        subject: "",
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
      toast.success("Template created");
      editTemplate(data);
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete template");
    } else {
      setTemplates(templates.filter((t) => t.id !== id));
      if (editingTemplate?.id === id) closeEditor();
      toast.success("Template deleted");
    }
  }

  function handleSaved(updated: Template) {
    setTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
  }

  if (showBrandBuilder) {
    return (
      <BrandBuilder
        orgId={orgId}
        orgName={orgName}
        existingConfig={brandConfig}
        onBack={() => setShowBrandBuilder(false)}
        onSaved={(config) => {
          setBrandConfig(config);
          setShowBrandBuilder(false);
        }}
      />
    );
  }

  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        fromName={fromName}
        onBack={closeEditor}
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
            Reusable designs to build emails from.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-stone-500 dark:text-stone-400">
            <input
              type="checkbox"
              checked={showSystemTemplates}
              onChange={(e) => {
                setShowSystemTemplates(e.target.checked);
                localStorage.setItem("forge:showSystemTemplates", String(e.target.checked));
              }}
              className="accent-indigo-500"
            />
            System templates
          </label>
          <Button variant="outline" onClick={() => setShowBrandBuilder(true)}>
            <PaintBrush className="mr-2 h-4 w-4" />
            {brandConfig ? "Edit Brand" : "Build Brand"}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New template</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create template</DialogTitle>
              <DialogDescription>A reusable design to build emails from.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tplName">Template name</Label>
                <Input id="tplName" placeholder="e.g. Marketing Standard" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={adding}>{adding ? "Creating..." : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {(() => {
        const userTemplates = templates.filter((t) => !t.is_system);
        const systemTemplates = templates.filter((t) => t.is_system);

        // Group system templates by category
        const categoryGroups = new Map<string, Template[]>();
        for (const t of systemTemplates) {
          const cat = t.category || "other";
          if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
          categoryGroups.get(cat)!.push(t);
        }

        const categoryLabels: Record<string, string> = {
          welcome: "Welcome Series",
          newsletter: "Newsletter",
          winback: "Win-back",
          promotional: "Promotional",
          onboarding: "Onboarding",
          transactional: "Transactional",
          other: "Other",
        };

        return (
          <>
            {/* User templates */}
            {userTemplates.length === 0 && (!showSystemTemplates || systemTemplates.length === 0) ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <EnvelopeSimple className="h-12 w-12 text-muted-foreground mb-4" weight="duotone" />
                  <p className="text-muted-foreground">No templates yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">Create your first email template to get started.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {userTemplates.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {userTemplates.map((template) => (
                      <Card key={template.id} className="group">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{template.name}</CardTitle>
                              <CardDescription className="mt-1 line-clamp-1">
                                Subject: {template.subject}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>
                              <PencilSimple className="mr-1 h-3 w-3" />Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                              <Trash className="mr-1 h-3 w-3" />Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* System templates grouped by category */}
                {showSystemTemplates && categoryGroups.size > 0 && (
                  <div className="space-y-2">
                    <h2 className="text-sm font-medium text-muted-foreground">System Templates</h2>
                    <div className="grid gap-3">
                      {Array.from(categoryGroups.entries()).map(([category, catTemplates]) => {
                        const isExpanded = expandedCategories.has(category);

                        return (
                          <Card key={category} className="transition-colors hover:border-primary/50">
                            <CardContent className="p-0">
                              <button
                                type="button"
                                className="flex items-center justify-between w-full py-4 px-6 text-left"
                                onClick={() => {
                                  setExpandedCategories((prev) => {
                                    const next = new Set(prev);
                                    next.has(category) ? next.delete(category) : next.add(category);
                                    return next;
                                  });
                                }}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {isExpanded ? (
                                    <CaretDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                  ) : (
                                    <CaretRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                  <Notebook className="h-4 w-4 text-primary shrink-0" weight="duotone" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">{categoryLabels[category] || category}</p>
                                      <Badge variant="secondary">{catTemplates.length} template{catTemplates.length !== 1 ? "s" : ""}</Badge>
                                    </div>
                                  </div>
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="border-t">
                                  {catTemplates.map((template, i) => (
                                    <div
                                      key={template.id}
                                      className={`flex items-center justify-between py-3 pl-14 pr-6 hover:bg-muted/50 transition-colors ${
                                        i < catTemplates.length - 1 ? "border-b" : ""
                                      }`}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{template.name}</p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                          Subject: {template.subject}
                                        </p>
                                      </div>
                                      <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>
                                        <PencilSimple className="mr-1 h-3 w-3" />Edit
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}
    </div>
  );
}
