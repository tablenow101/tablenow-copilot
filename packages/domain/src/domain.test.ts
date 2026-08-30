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
});

describe("tenancy", () => {
  it("rejects resources from another tenant", () => {
    expect(() => assertTenantMatch("a", "b")).toThrow("TENANT_BOUNDARY_VIOLATION");
  });

  it("creates stable slugs", () => {
    expect(tenantSlug("L'Écaille — Paris 11")).toBe("l-ecaille-paris-11");
  });
});
