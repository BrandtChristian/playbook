import type { Profile } from "@/lib/auth/dal";

export type FlowStepConfig = {
  id: string;
  component: string;
  title?: string;
};

export type FlowDefinition = {
  id: string;
  name: string;
  steps: FlowStepConfig[] | ((profile: Profile) => FlowStepConfig[]);
  shouldShow: (profile: Profile) => boolean;
  priority: number;
};

export type ProfileUpdatePayload = {
  full_name?: string;
  job_title?: string;
  preferred_test_email?: string;
};

export type FlowContextValue = {
  currentStep: number;
  totalSteps: number;
  flowId: string;
  advance: () => void;
  skip: () => void;
  complete: () => void;
  updateProfile: (data: ProfileUpdatePayload) => Promise<void>;
  profile: Profile;
  direction: 1 | -1;
};
