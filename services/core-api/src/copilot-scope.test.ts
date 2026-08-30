import { describe, expect, it } from "vitest";
import type { AgentPlan } from "@tablenow/agent-runtime";
import { publicCopilotReply } from "./copilot-scope.js";

const plan: AgentPlan = {
  conversationId: "00000000-0000-4000-8000-000000000010",
  answer: "Trois tables sont disponibles.",
  evidence: [{ label: "Tables", value: "3" }],
  proposedAction: {
    id: "00000000-0000-4000-8000-000000000011",
    tool: "service.open_slot",
    title: "Ouvrir un créneau",
    rationale: "Capacité disponible",
    risk: "medium",
    approvalRequired: true,
    status: "proposed",
  },
  usage: { model: "test", inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 },
  tool: "service.open_slot",
  arguments: { additionalTables: 3 },
};

describe("copilot restaurant scope", () => {
  it("removes an action that has no explicit restaurant", () => {
    const reply = publicCopilotReply(plan);
    expect(reply.proposedAction).toBeNull();
    expect(reply.answer).toContain("Sélectionnez un établissement");
  });

  it("keeps the proposal when a restaurant was explicitly selected", () => {
    expect(publicCopilotReply(plan, "00000000-0000-4000-8000-000000000001").proposedAction?.tool).toBe("service.open_slot");
  });
});
