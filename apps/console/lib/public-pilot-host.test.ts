import { describe, expect, it } from "vitest";
import { isPublicPilotHostname } from "./public-pilot-host";

describe("authenticated owner host boundary", () => {
  it("never grants a synthetic session or disables the API based on hostname", () => {
    expect(isPublicPilotHostname("copilot.tablenow.io")).toBe(false);
    expect(isPublicPilotHostname("tablenow-copilot-v2.vercel.app")).toBe(false);
    expect(isPublicPilotHostname("tablenow-copilot-v2-tablenow101.vercel.app")).toBe(false);
    expect(isPublicPilotHostname("tablenow-copilot-v2-random-tablenow101.vercel.app")).toBe(false);
    expect(isPublicPilotHostname("app.tablenow.io")).toBe(false);
    expect(isPublicPilotHostname("tablenow.io")).toBe(false);
  });
});
