"use client";

import { useState } from "react";
import type { Flow, FlowNode } from "@/lib/flows/types";
import { DEFAULT_TRIGGER_CONFIG } from "@/lib/flows/types";
import { FlowEditor } from "./flow-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus,
  TreeStructure,
  Lightning,
  EnvelopeSimple,
  Clock,
  SignOut,
  HandWaving,
  Newspaper,
  ArrowCounterClockwise,
  Megaphone,
  RocketLaunch,
  Trash,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

type FlowWithNodes = Flow & { flow_nodes: FlowNode[] };

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
  steps: PlaybookStep[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PLAYBOOK_ICONS: Record<string, React.ComponentType<any>> = {
  HandWaving,
  Newspaper,
  ArrowCounterClockwise,
  Megaphone,
  RocketLaunch,
};

const SEGMENT_SUGGESTIONS: Record<string, string> = {
  welcome: "New subscribers who joined recently",
  winback: "Contacts who haven't engaged in 30+ days",
  newsletter: "All active subscribers",
  promotional: "Your most engaged contacts",
  onboarding: "New users who just signed up",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400",
  active: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400",
  paused: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
};

const NODE_ICONS: Record<string, React.ComponentType<{ className?: string; weight?: "regular" | "fill" }>> = {
  trigger: Lightning,
  send_email: EnvelopeSimple,
  delay: Clock,
  exit: SignOut,
};

export function FlowsClient({
  flows: initialFlows,
  emails: initialEmails,
  templates,
  segments,
  playbooks,
  orgId,
  fromName,
}: {
  flows: FlowWithNodes[];
  emails: { id: string; name: string; subject: string; body_html: string }[];
  templates: { id: string; name: string; subject: string; body_html: string; is_system: boolean }[];
  segments: { id: string; name: string; contact_count: number }[];
  playbooks: Playbook[];
  orgId: string;
  fromName: string;
}) {
  const [flows, setFlows] = useState(initialFlows);
  const [emails, setEmails] = useState(initialEmails);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Playbook | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const editingFlow = flows.find((f) => f.id === editingFlowId);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);

    try {
      // Create flow
      const { data: flow, error } = await supabase
        .from("flows")
        .insert({
          org_id: orgId,
          name: newName.trim(),
          description: selectedTemplate?.description ?? null,
          status: "draft",
          trigger_config: DEFAULT_TRIGGER_CONFIG,
        })
        .select()
        .single();

      if (error || !flow) throw error;

      // Build nodes based on whether a template was selected
      let nodeInserts: { flow_id: string; type: string; position: number; config: Record<string, unknown> }[];

      if (selectedTemplate) {
        const segHint = SEGMENT_SUGGESTIONS[selectedTemplate.category] ?? null;

        // Pre-populate from playbook steps with contextual hints
        nodeInserts = [{
          flow_id: flow.id, type: "trigger", position: 0,
          config: segHint ? { segment_hint: segHint } : {},
        }];
        let pos = 1;

        selectedTemplate.steps.forEach((step, i) => {
          // Add delay before this step (if delay_days > 0 and not the first step)
          if (step.delay_days > 0 && i > 0) {
            const duration = step.delay_days - (selectedTemplate.steps[i - 1]?.delay_days ?? 0);
            nodeInserts.push({
              flow_id: flow.id,
              type: "delay",
              position: pos++,
              config: { duration, unit: "days", hint: `Wait before "${step.title}"` },
            });
          }

          // Add send_email node with hint from playbook step
          nodeInserts.push({
            flow_id: flow.id,
            type: "send_email",
            position: pos++,
            config: {
              email_id: null,
              subject_override: null,
              hint: `${step.title}${step.description ? ` — ${step.description}` : ""}`,
            },
          });
        });

        nodeInserts.push({ flow_id: flow.id, type: "exit", position: pos, config: { reason: "completed" } });
      } else {
        // Blank flow: trigger + exit
        nodeInserts = [
          { flow_id: flow.id, type: "trigger", position: 0, config: {} },
          { flow_id: flow.id, type: "exit", position: 1, config: { reason: "completed" } },
        ];
      }

      const { data: nodes } = await supabase
        .from("flow_nodes")
        .insert(nodeInserts)
        .select();

      const newFlow: FlowWithNodes = {
        ...flow,
        flow_nodes: nodes ?? [],
      };

      setFlows([newFlow, ...flows]);
      setShowCreate(false);
      setNewName("");
      setSelectedTemplate(null);
      setEditingFlowId(flow.id);
      toast.success(selectedTemplate ? `Flow created from "${selectedTemplate.name}"` : "Flow created");
    } catch {
      toast.error("Failed to create flow");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(flowId: string) {
    const { error } = await supabase.from("flows").delete().eq("id", flowId);
    if (error) {
      toast.error("Failed to delete flow");
      return;
    }
    setFlows(flows.filter((f) => f.id !== flowId));
    toast.success("Flow deleted");
  }

  // ── Editor view ──────────────────────────────────────────

  if (editingFlow) {
    return (
      <div className="h-[calc(100vh-3.5rem)]">
        <FlowEditor
          initialFlow={editingFlow}
          initialNodes={editingFlow.flow_nodes.sort(
            (a, b) => a.position - b.position
          )}
          emails={emails}
          templates={templates}
          segments={segments}
          orgId={orgId}
          fromName={fromName}
          onEmailCreated={(email) => setEmails((prev) => [...prev, email])}
          onBack={() => {
            setEditingFlowId(null);
            router.refresh();
          }}
        />
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
            Flows
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Automated email journeys that run on autopilot.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Create Flow
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 flex items-center justify-center bg-stone-100 dark:bg-stone-800 mb-4">
              <TreeStructure className="w-6 h-6 text-stone-400" />
            </div>
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">
              No flows yet
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 max-w-sm">
              Create your first automated email journey. Add triggers, email
              steps, and delays to engage contacts on autopilot.
            </p>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Flow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {flows.map((flow) => {
            const nodeCount = flow.flow_nodes.filter(
              (n) => n.type !== "trigger"
            ).length;
            const emailCount = flow.flow_nodes.filter(
              (n) => n.type === "send_email"
            ).length;

            return (
              <Card
                key={flow.id}
                className="cursor-pointer hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
                onClick={() => setEditingFlowId(flow.id)}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 shrink-0">
                    <TreeStructure className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                        {flow.name}
                      </h3>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[flow.status] ?? STATUS_COLORS.draft}`}
                      >
                        {flow.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-stone-400 dark:text-stone-500">
                        {nodeCount} step{nodeCount !== 1 ? "s" : ""}
                      </span>
                      {emailCount > 0 && (
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          {emailCount} email{emailCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      {/* Node type preview dots */}
                      <div className="flex items-center gap-1">
                        {flow.flow_nodes
                          .sort((a, b) => a.position - b.position)
                          .slice(0, 6)
                          .map((n) => {
                            const Icon = NODE_ICONS[n.type] ?? Lightning;
                            return (
                              <Icon
                                key={n.id}
                                className="w-3 h-3 text-stone-300 dark:text-stone-600"
                              />
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-stone-400 dark:text-stone-500">
                      {new Date(flow.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${flow.name}"?`)) handleDelete(flow.id);
                      }}
                      className="p-1.5 text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) { setSelectedTemplate(null); setNewName(""); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create a new flow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Name input — always first */}
            <div className="grid gap-1.5">
              <Label htmlFor="flow-name">Flow name</Label>
              <Input
                id="flow-name"
                placeholder="e.g. Welcome Series"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>

            {/* Template picker — optional, below */}
            {playbooks.length > 0 && (
              <div className="grid gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground">Or start from a template</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-1.5">
                  {playbooks.map((pb) => {
                    const Icon = PLAYBOOK_ICONS[pb.icon] || Lightning;
                    const isSelected = selectedTemplate?.id === pb.id;
                    const maxDays = Math.max(...pb.steps.map((s) => s.delay_days), 0);
                    return (
                      <button
                        key={pb.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTemplate(null);
                            setNewName("");
                          } else {
                            setSelectedTemplate(pb);
                            setNewName(pb.name);
                          }
                        }}
                        className={`flex items-center gap-3 p-2.5 text-left transition-colors border ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center justify-center h-8 w-8 bg-muted shrink-0">
                          <Icon className="h-4 w-4" weight="duotone" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{pb.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {pb.steps.length} email{pb.steps.length !== 1 ? "s" : ""}
                            {maxDays > 0 && <> &middot; {maxDays} days</>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
