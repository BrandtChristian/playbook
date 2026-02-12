// ── Node Types ──────────────────────────────────────────────

export type FlowNodeType = "trigger" | "send_email" | "delay" | "exit";

export type TriggerType = "segment_entry" | "schedule";
export type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly" | "monthly";

export interface TriggerConfig {
  trigger_type: TriggerType;
  segment_id: string | null;

  // Schedule settings (only when trigger_type === "schedule")
  schedule_frequency: ScheduleFrequency | null;
  schedule_at: string | null; // ISO datetime for "once", or time-of-day for recurring

  // Re-entry settings
  allow_reentry: boolean;
  reentry_delay: number | null; // null = no delay, number = days before allowed re-entry
}

export interface SendEmailConfig {
  email_id: string | null;
  subject_override: string | null;
}

export interface DelayConfig {
  duration: number;
  unit: "hours" | "days" | "weeks";
}

export interface ExitConfig {
  reason: string;
}

export type FlowNodeConfig = TriggerConfig | SendEmailConfig | DelayConfig | ExitConfig | Record<string, unknown>;

// ── DB Row Types ────────────────────────────────────────────

export interface FlowNode {
  id: string;
  flow_id: string;
  type: FlowNodeType;
  position: number;
  config: FlowNodeConfig;
  created_at: string;
}

export interface Flow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused";
  trigger_config: TriggerConfig;
  created_at: string;
  updated_at: string;
}

// ── Palette ─────────────────────────────────────────────────

export interface NodePaletteItem {
  type: FlowNodeType;
  label: string;
  description: string;
  icon: string; // Phosphor icon name
  color: string; // Tailwind bg class for the icon circle
  iconColor: string; // Tailwind text class for the icon
  factory: () => Omit<FlowNode, "id" | "flow_id" | "position" | "created_at">;
}

export const NODE_PALETTE: NodePaletteItem[] = [
  {
    type: "send_email",
    label: "Send Email",
    description: "Send an email",
    icon: "EnvelopeSimple",
    color: "bg-blue-100 dark:bg-blue-900/40",
    iconColor: "text-blue-600 dark:text-blue-400",
    factory: () => ({
      type: "send_email",
      config: { email_id: null, subject_override: null },
    }),
  },
  {
    type: "delay",
    label: "Wait",
    description: "Wait before the next step",
    icon: "Clock",
    color: "bg-amber-100 dark:bg-amber-900/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    factory: () => ({
      type: "delay",
      config: { duration: 1, unit: "days" },
    }),
  },
  {
    type: "exit",
    label: "Exit",
    description: "End the journey",
    icon: "SignOut",
    color: "bg-stone-100 dark:bg-stone-800",
    iconColor: "text-stone-500 dark:text-stone-400",
    factory: () => ({
      type: "exit",
      config: { reason: "completed" },
    }),
  },
];

// ── Helpers ─────────────────────────────────────────────────

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  trigger_type: "segment_entry",
  segment_id: null,
  schedule_frequency: null,
  schedule_at: null,
  allow_reentry: false,
  reentry_delay: null,
};

export function getNodeMeta(type: FlowNodeType) {
  if (type === "trigger") {
    return {
      label: "Trigger",
      icon: "Lightning",
      color: "bg-indigo-100 dark:bg-indigo-900/40",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    };
  }
  const item = NODE_PALETTE.find((p) => p.type === type);
  return item ?? { label: type, icon: "Circle", color: "bg-stone-100", iconColor: "text-stone-500" };
}

export function summarizeNode(
  node: FlowNode,
  emails: { id: string; name: string }[],
  segments: { id: string; name: string }[]
): string {
  switch (node.type) {
    case "trigger": {
      const cfg = node.config as TriggerConfig;
      const seg = segments.find((s) => s.id === cfg.segment_id);
      const segLabel = seg ? `"${seg.name}"` : "No segment";
      if (cfg.trigger_type === "schedule" && cfg.schedule_frequency) {
        const freq = cfg.schedule_frequency === "once" ? "One-time" : cfg.schedule_frequency.charAt(0).toUpperCase() + cfg.schedule_frequency.slice(1);
        return `${freq} — ${segLabel}`;
      }
      return seg ? `When contact enters ${segLabel}` : "No segment selected";
    }
    case "send_email": {
      const cfg = node.config as SendEmailConfig;
      const email = emails.find((e) => e.id === cfg.email_id);
      return email ? email.name : "No email selected";
    }
    case "delay": {
      const cfg = node.config as DelayConfig;
      return `Wait ${cfg.duration} ${cfg.unit}`;
    }
    case "exit": {
      const cfg = node.config as ExitConfig;
      return cfg.reason || "End of journey";
    }
    default:
      return "";
  }
}
