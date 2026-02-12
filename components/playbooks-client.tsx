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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  HandWaving,
  Newspaper,
  ArrowCounterClockwise,
  Megaphone,
  RocketLaunch,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Lightning,
} from "@phosphor-icons/react";
import { TemplateEditor } from "@/components/template-editor";

type PlaybookStep = {
  title: string;
  description: string;
  template_id: string;
  delay_days: number;
};

type Playbook = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  is_system: boolean;
  steps: PlaybookStep[];
  created_at: string;
};

type Segment = {
  id: string;
  name: string;
  contact_count: number;
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONS: Record<string, React.ComponentType<any>> = {
  HandWaving,
  Newspaper,
  ArrowCounterClockwise,
  Megaphone,
  RocketLaunch,
};

const CATEGORY_COLORS: Record<string, string> = {
  welcome: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  newsletter: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  winback: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  promotional: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  onboarding: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  transactional: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export function PlaybooksClient({
  playbooks,
  segments,
  orgId,
  fromName,
}: {
  playbooks: Playbook[];
  segments: Segment[];
  orgId: string;
  fromName?: string;
}) {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [campaignName, setCampaignName] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [stepTemplates, setStepTemplates] = useState<Record<string, Template>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [creating, setCreating] = useState(false);

  async function handleSelectPlaybook(playbook: Playbook) {
    setSelectedPlaybook(playbook);
    setWizardStep(0);
    setCampaignName(`${playbook.name} Campaign`);
    setSelectedSegmentId("");

    // Load all templates for this playbook
    setLoadingTemplates(true);
    const supabase = createClient();
    const templateIds = playbook.steps.map((s) => s.template_id);
    const { data } = await supabase
      .from("templates")
      .select("*")
      .in("id", templateIds);

    const map: Record<string, Template> = {};
    (data ?? []).forEach((t) => {
      map[t.id] = t;
    });
    setStepTemplates(map);
    setLoadingTemplates(false);
  }

  function handleBack() {
    if (editingTemplate) {
      setEditingTemplate(null);
    } else if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    } else {
      setSelectedPlaybook(null);
      setStepTemplates({});
    }
  }

  async function handleCreateCampaigns() {
    if (!selectedPlaybook || !selectedSegmentId) return;

    setCreating(true);
    const supabase = createClient();

    // Create a campaign for each step in the playbook
    for (const step of selectedPlaybook.steps) {
      const template = stepTemplates[step.template_id];
      if (!template) continue;

      await supabase.from("campaigns").insert({
        org_id: orgId,
        name: `${campaignName} — ${step.title}`,
        template_id: template.id,
        segment_id: selectedSegmentId,
        subject: template.subject,
        body_html: template.body_html,
        status: "draft",
      });
    }

    setCreating(false);
    toast.success(
      `Created ${selectedPlaybook.steps.length} campaign draft${selectedPlaybook.steps.length > 1 ? "s" : ""} from "${selectedPlaybook.name}"`
    );
    setSelectedPlaybook(null);
    setStepTemplates({});
  }

  // Template editor sub-view
  if (editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        fromName={fromName}
        onBack={() => setEditingTemplate(null)}
        onSaved={(updated) => {
          setStepTemplates((prev) => ({ ...prev, [updated.id]: updated }));
          setEditingTemplate(null);
        }}
      />
    );
  }

  // Wizard view
  if (selectedPlaybook) {
    const steps = selectedPlaybook.steps;
    const Icon = ICONS[selectedPlaybook.icon] || Lightning;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5" weight="duotone" />
              <h1 className="text-2xl font-bold tracking-tight">
                {selectedPlaybook.name}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedPlaybook.description}
            </p>
          </div>
        </div>

        {/* Wizard progress */}
        <div className="flex items-center gap-2">
          {["Configure", "Review Emails", "Launch"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <button
                onClick={() => setWizardStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                  i === wizardStep
                    ? "bg-primary text-primary-foreground"
                    : i < wizardStep
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {i < wizardStep ? (
                  <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
                {label}
              </button>
              {i < 2 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Configure */}
        {wizardStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Configure Your Campaign</CardTitle>
              <CardDescription>
                Name your campaign and choose a target segment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 max-w-lg">
              <div className="grid gap-2">
                <Label htmlFor="campaignName">Campaign name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Target segment</Label>
                {segments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No segments yet. Create one in the Segments page first.
                  </p>
                ) : (
                  <Select
                    value={selectedSegmentId}
                    onValueChange={setSelectedSegmentId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((seg) => (
                        <SelectItem key={seg.id} value={seg.id}>
                          {seg.name} ({seg.contact_count} contacts)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                onClick={() => setWizardStep(1)}
                disabled={!campaignName.trim() || !selectedSegmentId}
                className="w-fit"
              >
                Next: Review Emails
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Review Emails */}
        {wizardStep === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Sequence</CardTitle>
                <CardDescription>
                  Review and customize each email in the playbook. Click
                  &ldquo;Edit&rdquo; to open the template editor.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTemplates ? (
                  <p className="text-sm text-muted-foreground">
                    Loading templates...
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {steps.map((step, i) => {
                      const template = stepTemplates[step.template_id];
                      return (
                        <div
                          key={step.template_id}
                          className="flex items-center gap-4 p-4 border"
                        >
                          <div className="flex items-center justify-center h-8 w-8 bg-muted text-sm font-bold shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">
                              {step.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {step.description}
                            </p>
                            {template && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Subject: {template.subject}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {step.delay_days > 0 && (
                              <Badge variant="outline" className="gap-1">
                                <Clock className="h-3 w-3" />
                                Day {step.delay_days}
                              </Badge>
                            )}
                            {step.delay_days === 0 && (
                              <Badge variant="outline" className="gap-1">
                                <Lightning className="h-3 w-3" />
                                Immediate
                              </Badge>
                            )}
                            {template && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingTemplate(template)}
                              >
                                Edit
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setWizardStep(0)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setWizardStep(2)}>
                Next: Launch
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Launch */}
        {wizardStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Ready to Launch</CardTitle>
              <CardDescription>
                Review your setup and create campaign drafts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Playbook</span>
                  <span className="font-medium">{selectedPlaybook.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Campaign name</span>
                  <span className="font-medium">{campaignName}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Target segment</span>
                  <span className="font-medium">
                    {segments.find((s) => s.id === selectedSegmentId)?.name}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Emails</span>
                  <span className="font-medium">
                    {steps.length} email{steps.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">
                    {Math.max(...steps.map((s) => s.delay_days))} days
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button onClick={handleCreateCampaigns} disabled={creating}>
                  {creating ? "Creating..." : "Create Campaign Drafts"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This creates draft campaigns — you can review and send them from
                the Campaigns page.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Browse view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Playbooks</h1>
        <p className="text-muted-foreground mt-1">
          Proven email strategies to get your marketing running. Pick a
          playbook, customize the content, and launch.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {playbooks.map((playbook) => {
          const Icon = ICONS[playbook.icon] || Lightning;
          const colorClass =
            CATEGORY_COLORS[playbook.category] || CATEGORY_COLORS.transactional;

          return (
            <Card
              key={playbook.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
              onClick={() => handleSelectPlaybook(playbook)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-9 w-9 bg-muted">
                      <Icon className="h-5 w-5" weight="duotone" />
                    </div>
                    <CardTitle className="text-base">
                      {playbook.name}
                    </CardTitle>
                  </div>
                  <Badge className={colorClass} variant="secondary">
                    {playbook.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {playbook.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {playbook.steps.length} email
                    {playbook.steps.length > 1 ? "s" : ""}
                  </span>
                  {playbook.steps.length > 1 && (
                    <>
                      <span>·</span>
                      <span>
                        {Math.max(...playbook.steps.map((s: PlaybookStep) => s.delay_days))}{" "}
                        days
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
