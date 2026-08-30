import { describe, expect, it } from "vitest";
import { computerExecutionPolicy, isUrlAllowed, normalizeAllowedHosts, requiresPointOfActionApproval } from "./computer-use.js";

describe("computer use safety policy", () => {
  it("never executes critical actions", () => {
    expect(computerExecutionPolicy({ risk: "critical", mode: "autonomous", readOnly: false })).toMatchObject({ executable: false, approvalRequired: true });
  });

  it("blocks writes in observe mode", () => {
    expect(computerExecutionPolicy({ risk: "low", mode: "observe", readOnly: false }).executable).toBe(false);
  });

  it("requires approval for medium actions in assist mode", () => {
    expect(computerExecutionPolicy({ risk: "medium", mode: "assist", readOnly: false }).approvalRequired).toBe(true);
  });

  it("allows exact hosts and their subdomains only", () => {
    const hosts = normalizeAllowedHosts("https://app.zenchef.com", ["zenchef.com"]);
    expect(isUrlAllowed("https://app.zenchef.com/reservations", hosts)).toBe(true);
    expect(isUrlAllowed("https://cdn.zenchef.com/file.js", hosts)).toBe(true);
    expect(isUrlAllowed("https://zenchef.com.attacker.example", hosts)).toBe(false);
    expect(isUrlAllowed("file:///etc/passwd", hosts)).toBe(false);
  });

  it("recognizes risky final controls in French and English", () => {
    expect(requiresPointOfActionApproval("Annuler la réservation")).toBe(true);
    expect(requiresPointOfActionApproval("Refund payment")).toBe(true);
    expect(requiresPointOfActionApproval("Voir le détail")).toBe(false);
  });
});
