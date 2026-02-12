"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash, Users } from "@phosphor-icons/react";

type Segment = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  contact_count: number;
  created_at: string;
};

type ContactRef = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

export function SegmentsClient({
  segments: initialSegments,
  contacts,
  orgId,
}: {
  segments: Segment[];
  contacts: ContactRef[];
  orgId: string;
}) {
  const [segments, setSegments] = useState(initialSegments);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loadingMembers, setLoadingMembers] = useState(false);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("segments")
      .insert({ org_id: orgId, name, description: description || null })
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error("Failed to create segment");
    } else {
      setSegments([data, ...segments]);
      setName("");
      setDescription("");
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

  async function loadMembers(segment: Segment) {
    setSelectedSegment(segment);
    setLoadingMembers(true);

    const supabase = createClient();
    const { data } = await supabase
      .from("segment_contacts")
      .select("contact_id")
      .eq("segment_id", segment.id);

    setMemberIds(new Set((data ?? []).map((r) => r.contact_id)));
    setLoadingMembers(false);
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
        .insert({ segment_id: selectedSegment.id, contact_id: contactId });
      memberIds.add(contactId);
    }

    setMemberIds(new Set(memberIds));

    // Update count
    const newCount = memberIds.size;
    await supabase
      .from("segments")
      .update({ contact_count: newCount })
      .eq("id", selectedSegment.id);

    setSegments(segments.map((s) =>
      s.id === selectedSegment.id ? { ...s, contact_count: newCount } : s
    ));
    setSelectedSegment({ ...selectedSegment, contact_count: newCount });
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
            <Button><Plus className="mr-2 h-4 w-4" />Create segment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create segment</DialogTitle>
              <DialogDescription>Group contacts for targeted campaigns.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="segName">Name</Label>
                <Input id="segName" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="segDesc">Description</Label>
                <Input id="segDesc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={adding}>{adding ? "Creating..." : "Create"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {segments.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" weight="duotone" />
              <p className="text-muted-foreground font-medium">No segments yet</p>
              <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
                Segments group your contacts for targeted campaigns. Create your first segment to start reaching the right people.
              </p>
            </CardContent>
          </Card>
        ) : (
          segments.map((segment) => (
            <Card
              key={segment.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedSegment?.id === segment.id ? "border-primary" : ""}`}
              onClick={() => loadMembers(segment)}
            >
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                  {segment.description && (
                    <CardDescription>{segment.description}</CardDescription>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(segment.id); }}>
                  <Trash className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {segment.contact_count} contact{segment.contact_count !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedSegment && (
        <Card>
          <CardHeader>
            <CardTitle>Members of &ldquo;{selectedSegment.name}&rdquo;</CardTitle>
            <CardDescription>Toggle contacts in this segment.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : contacts.length === 0 ? (
              <p className="text-muted-foreground">No contacts. Add some in the Contacts page first.</p>
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
                      {contact.first_name && ` — ${contact.first_name} ${contact.last_name ?? ""}`}
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
