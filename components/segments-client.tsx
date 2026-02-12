"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash, Users, Funnel, ListChecks, Copy, PencilSimple, Check, X } from "@phosphor-icons/react";
import { SegmentBuilder } from "@/components/segment-builder/segment-builder";
import type {
  FilterGroup,
  CustomFieldDefinition,
  DataTableDefinition,
} from "@/lib/segments/types";

type Segment = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  contact_count: number;
  segment_type: string;
  filter_rules: FilterGroup | null;
  created_at: string;
};

type ContactRef = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

function emptyFilterGroup(): FilterGroup {
  return {
    id: "root",
    logic: "and",
    conditions: [
      {
        id: "c1",
        source: { type: "contact_field", field: "email" },
        operator: "is_set",
      },
    ],
  };
}

export function SegmentsClient({
  segments: initialSegments,
  contacts,
  orgId,
  customFields = [],
  dataTables = [],
}: {
  segments: Segment[];
  contacts: ContactRef[];
  orgId: string;
  customFields?: CustomFieldDefinition[];
  dataTables?: DataTableDefinition[];
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segmentType, setSegmentType] = useState<"static" | "dynamic">(
    "static"
  );
  const [adding, setAdding] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [filterRules, setFilterRules] = useState<FilterGroup>(
    emptyFilterGroup()
  );
  const [editingRules, setEditingRules] = useState<FilterGroup | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const insertData: Record<string, unknown> = {
      org_id: orgId,
      name,
      description: description || null,
      segment_type: segmentType,
    };

    if (segmentType === "dynamic") {
      insertData.filter_rules = filterRules;
    }

    const { data, error } = await supabase
      .from("segments")
      .insert(insertData)
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error("Failed to create segment");
    } else {
      setSegments([data, ...segments]);
      setName("");
      setDescription("");
      setSegmentType("static");
      setFilterRules(emptyFilterGroup());
      toast.success("Segment created");
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("segments").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete segment");
    } else {
      setSegments(segments.filter((s) => s.id !== id));
      if (selectedSegment?.id === id) setSelectedSegment(null);
      toast.success("Segment deleted");
    }
  }

  async function handleDuplicate(segment: Segment) {
    const supabase = createClient();
    const insertData: Record<string, unknown> = {
      org_id: orgId,
      name: `${segment.name} (copy)`,
      description: segment.description,
      segment_type: segment.segment_type,
      filter_rules: segment.filter_rules,
    };

    const { data, error } = await supabase
      .from("segments")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast.error("Failed to duplicate segment");
      return;
    }

    // For static segments, also copy memberships
    if (segment.segment_type === "static") {
      const { data: members } = await supabase
        .from("segment_contacts")
        .select("contact_id")
        .eq("segment_id", segment.id);

      if (members && members.length > 0) {
        await supabase.from("segment_contacts").insert(
          members.map((m) => ({
            segment_id: data.id,
            contact_id: m.contact_id,
          }))
        );
        await supabase
          .from("segments")
          .update({ contact_count: members.length })
          .eq("id", data.id);
        data.contact_count = members.length;
      }
    }

    setSegments([data, ...segments]);
    toast.success("Segment duplicated");
  }

  async function selectSegment(segment: Segment) {
    setSelectedSegment(segment);

    if (segment.segment_type === "dynamic") {
      setEditingRules(segment.filter_rules ?? emptyFilterGroup());
    } else {
      setEditingRules(null);
      setLoadingMembers(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("segment_contacts")
        .select("contact_id")
        .eq("segment_id", segment.id);
      setMemberIds(new Set((data ?? []).map((r) => r.contact_id)));
      setLoadingMembers(false);
    }
  }

  async function toggleMember(contactId: string) {
    if (!selectedSegment) return;
    const supabase = createClient();
    const isMember = memberIds.has(contactId);

    if (isMember) {
      await supabase
        .from("segment_contacts")
        .delete()
        .eq("segment_id", selectedSegment.id)
        .eq("contact_id", contactId);
      memberIds.delete(contactId);
    } else {
      await supabase
        .from("segment_contacts")
        .insert({
          segment_id: selectedSegment.id,
          contact_id: contactId,
        });
      memberIds.add(contactId);
    }

    setMemberIds(new Set(memberIds));

    const newCount = memberIds.size;
    await supabase
      .from("segments")
      .update({ contact_count: newCount })
      .eq("id", selectedSegment.id);

    setSegments(
      segments.map((s) =>
        s.id === selectedSegment.id ? { ...s, contact_count: newCount } : s
      )
    );
    setSelectedSegment({ ...selectedSegment, contact_count: newCount });
  }

  async function saveFilterRules() {
    if (!selectedSegment || !editingRules) return;
    setSavingRules(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("segments")
      .update({ filter_rules: editingRules as unknown as Record<string, unknown> })
      .eq("id", selectedSegment.id);

    setSavingRules(false);
    if (error) {
      toast.error("Failed to save filter rules");
    } else {
      setSegments(
        segments.map((s) =>
          s.id === selectedSegment.id
            ? { ...s, filter_rules: editingRules }
            : s
        )
      );
      setSelectedSegment({ ...selectedSegment, filter_rules: editingRules });
      toast.success("Filter rules saved");
      router.refresh();
    }
  }

  function startEditMeta() {
    if (!selectedSegment) return;
    setEditName(selectedSegment.name);
    setEditDescription(selectedSegment.description ?? "");
    setEditingMeta(true);
  }

  async function saveEditMeta() {
    if (!selectedSegment) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("segments")
      .update({ name: editName.trim(), description: editDescription.trim() || null })
      .eq("id", selectedSegment.id);

    if (error) {
      toast.error("Failed to update segment");
    } else {
      const updated = {
        ...selectedSegment,
        name: editName.trim(),
        description: editDescription.trim() || null,
      };
      setSegments(segments.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedSegment(updated);
      toast.success("Segment updated");
    }
    setEditingMeta(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segments</h1>
          <p className="text-muted-foreground mt-1">
            Organize contacts into targeted groups.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create segment
            </Button>
          </DialogTrigger>
          <DialogContent className={segmentType === "dynamic" ? "max-w-2xl" : ""}>
            <DialogHeader>
              <DialogTitle>Create segment</DialogTitle>
              <DialogDescription>
                Group contacts for targeted campaigns.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="segName">Name</Label>
                <Input
                  id="segName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segDesc">Description</Label>
                <Input
                  id="segDesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={segmentType}
                  onValueChange={(v) =>
                    setSegmentType(v as "static" | "dynamic")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">
                      Static — manually select contacts
                    </SelectItem>
                    <SelectItem value="dynamic">
                      Dynamic — filter by rules
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {segmentType === "dynamic" && (
                <div className="border rounded-md p-4">
                  <SegmentBuilder
                    value={filterRules}
                    onChange={setFilterRules}
                    customFields={customFields}
                    dataTables={dataTables}
                    orgId={orgId}
                  />
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={adding}>
                  {adding ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {segments.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users
                className="h-12 w-12 text-muted-foreground mb-4"
                weight="duotone"
              />
              <p className="text-muted-foreground font-medium">
                No segments yet
              </p>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                Segments group your contacts for targeted campaigns. Create your
                first segment to start reaching the right people.
              </p>
            </CardContent>
          </Card>
        ) : (
          segments.map((segment) => (
            <Card
              key={segment.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${
                selectedSegment?.id === segment.id ? "border-primary" : ""
              }`}
              onClick={() => selectSegment(segment)}
            >
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{segment.name}</CardTitle>
                    {segment.segment_type === "dynamic" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Funnel className="h-3 w-3" />
                        Dynamic
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <ListChecks className="h-3 w-3" />
                        Static
                      </Badge>
                    )}
                  </div>
                  {segment.description && (
                    <CardDescription>{segment.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(segment);
                    }}
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(segment.id);
                    }}
                    title="Delete"
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {segment.contact_count} contact
                  {segment.contact_count !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detail panel: static = checkboxes, dynamic = filter builder */}
      {selectedSegment && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {editingMeta ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-semibold text-lg h-8"
                        placeholder="Segment name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditMeta();
                          if (e.key === "Escape") setEditingMeta(false);
                        }}
                      />
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="text-sm h-7"
                        placeholder="Description (optional)"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditMeta();
                          if (e.key === "Escape") setEditingMeta(false);
                        }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={saveEditMeta}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingMeta(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div>
                      <CardTitle>
                        {selectedSegment.segment_type === "dynamic"
                          ? `Filter rules for "${selectedSegment.name}"`
                          : `Members of "${selectedSegment.name}"`}
                      </CardTitle>
                      <CardDescription>
                        {selectedSegment.description ||
                          (selectedSegment.segment_type === "dynamic"
                            ? "Edit the filter rules that define this segment."
                            : "Toggle contacts in this segment.")}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={startEditMeta}
                      title="Edit name and description"
                    >
                      <PencilSimple className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {selectedSegment.segment_type === "dynamic" && !editingMeta && (
                <Button
                  size="sm"
                  onClick={saveFilterRules}
                  disabled={savingRules}
                >
                  {savingRules ? "Saving..." : "Save rules"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedSegment.segment_type === "dynamic" && editingRules ? (
              <SegmentBuilder
                value={editingRules}
                onChange={setEditingRules}
                customFields={customFields}
                dataTables={dataTables}
                orgId={orgId}
              />
            ) : loadingMembers ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : contacts.length === 0 ? (
              <p className="text-muted-foreground">
                No contacts. Add some in the Contacts page first.
              </p>
            ) : (
              <div className="grid gap-2 max-h-80 overflow-y-auto">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={memberIds.has(contact.id)}
                      onCheckedChange={() => toggleMember(contact.id)}
                    />
                    <span className="text-sm">
                      {contact.email}
                      {contact.first_name &&
                        ` — ${contact.first_name} ${contact.last_name ?? ""}`}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
