import { describe, expect, it } from "vitest";
import { isPublicPilotHostname } from "./public-pilot-host";

describe("public pilot host boundary", () => {
  it("allows only the two official V2 public hosts", () => {
    expect(isPublicPilotHostname("copilot.tablenow.io")).toBe(true);
    expect(isPublicPilotHostname("tablenow-copilot-v2.vercel.app")).toBe(true);
    expect(isPublicPilotHostname("tablenow-copilot-v2-tablenow101.vercel.app")).toBe(true);
    expect(isPublicPilotHostname("tablenow-copilot-v2-random-tablenow101.vercel.app")).toBe(false);
    expect(isPublicPilotHostname("app.tablenow.io")).toBe(false);
    expect(isPublicPilotHostname("tablenow.io")).toBe(false);
  });
});
