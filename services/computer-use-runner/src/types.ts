import type { ComputerWorkflowDefinition } from "@tablenow/contracts";

export interface ClaimedRun {
  id: string;
  objective: string;
  inputs: Record<string, string | number | boolean | null>;
  risk: "low" | "medium" | "high" | "critical";
  approvalRequired: boolean;
  approved: boolean;
  attempts: number;
  maxAttempts: number;
  nextSequence: number;
  claimToken: string;
  connection: {
    id: string;
    name: string;
    provider: string;
    surface: "browser" | "desktop";
    baseUrl: string;
    allowedHosts: string[];
    credentialRef: string;
  };
  workflow: {
    id: string;
    key: string;
    name: string;
    definition: ComputerWorkflowDefinition;
  };
}

export interface RunResult {
  status: "succeeded" | "failed" | "blocked" | "cancelled";
  summary: string;
  output: Record<string, unknown>;
  errorCode?: string;
}

export interface RunnerConfig {
  apiUrl: string;
  nodeToken: string;
  profileRoot: string;
  chromiumPath?: string;
  headless: boolean;
  pollMs: number;
  openAiApiKey?: string;
  openAiModel: string;
  maxModelSteps: number;
  openAiBaseUrl: string;
}
