import type { Profile } from "@/lib/auth/dal";
import type { FlowDefinition, FlowStepConfig } from "./types";

export function resolveSteps(
  flow: FlowDefinition,
  profile: Profile
): FlowStepConfig[] {
  return typeof flow.steps === "function"
    ? flow.steps(profile)
    : flow.steps;
}

export const flows: FlowDefinition[] = [
  {
    id: "welcome",
    name: "Welcome to Forge",
    priority: 0,
    shouldShow: () => true,
    steps: (profile: Profile) => {
      const steps: FlowStepConfig[] = [
        { id: "splash", component: "welcome" },
      ];

      if (!profile.full_name?.trim()) {
        steps.push({ id: "name", component: "name", title: "Your name" });
      }
      if (!profile.job_title?.trim()) {
        steps.push({
          id: "job-title",
          component: "job-title",
          title: "Your role",
        });
      }
      if (!profile.preferred_test_email?.trim()) {
        steps.push({
          id: "test-email",
          component: "test-email",
          title: "Test email",
        });
      }

      steps.push({ id: "ready", component: "ready", title: "Ready" });
      return steps;
    },
  },
];

export function getNextUnseenFlow(
  profile: Profile
): FlowDefinition | null {
  const sorted = [...flows].sort((a, b) => a.priority - b.priority);
  for (const flow of sorted) {
    if (!profile.seen_flows?.[flow.id] && flow.shouldShow(profile)) {
      const steps = resolveSteps(flow, profile);
      // Only show if there are data-collection steps (more than just splash + ready)
      if (steps.length > 2) {
        return flow;
      }
    }
  }
  return null;
}
