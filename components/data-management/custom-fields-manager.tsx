"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash, Pencil } from "@phosphor-icons/react";
import type { CustomFieldDefinition, FieldType } from "@/lib/segments/types";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  select: "Select",
};

export function CustomFieldsManager({
  fields: initialFields,
  orgId,
}: {
  fields: CustomFieldDefinition[];
  orgId: string;
}) {
  const [fields, setFields] = useState(initialFields);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function resetForm() {
    setName("");
    setLabel("");
    setFieldType("text");
    setOptions("");
    setIsRequired(false);
    setEditingField(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(field: CustomFieldDefinition) {
    setEditingField(field);
    setName(field.name);
    setLabel(field.label);
    setFieldType(field.field_type);
    setOptions(field.options ? field.options.join(", ") : "");
    setIsRequired(field.is_required);
    setDialogOpen(true);
  }

  // Auto-generate snake_case name from label
  function handleLabelChange(val: string) {
    setLabel(val);
    if (!editingField) {
      setName(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "")
      );
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !name.trim()) return;

    setSaving(true);
    const supabase = createClient();

    const fieldData = {
      org_id: orgId,
      name: name.trim(),
      label: label.trim(),
      field_type: fieldType,
      options:
        fieldType === "select" && options.trim()
          ? options.split(",").map((o) => o.trim()).filter(Boolean)
          : null,
      is_required: isRequired,
      sort_order: editingField ? editingField.sort_order : fields.length,
    };

    if (editingField) {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .update(fieldData)
        .eq("id", editingField.id)
        .select()
        .single();

      if (error) {
        toast.error(error.message);
      } else {
        setFields((prev) =>
          prev.map((f) => (f.id === editingField.id ? data : f))
        );
        toast.success("Field updated");
      }
    } else {
      const { data, error } = await supabase
        .from("custom_field_definitions")
        .insert(fieldData)
        .select()
        .single();

      if (error) {
        toast.error(
          error.code === "23505"
            ? "A field with this name already exists"
            : error.message
        );
      } else {
        setFields((prev) => [...prev, data]);
        toast.success("Field created");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    resetForm();
    router.refresh();
  }

  async function handleDelete(field: CustomFieldDefinition) {
    const supabase = createClient();
    const { error } = await supabase
      .from("custom_field_definitions")
      .delete()
      .eq("id", field.id);

    if (error) {
      toast.error(error.message);
    } else {
      setFields((prev) => prev.filter((f) => f.id !== field.id));
      toast.success("Field deleted");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Custom Contact Fields</CardTitle>
            <CardDescription>
              Define custom fields stored on each contact. These appear in the
              contact detail view and can be used for segmentation.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" />
                Add field
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSave}>
                <DialogHeader>
                  <DialogTitle>
                    {editingField ? "Edit field" : "Add custom field"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingField
                      ? "Update this field definition."
                      : "Create a new custom field for contacts."}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="field-label">Label</Label>
                    <Input
                      id="field-label"
                      value={label}
                      onChange={(e) => handleLabelChange(e.target.value)}
                      placeholder="e.g. Industry"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="field-name">Internal name</Label>
                    <Input
                      id="field-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. industry"
                      required
                      disabled={!!editingField}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used as the key in contact data. Cannot be changed after creation.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select
                      value={fieldType}
                      onValueChange={(v) => setFieldType(v as FieldType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {fieldType === "select" && (
                    <div className="grid gap-2">
                      <Label htmlFor="field-options">
                        Options (comma-separated)
                      </Label>
                      <Input
                        id="field-options"
                        value={options}
                        onChange={(e) => setOptions(e.target.value)}
                        placeholder="e.g. SaaS, E-commerce, Agency"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="field-required"
                      checked={isRequired}
                      onCheckedChange={(v) => setIsRequired(v === true)}
                    />
                    <Label htmlFor="field-required" className="text-sm">
                      Required field
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingField ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No custom fields defined yet. Add a field to extend your contact
            data model.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {field.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {FIELD_TYPE_LABELS[field.field_type]}
                    </Badge>
                    {field.field_type === "select" && field.options && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {field.options.length} options
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {field.is_required ? (
                      <Badge variant="outline">Required</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Optional
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(field)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(field)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
