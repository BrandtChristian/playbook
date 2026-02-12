"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  CircleNotch,
  CheckCircle,
  Key,
  Users,
  ListChecks,
  Globe,
} from "@phosphor-icons/react";

type Domain = {
  id: string;
  name: string;
  status: string;
};

export function OnboardingWizard({
  orgId,
  orgName,
  open: initialOpen,
}: {
  orgId: string;
  orgName: string;
  open: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState(0);
  const router = useRouter();

  // Step 0: Resend
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [fromPrefix, setFromPrefix] = useState("hello");

  // Step 1: Contacts
  const [contactEmail, setContactEmail] = useState("");
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast, setContactLast] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const [addingContact, setAddingContact] = useState(false);

  // Step 2: Segment
  const [segmentName, setSegmentName] = useState("All Contacts");
  const [creatingSegment, setCreatingSegment] = useState(false);

  const STEPS = [
    { icon: Key, label: "Connect Resend" },
    { icon: Users, label: "Add Contacts" },
    { icon: ListChecks, label: "Create Segment" },
  ];

  async function handleConnect() {
    if (!apiKey.trim()) return;
    setConnecting(true);

    const supabase = createClient();
    // Save API key
    const { error: saveError } = await supabase
      .from("organizations")
      .update({ resend_api_key: apiKey.trim() })
      .eq("id", orgId);

    if (saveError) {
      toast.error("Failed to save API key");
      setConnecting(false);
      return;
    }

    // Fetch domains to validate key
    const res = await fetch("/api/resend/domains");
    const json = await res.json();

    if (!res.ok || json.error) {
      // Revert key
      await supabase
        .from("organizations")
        .update({ resend_api_key: null })
        .eq("id", orgId);
      toast.error(json.error || "Invalid API key");
      setConnecting(false);
      return;
    }

    setDomains(json.domains || []);
    setConnected(true);
    setConnecting(false);
    toast.success("Connected to Resend!");

    // Auto-select first verified domain
    const verified = (json.domains || []).find((d: Domain) => d.status === "verified");
    if (verified) {
      setSelectedDomain(verified);
    }
  }

  async function handleSaveSender() {
    if (!selectedDomain) return;
    const supabase = createClient();
    const fromEmail = `${fromPrefix}@${selectedDomain.name}`;
    await supabase
      .from("organizations")
      .update({
        from_email: fromEmail,
        from_name: orgName,
        domain_verified: selectedDomain.status === "verified",
      })
      .eq("id", orgId);
    setStep(1);
  }

  async function handleAddContact() {
    if (!contactEmail.trim()) return;
    setAddingContact(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("contacts")
      .insert({
        org_id: orgId,
        email: contactEmail.trim(),
        first_name: contactFirst || null,
        last_name: contactLast || null,
      });

    setAddingContact(false);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast.error("Contact already exists");
      } else {
        toast.error("Failed to add contact");
      }
    } else {
      setAddedCount((c) => c + 1);
      setContactEmail("");
      setContactFirst("");
      setContactLast("");
      toast.success("Contact added");
    }
  }

  async function handleCreateSegment() {
    setCreatingSegment(true);
    const supabase = createClient();

    // Create segment
    const { data: segment, error: segError } = await supabase
      .from("segments")
      .insert({ org_id: orgId, name: segmentName, description: "Auto-created during setup" })
      .select()
      .single();

    if (segError || !segment) {
      toast.error("Failed to create segment");
      setCreatingSegment(false);
      return;
    }

    // Add all contacts to the segment
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id")
      .eq("org_id", orgId);

    if (contacts && contacts.length > 0) {
      const memberships = contacts.map((c) => ({
        segment_id: segment.id,
        contact_id: c.id,
      }));
      await supabase.from("segment_contacts").insert(memberships);
      await supabase
        .from("segments")
        .update({ contact_count: contacts.length })
        .eq("id", segment.id);
    }

    // Mark onboarding as complete
    await supabase
      .from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", orgId);

    setCreatingSegment(false);
    toast.success("Setup complete!");
    setOpen(false);
    router.refresh();
  }

  function handleClose() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Welcome to Forge</DialogTitle>
          <DialogDescription>
            Let&apos;s get {orgName} set up in 3 quick steps.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 pb-2">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 text-xs font-medium ${
                i === step ? "text-primary" : i < step ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}
            >
              {i < step ? (
                <CheckCircle className="h-4 w-4 text-primary" weight="fill" />
              ) : (
                <s.icon className="h-4 w-4" weight={i === step ? "fill" : "regular"} />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0: Connect Resend */}
        {step === 0 && !connected && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Resend API Key</Label>
              <Input
                type="password"
                placeholder="re_xxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConnect(); }}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  resend.com/api-keys
                </a>
              </p>
            </div>
            <Button onClick={handleConnect} disabled={connecting || !apiKey.trim()} className="w-full">
              {connecting ? (
                <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Connecting...</>
              ) : (
                <>Connect</>
              )}
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setStep(1)}>
              Skip for now
            </Button>
          </div>
        )}

        {/* Step 0b: Domain picker */}
        {step === 0 && connected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />
              <span className="text-green-700">Connected to Resend</span>
            </div>

            {domains.length > 0 ? (
              <>
                <div className="grid gap-2">
                  <Label>Select your domain</Label>
                  <div className="space-y-2">
                    {domains.map((d) => (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                          selectedDomain?.id === d.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                        }`}
                        onClick={() => setSelectedDomain(d)}
                      >
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span className="font-medium text-sm">{d.name}</span>
                        </div>
                        <Badge
                          variant={d.status === "verified" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {d.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedDomain && (
                  <div className="grid gap-2">
                    <Label>From address</Label>
                    <div className="flex items-center gap-0">
                      <Input
                        value={fromPrefix}
                        onChange={(e) => setFromPrefix(e.target.value)}
                        className="rounded-r-none"
                      />
                      <div className="bg-muted border border-l-0 rounded-r-md px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        @{selectedDomain.name}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No domains found. Add a domain at{" "}
                <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  resend.com/domains
                </a>{" "}
                first.
              </p>
            )}

            <Button onClick={handleSaveSender} disabled={!selectedDomain} className="w-full">
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Add contacts */}
        {step === 1 && (
          <div className="space-y-4">
            {addedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" weight="fill" />
                <span className="text-green-700">{addedCount} contact{addedCount !== 1 ? "s" : ""} added</span>
              </div>
            )}

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>First name</Label>
                  <Input
                    placeholder="Jane"
                    value={contactFirst}
                    onChange={(e) => setContactFirst(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Last name</Label>
                  <Input
                    placeholder="Smith"
                    value={contactLast}
                    onChange={(e) => setContactLast(e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleAddContact}
                disabled={addingContact || !contactEmail.trim()}
              >
                {addingContact ? (
                  <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  <>Add contact</>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              You can bulk-import contacts from CSV later on the Contacts page.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                {addedCount > 0 ? "Next" : "Skip"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Create segment */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Segments group your contacts for targeted campaigns. We&apos;ll create one with all your contacts.
            </p>

            <div className="grid gap-2">
              <Label>Segment name</Label>
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />Back
              </Button>
              <Button
                onClick={handleCreateSegment}
                disabled={creatingSegment || !segmentName.trim()}
                className="flex-1"
              >
                {creatingSegment ? (
                  <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                ) : (
                  <>Finish Setup <CheckCircle className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
