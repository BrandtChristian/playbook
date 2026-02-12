"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Plus,
  PaperPlaneTilt,
  Eye,
  Trash,
  EnvelopeSimple,
  Clock,
  CheckCircle,
  WarningCircle,
  CircleNotch,
  ArrowLeft,
  PaperPlaneRight,
  CaretRight,
  CaretDown,
  Notebook,
} from "@phosphor-icons/react";
import { TemplateEditor } from "@/components/template-editor";

type Campaign = {
  id: string;
  org_id: string;
  name: string;
  template_id: string | null;
  segment_id: string | null;
  subject: string;
  body_html: string;
  status: string;
  resend_broadcast_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  stats: Record<string, number> | null;
  created_at: string;
};

type TemplateRef = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
};

type Segment = {
  id: string;
  name: string;
  contact_count: number;
};

const STATUS_BADGE: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode; label: string }
> = {
  draft: {
    variant: "outline",
    icon: <Clock className="h-3 w-3" />,
    label: "Draft",
  },
  scheduled: {
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
    label: "Scheduled",
  },
  sending: {
    variant: "secondary",
    icon: <CircleNotch className="h-3 w-3 animate-spin" />,
    label: "Sending",
  },
  sent: {
    variant: "default",
    icon: <CheckCircle className="h-3 w-3" weight="fill" />,
    label: "Sent",
  },
  failed: {
    variant: "destructive",
    icon: <WarningCircle className="h-3 w-3" />,
    label: "Failed",
  },
};

type CampaignGroup =
  | { type: "standalone"; campaign: Campaign }
  | { type: "sequence"; name: string; campaigns: Campaign[] };

