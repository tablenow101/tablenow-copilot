import { describe, expect, it } from "vitest";
import { assertTenantMatch, hasPermission, inferTool, policyForTool, tenantSlug } from "./index.js";

describe("authorization", () => {
  it("keeps pilot administration limited to platform administrators", () => {
    expect(hasPermission("platform_admin", "pilot.manage")).toBe(true);
    expect(hasPermission("owner", "pilot.manage")).toBe(false);
  });

  it("does not grant high-risk approval to operators", () => {
    expect(hasPermission("operator", "copilot.approve.high")).toBe(false);
    expect(hasPermission("owner", "copilot.approve.high")).toBe(true);
  });
});

describe("agent policy", () => {
  it("requires approval for a capacity change", () => {
    const tool = inferTool("Ouvre un créneau supplémentaire ce soir");
    expect(tool).toBe("service.open_slot");
    expect(policyForTool(tool)).toMatchObject({ risk: "high", approvalRequired: true });
  });

  it("fails closed for an unknown tool", () => {
    expect(policyForTool("unknown.write")).toMatchObject({ risk: "critical", localExecutionAllowed: false });
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("fails closed for inherited property %s", (tool) => {
    expect(policyForTool(tool)).toMatchObject({ tool, risk: "critical", approvalRequired: true, localExecutionAllowed: false });
  });

  it.each([
    "Relance tous les clients pour demain",
    "Confirme le message groupé",
    "Prépare une campagne pour écouler le stock",
    "Ouvre un créneau pour tous les clients",
  ])("keeps bulk messaging critical despite other matching words: %s", (message) => {
    expect(policyForTool(inferTool(message))).toMatchObject({ tool: "guest.bulk_message", risk: "critical", approvalRequired: true, localExecutionAllowed: false });
  });
});

describe("tenancy", () => {
  it("rejects resources from another tenant", () => {
    expect(() => assertTenantMatch("a", "b")).toThrow("TENANT_BOUNDARY_VIOLATION");
  });

  it("creates stable slugs", () => {
    expect(tenantSlug("L'Écaille — Paris 11")).toBe("l-ecaille-paris-11");
  });
});
