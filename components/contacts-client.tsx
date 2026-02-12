"use client";

import { useState } from "react";
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
import { Plus, Trash, ShieldCheck, CircleNotch } from "@phosphor-icons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import type { CustomFieldDefinition } from "@/lib/segments/types";

type Contact = {
  id: string;
  org_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  address_city: string | null;
  address_country: string | null;
  unsubscribed: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
};

export function ContactsClient({
  contacts: initialContacts,
  orgId,
  customFields = [],
}: {
  contacts: Contact[];
  orgId: string;
  customFields?: CustomFieldDefinition[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [contactConsents, setContactConsents] = useState<
    { consent_type_id: string; consent_type_name: string; consent_type_desc: string | null; granted: boolean }[]
  >([]);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [savingConsent, setSavingConsent] = useState<string | null>(null);
  const router = useRouter();

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        org_id: orgId,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        company: company || null,
        job_title: jobTitle || null,
      })
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
      setPhone("");
      setCompany("");
      setJobTitle("");
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

  async function openContactDetail(contact: Contact) {
    setDetailContact(contact);
    setLoadingConsents(true);

    const supabase = createClient();
    // Fetch consent types for this org and current consents for this contact
    const [{ data: types }, { data: consents }] = await Promise.all([
      supabase.from("consent_types").select("id, name, description").eq("org_id", orgId).eq("is_active", true),
      supabase.from("contact_consents").select("consent_type_id, granted").eq("contact_id", contact.id),
    ]);

    const consentMap = new Map((consents ?? []).map((c) => [c.consent_type_id, c.granted]));
    setContactConsents(
      (types ?? []).map((t) => ({
        consent_type_id: t.id,
        consent_type_name: t.name,
        consent_type_desc: t.description,
        granted: consentMap.get(t.id) ?? false,
      }))
    );
    setLoadingConsents(false);
  }

  async function toggleConsent(consentTypeId: string, granted: boolean) {
    if (!detailContact) return;
    setSavingConsent(consentTypeId);

    const supabase = createClient();
    const { error } = await supabase
      .from("contact_consents")
      .upsert(
        {
          contact_id: detailContact.id,
          consent_type_id: consentTypeId,
          granted,
          granted_at: granted ? new Date().toISOString() : null,
          revoked_at: granted ? null : new Date().toISOString(),
          source: "admin",
        },
        { onConflict: "contact_id,consent_type_id" }
      );

    setSavingConsent(null);
    if (error) {
      toast.error("Failed to update consent");
    } else {
      setContactConsents((prev) =>
        prev.map((c) => (c.consent_type_id === consentTypeId ? { ...c, granted } : c))
      );
      toast.success(granted ? "Consent granted" : "Consent revoked");
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
          <CsvImportDialog orgId={orgId} />
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactCompany">Company</Label>
                    <Input id="contactCompany" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">Phone</Label>
                    <Input id="contactPhone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactJobTitle">Job title</Label>
                  <Input id="contactJobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
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
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id} className="cursor-pointer" onClick={() => openContactDetail(contact)}>
                    <TableCell className="font-medium">{contact.email}</TableCell>
                    <TableCell>{contact.first_name ?? "—"}</TableCell>
                    <TableCell>{contact.last_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.company ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{contact.phone ?? "—"}</TableCell>
                    <TableCell>
                      {contact.unsubscribed ? (
                        <Badge variant="outline">Unsubscribed</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(contact.id); }}>
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

      {/* Contact Detail Dialog */}
      <Dialog open={!!detailContact} onOpenChange={(v) => { if (!v) setDetailContact(null); }}>
        <DialogContent className="max-w-lg">
          {detailContact && (
            <>
              <DialogHeader>
                <DialogTitle>{detailContact.email}</DialogTitle>
                <DialogDescription>
                  Contact details and consent status.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">First name</span>
                  <p className="font-medium">{detailContact.first_name ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last name</span>
                  <p className="font-medium">{detailContact.last_name ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Company</span>
                  <p className="font-medium">{detailContact.company ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{detailContact.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Job title</span>
                  <p className="font-medium">{detailContact.job_title ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Location</span>
                  <p className="font-medium">
                    {[detailContact.address_city, detailContact.address_country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>

              {customFields.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium text-muted-foreground">Custom Fields</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {customFields.map((field) => {
                      const val = detailContact.data?.[field.name];
                      return (
                        <div key={field.id}>
                          <span className="text-muted-foreground">{field.label}</span>
                          <p className="font-medium">{val != null && val !== "" ? String(val) : "—"}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" weight="duotone" />
                  <span className="text-sm font-medium">Consent Status</span>
                </div>

                {loadingConsents ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <CircleNotch className="h-4 w-4 animate-spin" />
                    Loading consents...
                  </div>
                ) : contactConsents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No consent types configured.</p>
                ) : (
                  <div className="space-y-2">
                    {contactConsents.map((cc) => (
                      <div key={cc.consent_type_id} className="flex items-start gap-3 p-3 rounded-md border">
                        <Checkbox
                          checked={cc.granted}
                          disabled={savingConsent === cc.consent_type_id}
                          onCheckedChange={(checked) => toggleConsent(cc.consent_type_id, !!checked)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-none">{cc.consent_type_name}</p>
                          {cc.consent_type_desc && (
                            <p className="text-xs text-muted-foreground mt-1">{cc.consent_type_desc}</p>
                          )}
                        </div>
                        <Badge variant={cc.granted ? "default" : "outline"} className="shrink-0">
                          {cc.granted ? "Granted" : "Revoked"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
