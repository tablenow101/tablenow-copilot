import type { Permission, } from "./authorization.js";

export type ActionRisk = "low" | "medium" | "high" | "critical";

export interface ToolPolicy {
  tool: string;
  risk: ActionRisk;
  permission: Permission;
  approvalRequired: boolean;
  localExecutionAllowed: boolean;
}

const policies: Record<string, ToolPolicy> = {
  "workspace.explain": {
    tool: "workspace.explain",
    risk: "low",
    permission: "workspace.read",
    approvalRequired: false,
    localExecutionAllowed: true,
  },
  "reservation.follow_up": {
    tool: "reservation.follow_up",
    risk: "medium",
    permission: "copilot.approve.low",
    approvalRequired: true,
    localExecutionAllowed: true,
  },
  "service.open_slot": {
    tool: "service.open_slot",
    risk: "high",
    permission: "copilot.approve.high",
    approvalRequired: true,
    localExecutionAllowed: true,
  },
  "inventory.create_alert": {
    tool: "inventory.create_alert",
    risk: "low",
    permission: "copilot.approve.low",
    approvalRequired: true,
    localExecutionAllowed: true,
  },
  "guest.bulk_message": {
    tool: "guest.bulk_message",
    risk: "critical",
    permission: "copilot.approve.high",
    approvalRequired: true,
    localExecutionAllowed: false,
  },
};

export function policyForTool(tool: string): ToolPolicy {
  const policy = policies[tool];
  if (!policy) {
    return {
      tool,
      risk: "critical",
      permission: "copilot.approve.high",
      approvalRequired: true,
      localExecutionAllowed: false,
    };
  }
  return policy;
}

export function inferTool(message: string): string {
  const normalized = message.toLocaleLowerCase("fr");
  if (/stock|saumon|rupture|inventaire/.test(normalized)) return "inventory.create_alert";
  if (/ouvre|créneau|creneau|capacité|capacite/.test(normalized)) return "service.open_slot";
  if (/rappelle|relance|no.?show|confirme/.test(normalized)) return "reservation.follow_up";
  if (/tous les clients|message groupé|campagne/.test(normalized)) return "guest.bulk_message";
  return "workspace.explain";
}
