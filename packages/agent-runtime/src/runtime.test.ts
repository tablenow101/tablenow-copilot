import { describe, expect, it } from "vitest";
import { AgentRuntime } from "./index.js";

const base = {
  tenantId: "tenant-a",
  actorId: "user-a",
  snapshot: {
    occupancyPercent: 82,
    openDecisions: 2,
    availableTables: 7,
    revenueCapturedToday: 1840,
    inventoryAlerts: 1,
  },
};

describe("AgentRuntime", () => {
  it("never claims an action was executed", async () => {
    const plan = await new AgentRuntime().plan({ ...base, message: "Ouvre trois tables de plus" });
    expect(plan.proposedAction).toMatchObject({ tool: "service.open_slot", status: "proposed", approvalRequired: true });
    expect(plan.answer.toLowerCase()).not.toContain("j'ai ouvert");
  });

  it("answers read-only questions without an action", async () => {
    const plan = await new AgentRuntime().plan({ ...base, message: "Comment se présente le service ?" });
    expect(plan.proposedAction).toBeNull();
  });
});
