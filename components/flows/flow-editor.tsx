"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Flow, FlowNode, FlowNodeConfig } from "@/lib/flows/types";
import { DEFAULT_TRIGGER_CONFIG, NODE_PALETTE } from "@/lib/flows/types";
import type { SendEmailConfig } from "@/lib/flows/types";
import { FlowTimeline } from "./flow-timeline";
import { FlowNodeProperties } from "./flow-node-properties";
import { FlowSettingsPanel } from "./flow-settings-panel";
import { TemplateEditor } from "@/components/template-editor";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export function FlowEditor({
  initialFlow,
  initialNodes,
  emails,
  templates,
  segments,
  orgId,
  fromName,
  onEmailCreated,
  onBack,
}: {
  initialFlow: Flow;
  initialNodes: FlowNode[];
  emails: { id: string; name: string; subject?: string; body_html?: string }[];
  templates: { id: string; name: string; subject: string; body_html: string; is_system: boolean }[];
  segments: { id: string; name: string }[];
  orgId: string;
  fromName?: string;
  onEmailCreated: (email: { id: string; name: string; subject: string; body_html: string }) => void;
  onBack: () => void;
}) {
  const [flow, setFlow] = useState<Flow>(initialFlow);
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // ── Auto-save with debounce ──────────────────────────────

  const save = useCallback(
    async (flowData: Flow, nodeData: FlowNode[]) => {
      setSaving(true);
      try {
        // Save flow metadata
        await supabase
          .from("flows")
          .update({
            name: flowData.name,
            status: flowData.status,
            trigger_config: flowData.trigger_config,
            updated_at: new Date().toISOString(),
          })
          .eq("id", flowData.id);

        // Delete existing nodes and re-insert (simplest approach for ordering)
        await supabase.from("flow_nodes").delete().eq("flow_id", flowData.id);

        if (nodeData.length > 0) {
          await supabase.from("flow_nodes").insert(
            nodeData.map((n, i) => ({
              id: n.id,
              flow_id: flowData.id,
              type: n.type,
              position: i,
              config: n.config,
            }))
          );
        }
      } catch {
        toast.error("Failed to save flow");
      } finally {
        setSaving(false);
      }
    },
    [supabase]
  );

  const debouncedSave = useCallback(
    (flowData: Flow, nodeData: FlowNode[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => save(flowData, nodeData), 600);
    },
    [save]
  );

  // ── Flow updates ─────────────────────────────────────────

  function updateFlow(updates: Partial<Flow>) {
    const updated = { ...flow, ...updates };
    setFlow(updated);
    debouncedSave(updated, nodes);
  }

  // ── Node CRUD ────────────────────────────────────────────

  function insertNode(afterPosition: number, type: string) {
    const paletteItem = NODE_PALETTE.find((p) => p.type === type);
    if (!paletteItem) return;

    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      flow_id: flow.id,
      type: paletteItem.type,
      position: afterPosition + 1,
      config: paletteItem.factory().config,
      created_at: new Date().toISOString(),
    };

    // Shift positions of nodes after the insert point
    const updated = nodes.map((n) =>
      n.position > afterPosition ? { ...n, position: n.position + 1 } : n
    );
    const newNodes = [...updated, newNode].sort(
      (a, b) => a.position - b.position
    );

    setNodes(newNodes);
    setSelectedNodeId(newNode.id);
    debouncedSave(flow, newNodes);
  }

  function updateNodeConfig(nodeId: string, config: FlowNodeConfig) {
    const updated = nodes.map((n) => {
      if (n.id !== nodeId) return n;

      // If this is the trigger node, also update flow.trigger_config
      if (n.type === "trigger") {
        const triggerConfig = config as Flow["trigger_config"];
        const updatedFlow = { ...flow, trigger_config: triggerConfig };
        setFlow(updatedFlow);
        debouncedSave(updatedFlow, nodes.map((nn) => (nn.id === nodeId ? { ...nn, config } : nn)));
        return { ...n, config };
      }

      return { ...n, config };
    });

    setNodes(updated);
    if (!updated.find((n) => n.type === "trigger" && n.id === nodeId)) {
      debouncedSave(flow, updated);
    }
  }

  function deleteNode(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === "trigger") return; // Can't delete trigger

    const updated = nodes
      .filter((n) => n.id !== nodeId)
      .map((n, i) => ({ ...n, position: i }));

    setNodes(updated);
    setSelectedNodeId(null);
    debouncedSave(flow, updated);
    toast.success("Step removed");
  }

  // ── Email editor overlay ──────────────────────────────

  const editingEmail = emails.find((e) => e.id === editingEmailId);
  if (editingEmail) {
    return (
      <TemplateEditor
        template={{
          id: editingEmail.id,
          org_id: orgId,
          name: editingEmail.name,
          description: null,
          subject: (editingEmail as { subject?: string }).subject ?? "",
          body_html: (editingEmail as { body_html?: string }).body_html ?? "",
          category: null,
          is_system: false,
          created_at: "",
        }}
        fromName={fromName}
        saveTable="emails"
        onBack={() => setEditingEmailId(null)}
        onSaved={(updated) => {
          // Update emails list without closing — auto-save triggers this too
          onEmailCreated({ id: updated.id, name: updated.name, subject: updated.subject, body_html: updated.body_html });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FlowSettingsPanel
        flow={flow}
        onNameChange={(name) => updateFlow({ name })}
        onStatusChange={(status) => updateFlow({ status })}
        onBack={onBack}
        saving={saving}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Timeline */}
        <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-950">
          <FlowTimeline
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onInsertNode={insertNode}
            emails={emails}
            segments={segments}
          />
        </div>

        {/* Properties panel */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden"
            >
              <div className="w-80 p-4 overflow-y-auto h-full">
                <FlowNodeProperties
                  node={selectedNode}
                  onUpdate={(config) =>
                    updateNodeConfig(selectedNode.id, config)
                  }
                  onDelete={
                    selectedNode.type !== "trigger"
                      ? () => deleteNode(selectedNode.id)
                      : null
                  }
                  emails={emails}
                  templates={templates}
                  segments={segments}
                  orgId={orgId}
                  onEmailCreated={onEmailCreated}
                  onEditEmail={setEditingEmailId}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
