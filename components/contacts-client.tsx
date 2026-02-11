"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, UploadSimple, Trash } from "@phosphor-icons/react";

type Contact = {
  id: string;
  org_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  created_at: string;
};

export function ContactsClient({
  contacts: initialContacts,
  orgId,
}: {
  contacts: Contact[];
  orgId: string;
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({ org_id: orgId, email, first_name: firstName || null, last_name: lastName || null })
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Contact already exists" : "Failed to add contact");
    } else {
      setContacts([data, ...contacts]);
      setEmail("");
      setFirstName("");
      setLastName("");
      toast.success("Contact added");
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete contact");
    } else {
      setContacts(contacts.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    }
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());

    const emailIdx = headers.findIndex((h) => h === "email");
    const firstIdx = headers.findIndex((h) => ["first_name", "firstname", "first name"].includes(h));
    const lastIdx = headers.findIndex((h) => ["last_name", "lastname", "last name"].includes(h));

    if (emailIdx === -1) {
      toast.error("CSV must have an 'email' column");
      setImporting(false);
      return;
    }

    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return {
        org_id: orgId,
        email: cols[emailIdx],
        first_name: firstIdx >= 0 ? cols[firstIdx] || null : null,
        last_name: lastIdx >= 0 ? cols[lastIdx] || null : null,
      };
    }).filter((r) => r.email);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .upsert(rows, { onConflict: "org_id,email" })
      .select();

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (error) {
      toast.error("Import failed: " + error.message);
    } else {
      toast.success(`Imported ${data?.length ?? 0} contacts`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} in your audience.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <UploadSimple className="mr-2 h-4 w-4" />
            {importing ? "Importing..." : "Import CSV"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          <Dialog>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add contact</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add contact</DialogTitle>
                <DialogDescription>Add a new contact to your audience.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Email</Label>
                  <Input id="contactEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactFirst">First name</Label>
                    <Input id="contactFirst" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactLast">Last name</Label>
                    <Input id="contactLast" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={adding}>{adding ? "Adding..." : "Add contact"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No contacts yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Add contacts manually or import a CSV.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>First name</TableHead>
                  <TableHead>Last name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.email}</TableCell>
                    <TableCell>{contact.first_name ?? "—"}</TableCell>
                    <TableCell>{contact.last_name ?? "—"}</TableCell>
                    <TableCell>
                      {contact.unsubscribed ? (
                        <Badge variant="outline">Unsubscribed</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(contact.id)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
