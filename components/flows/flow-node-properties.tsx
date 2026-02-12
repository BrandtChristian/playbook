"use client";

import type { FlowNode, TriggerConfig, SendEmailConfig, DelayConfig, ExitConfig } from "@/lib/flows/types";
import { getNodeMeta } from "@/lib/flows/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash, Plus } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export function FlowNodeProperties({
  node,
  onUpdate,
  onDelete,
  emails,
  templates,
  segments,
  orgId,
  onEmailCreated,
  onEditEmail,
}: {
  node: FlowNode;
  onUpdate: (config: FlowNode["config"]) => void;
  onDelete: (() => void) | null;
  emails: { id: string; name: string }[];
  templates: { id: string; name: string; subject: string; body_html: string; is_system: boolean }[];
  segments: { id: string; name: string }[];
  orgId: string;
  onEmailCreated: (email: { id: string; name: string; subject: string; body_html: string }) => void;
  onEditEmail: (emailId: string) => void;
}) {
  const meta = getNodeMeta(node.type);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 flex items-center justify-center ${meta.color}`}>
          <div className={`w-3 h-3 rounded-full ${meta.iconColor.replace("text-", "bg-")}`} />
        </div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          {meta.label} Settings
        </h3>
      </div>

      <div className="border-t border-stone-200 dark:border-stone-700" />

      {node.type === "trigger" && (
        <TriggerForm
          config={node.config as TriggerConfig}
          onChange={onUpdate}
          segments={segments}
        />
      )}

      {node.type === "send_email" && (
        <SendEmailForm
          config={node.config as SendEmailConfig}
          onChange={onUpdate}
          emails={emails}
          templates={templates}
          orgId={orgId}
          onEmailCreated={onEmailCreated}
          onEditEmail={onEditEmail}
        />
      )}

      {node.type === "delay" && (
        <DelayForm config={node.config as DelayConfig} onChange={onUpdate} />
      )}

      {node.type === "exit" && (
        <ExitForm config={node.config as ExitConfig} onChange={onUpdate} />
      )}

      {onDelete && (
        <>
          <div className="border-t border-stone-200 dark:border-stone-700 mt-2" />
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 justify-start gap-2"
            onClick={onDelete}
          >
            <Trash className="w-3.5 h-3.5" />
            Delete step
          </Button>
        </>
      )}
    </div>
  );
}

function TriggerForm({
  config,
  onChange,
  segments,
}: {
  config: TriggerConfig;
  onChange: (c: TriggerConfig) => void;
  segments: { id: string; name: string }[];
}) {
  // Handle legacy configs missing trigger_type
  const triggerType = config.trigger_type ?? "segment_entry";

  return (
    <div className="flex flex-col gap-4">
      {/* Trigger type toggle */}
      <div className="grid gap-1.5">
        <Label className="text-xs">Trigger type</Label>
        <div className="flex gap-1">
          {([
            { value: "segment_entry", label: "Segment Entry" },
            { value: "schedule", label: "Schedule" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                onChange({
                  ...config,
                  trigger_type: opt.value,
                  schedule_frequency: opt.value === "schedule" ? (config.schedule_frequency ?? "daily") : null,
                })
              }
              className={`flex-1 h-8 text-xs font-medium border transition-colors ${
                triggerType === opt.value
                  ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                  : "bg-transparent text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Segment picker — always shown */}
      <div className="grid gap-1.5">
        <Label className="text-xs">Segment</Label>
        <Select
          value={config.segment_id ?? ""}
          onValueChange={(v) => onChange({ ...config, segment_id: v || null })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a segment..." />
          </SelectTrigger>
          <SelectContent>
            {segments.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-stone-400 dark:text-stone-500">
          {triggerType === "segment_entry"
            ? "Contacts entering this segment will start the flow."
            : "All contacts in this segment will be enrolled on each run."}
        </p>
      </div>

      {/* Schedule settings */}
      {triggerType === "schedule" && (
        <div className="grid gap-1.5">
          <Label className="text-xs">Frequency</Label>
          <Select
            value={config.schedule_frequency ?? "daily"}
            onValueChange={(v) =>
              onChange({
                ...config,
                schedule_frequency: v as TriggerConfig["schedule_frequency"],
              })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">One-time</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="border-t border-stone-200 dark:border-stone-700" />

      {/* Re-entry settings */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="reentry"
          checked={config.allow_reentry}
          onCheckedChange={(v) =>
            onChange({ ...config, allow_reentry: v === true, reentry_delay: v === true ? config.reentry_delay : null })
          }
        />
        <Label htmlFor="reentry" className="text-xs font-normal">
          Allow contacts to re-enter
        </Label>
      </div>

      {config.allow_reentry && (
        <div className="grid gap-1.5 pl-6">
          <Label className="text-xs">Cooldown before re-entry</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="h-8 text-xs w-20"
              placeholder="0"
              value={config.reentry_delay ?? ""}
              onChange={(e) =>
                onChange({
                  ...config,
                  reentry_delay: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <span className="text-xs text-stone-500 dark:text-stone-400">days</span>
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500">
            Leave blank for no cooldown.
          </p>
        </div>
      )}
    </div>
  );
}

function SendEmailForm({
  config,
  onChange,
  emails,
  templates,
  orgId,
  onEmailCreated,
  onEditEmail,
}: {
  config: SendEmailConfig;
  onChange: (c: SendEmailConfig) => void;
  emails: { id: string; name: string }[];
  templates: { id: string; name: string; subject: string; body_html: string; is_system: boolean }[];
  orgId: string;
  onEmailCreated: (email: { id: string; name: string; subject: string; body_html: string }) => void;
  onEditEmail: (emailId: string) => void;
}) {
  const [creating, setCreating] = useState<"idle" | "pick" | "name">("idle");
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const pickedTemplate = templates.find((t) => t.id === pickedTemplateId);

  async function handleCreateEmail() {
    if (!pickedTemplate || !newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("emails")
      .insert({
        org_id: orgId,
        template_id: pickedTemplate.id,
        name: newName.trim(),
        subject: pickedTemplate.subject || "New email",
        body_html: pickedTemplate.body_html,
      })
      .select("id, name, subject, body_html")
      .single();

    setSaving(false);
    if (error || !data) {
      toast.error("Failed to create email");
      return;
    }

    onEmailCreated(data);
    onChange({ ...config, email_id: data.id });
    setCreating("idle");
    setPickedTemplateId(null);
    setNewName("");
    toast.success("Email created and selected");
  }

  // Inline creation flow
  if (creating === "pick") {
    return (
      <div className="flex flex-col gap-3">
        <Label className="text-xs">Choose a template to start from</Label>
        <div className="max-h-48 overflow-y-auto grid gap-1">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => { setPickedTemplateId(tpl.id); setCreating("name"); }}
              className="text-left px-2.5 py-2 border border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-xs"
            >
              <span className="font-medium text-stone-900 dark:text-stone-100">{tpl.name}</span>
              {tpl.is_system && <span className="ml-1.5 text-[10px] text-stone-400">System</span>}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setCreating("idle")}>
          Cancel
        </Button>
      </div>
    );
  }

  if (creating === "name" && pickedTemplate) {
    return (
      <div className="flex flex-col gap-3">
        <Label className="text-xs">Name this email</Label>
        <p className="text-[11px] text-stone-400 dark:text-stone-500">
          Based on: {pickedTemplate.name}
        </p>
        <Input
          className="h-8 text-xs"
          placeholder="e.g. Welcome Email"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateEmail()}
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setCreating("pick"); setPickedTemplateId(null); }}>
            Back
          </Button>
          <Button size="sm" className="text-xs" onClick={handleCreateEmail} disabled={!newName.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label className="text-xs">Email</Label>
        <Select
          value={config.email_id ?? ""}
          onValueChange={(v) => onChange({ ...config, email_id: v || null })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select an email..." />
          </SelectTrigger>
          <SelectContent>
            {emails.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-3 mt-0.5">
          <button
            onClick={() => setCreating("pick")}
            className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            New from template
          </button>
          {config.email_id && (
            <button
              onClick={() => onEditEmail(config.email_id!)}
              className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              Edit email
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs">Subject line override</Label>
        <Input
          className="h-8 text-xs"
          placeholder="Leave blank to use email subject"
          value={config.subject_override ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              subject_override: e.target.value || null,
            })
          }
        />
      </div>
    </div>
  );
}

function DelayForm({
  config,
  onChange,
}: {
  config: DelayConfig;
  onChange: (c: DelayConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs">Wait duration</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          className="h-8 text-xs w-20"
          value={config.duration}
          onChange={(e) =>
            onChange({ ...config, duration: parseInt(e.target.value) || 1 })
          }
        />
        <Select
          value={config.unit}
          onValueChange={(v) =>
            onChange({ ...config, unit: v as DelayConfig["unit"] })
          }
        >
          <SelectTrigger className="h-8 text-xs w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
            <SelectItem value="weeks">Weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ExitForm({
  config,
  onChange,
}: {
  config: ExitConfig;
  onChange: (c: ExitConfig) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">Exit reason</Label>
      <Input
        className="h-8 text-xs"
        placeholder="e.g. Completed, Inactive"
        value={config.reason}
        onChange={(e) => onChange({ ...config, reason: e.target.value })}
      />
      <p className="text-[11px] text-stone-400 dark:text-stone-500">
        Optional label for reporting purposes.
      </p>
    </div>
  );
}