function groupCampaigns(campaigns: Campaign[]): CampaignGroup[] {
  const groups: CampaignGroup[] = [];
  const sequenceMap = new Map<string, Campaign[]>();

  for (const c of campaigns) {
    const dashIdx = c.name.indexOf(" \u2014 ");
    if (dashIdx > 0) {
      const prefix = c.name.substring(0, dashIdx);
      if (!sequenceMap.has(prefix)) sequenceMap.set(prefix, []);
      sequenceMap.get(prefix)!.push(c);
    } else {
      groups.push({ type: "standalone", campaign: c });
    }
  }

  for (const [name, seqCampaigns] of sequenceMap) {
    if (seqCampaigns.length === 1) {
      groups.push({ type: "standalone", campaign: seqCampaigns[0] });
    } else {
      groups.push({ type: "sequence", name, campaigns: seqCampaigns });
    }
  }

  groups.sort((a, b) => {
    const aDate = a.type === "standalone" ? a.campaign.created_at : a.campaigns[0].created_at;
    const bDate = b.type === "standalone" ? b.campaign.created_at : b.campaigns[0].created_at;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return groups;
}

function summarizeStatuses(campaigns: Campaign[]): string {
  const counts: Record<string, number> = {};
  for (const c of campaigns) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
}

export function CampaignsClient({
  campaigns: initialCampaigns,
  templates,
  segments,
  orgId,
  fromName,
  fromEmail,
  userEmail,
}: {
  campaigns: Campaign[];
  templates: TemplateRef[];
  segments: Segment[];
  orgId: string;
  fromName?: string;
  fromEmail: string | null;
  userEmail: string;
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Create form state
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [adding, setAdding] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTo, setTestTo] = useState(userEmail);
  const [realLinks, setRealLinks] = useState(false);

  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        org_id: orgId,
        name,
        template_id: templateId,
        segment_id: segmentId || null,
        subject: template.subject,
        body_html: template.body_html,
        status: "draft",
      })
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error("Failed to create campaign");
    } else {
      setCampaigns([data, ...campaigns]);
      setName("");
      setTemplateId("");
      setSegmentId("");
      toast.success("Campaign created");
      setSelectedCampaign(data);
    }
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete campaign");
    } else {
      setCampaigns(campaigns.filter((c) => c.id !== id));
      if (selectedCampaign?.id === id) setSelectedCampaign(null);
      toast.success("Campaign deleted");
    }
  }

  async function handleSendTest() {
    if (!selectedCampaign || !testTo) return;
    setSendingTest(true);

    try {
      const res = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selectedCampaign.subject,
          bodyHtml: selectedCampaign.body_html,
          to: testTo,
          realLinks,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Test email sent to ${testTo}`);
      } else {
        toast.error(json.error || "Failed to send test email");
      }
    } catch {
      toast.error("Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendCampaign() {
    if (!selectedCampaign) return;
    setSending(true);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: selectedCampaign.id }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Campaign sent! ${json.sent} delivered, ${json.failed} failed.`);
        // Update local state
        setCampaigns(
          campaigns.map((c) =>
            c.id === selectedCampaign.id
              ? {
                  ...c,
                  status: json.status,
                  sent_at: new Date().toISOString(),
                  stats: { sent: json.sent, failed: json.failed, total: json.total },
                }
              : c
          )
        );
        setSelectedCampaign({
          ...selectedCampaign,
          status: json.status,
          sent_at: new Date().toISOString(),
          stats: { sent: json.sent, failed: json.failed, total: json.total },
        });
      } else {
        toast.error(json.error || "Failed to send campaign");
      }
    } catch {
      toast.error("Failed to send campaign");
    } finally {
      setSending(false);
    }
  }

  // Template editor sub-view
  if (editingCampaign && selectedCampaign) {
    return (
      <TemplateEditor
        template={{
          id: selectedCampaign.id,
          org_id: orgId,
          name: selectedCampaign.name,
          description: null,
          subject: selectedCampaign.subject,
          body_html: selectedCampaign.body_html,
          category: null,
          is_system: false,
          created_at: selectedCampaign.created_at,
        }}
        fromName={fromName}
        onBack={() => setEditingCampaign(false)}
        onSaved={(updated) => {
          const updatedCampaign = {
            ...selectedCampaign,
            subject: updated.subject,
            body_html: updated.body_html,
            name: updated.name,
          };
          setSelectedCampaign(updatedCampaign);
          setCampaigns(
            campaigns.map((c) =>
              c.id === updatedCampaign.id ? updatedCampaign : c
            )
          );
          setEditingCampaign(false);
        }}
      />
    );
  }

  // Campaign detail view
  if (selectedCampaign) {
    const statusInfo = STATUS_BADGE[selectedCampaign.status] || STATUS_BADGE.draft;
    const segment = segments.find((s) => s.id === selectedCampaign.segment_id);
    const stats = selectedCampaign.stats;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedCampaign(null)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {selectedCampaign.name}
                </h1>
                <Badge variant={statusInfo.variant} className="gap-1">
                  {statusInfo.icon}
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Subject: {selectedCampaign.subject}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Campaign info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segment</span>
                <span className="font-medium">
                  {segment
                    ? `${segment.name} (${segment.contact_count} contacts)`
                    : "None selected"}
                </span>
              </div>
              {selectedCampaign.sent_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent at</span>
                  <span className="font-medium">
                    {new Date(selectedCampaign.sent_at).toLocaleString()}
                  </span>
                </div>
              )}
              {stats && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivered</span>
                    <span className="font-medium text-green-600">
                      {stats.sent ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failed</span>
                    <span className="font-medium text-red-600">
                      {stats.failed ?? 0}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCampaign.status === "draft" && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setEditingCampaign(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Edit Content
                  </Button>

                  {/* Test email */}
                  <div className="grid gap-2">
                    <Label className="text-xs">Send test email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        onClick={handleSendTest}
                        disabled={sendingTest || !testTo || !fromEmail}
                      >
                        {sendingTest ? (
                          <CircleNotch className="h-4 w-4 animate-spin" />
                        ) : (
                          <PaperPlaneRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRealLinks(!realLinks)}
                      className={`text-xs px-2 py-1 border rounded-sm transition-colors w-fit ${
                        realLinks
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-input hover:bg-muted"
                      }`}
                    >
                      Include real unsub/preference links
                    </button>
                  </div>

                  {/* Send to segment */}
                  {segment && (
                    <Button
                      className="w-full"
                      onClick={handleSendCampaign}
                      disabled={sending || !fromEmail}
                    >
                      {sending ? (
                        <>
                          <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                          Sending to {segment.contact_count} contacts...
                        </>
                      ) : (
                        <>
                          <PaperPlaneTilt className="mr-2 h-4 w-4" />
                          Send to {segment.name} ({segment.contact_count}{" "}
                          contacts)
                        </>
                      )}
                    </Button>
                  )}

                  {!fromEmail && (
                    <p className="text-xs text-amber-600">
                      Configure a sending domain in Settings before sending.
                    </p>
                  )}
                </>
              )}

              {selectedCampaign.status !== "draft" && (
                <p className="text-sm text-muted-foreground">
                  This campaign has been {selectedCampaign.status}.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Campaign list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground mt-1">
            Create and send email campaigns to your segments.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create campaign</DialogTitle>
              <DialogDescription>
                Choose a template and target segment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="campName">Campaign name</Label>
                <Input
                  id="campName"
                  placeholder="Monthly Newsletter - Feb"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Target segment</Label>
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a segment (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.contact_count} contacts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={adding || !templateId}>
                  {adding ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <EnvelopeSimple
              className="h-12 w-12 text-muted-foreground mb-4"
              weight="duotone"
            />
            <p className="text-muted-foreground">No campaigns yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a campaign or use a Playbook to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {groupCampaigns(campaigns).map((group) => {
            if (group.type === "standalone") {
              const campaign = group.campaign;
              const statusInfo = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft;
              const segment = segments.find((s) => s.id === campaign.segment_id);

              return (
                <Card
                  key={campaign.id}
                  className="cursor-pointer transition-colors hover:border-primary/50"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{campaign.name}</p>
                        <Badge variant={statusInfo.variant} className="gap-1 shrink-0">
                          {statusInfo.icon}
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {campaign.subject}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {segment && <span>{segment.name}</span>}
                        {campaign.sent_at && (
                          <span>Sent {new Date(campaign.sent_at).toLocaleDateString()}</span>
                        )}
                        {campaign.stats && (
                          <span>{(campaign.stats as Record<string, number>).sent ?? 0} delivered</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {campaign.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id); }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Sequence group
            const isExpanded = expandedGroups.has(group.name);
            const segment = segments.find((s) => s.id === group.campaigns[0].segment_id);
            const totalDelivered = group.campaigns.reduce((sum, c) => sum + ((c.stats as Record<string, number>)?.sent ?? 0), 0);

            return (
              <Card key={`seq-${group.name}`} className="transition-colors hover:border-primary/50">
                <CardContent className="p-0">
                  {/* Sequence header */}
                  <button
                    type="button"
                    className="flex items-center justify-between w-full py-4 px-6 text-left"
                    onClick={() => {
                      setExpandedGroups((prev) => {
                        const next = new Set(prev);
                        next.has(group.name) ? next.delete(group.name) : next.add(group.name);
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
                          <p className="font-medium truncate">{group.name}</p>
                          <Badge variant="secondary" className="shrink-0">
                            {group.campaigns.length} emails
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{summarizeStatuses(group.campaigns)}</span>
                          {segment && <span>{segment.name}</span>}
                          {totalDelivered > 0 && <span>{totalDelivered} delivered</span>}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded steps */}
                  {isExpanded && (
                    <div className="border-t">
                      {group.campaigns.map((campaign, i) => {
                        const stepStatusInfo = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft;
                        const stepName = campaign.name.substring(campaign.name.indexOf(" \u2014 ") + 3);

                        return (
                          <div
                            key={campaign.id}
                            className={`flex items-center justify-between py-3 pl-14 pr-6 cursor-pointer hover:bg-muted/50 transition-colors ${
                              i < group.campaigns.length - 1 ? "border-b" : ""
                            }`}
                            onClick={() => setSelectedCampaign(campaign)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm truncate">{stepName}</p>
                                <Badge variant={stepStatusInfo.variant} className="gap-1 shrink-0 text-xs">
                                  {stepStatusInfo.icon}
                                  {stepStatusInfo.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {campaign.subject}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4 text-xs text-muted-foreground">
                              {campaign.stats && (
                                <span>{(campaign.stats as Record<string, number>).sent ?? 0} delivered</span>
                              )}
                              {campaign.status === "draft" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(campaign.id); }}
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
