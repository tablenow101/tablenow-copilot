import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const componentPath = new URL("./components/OnboardingFlow.tsx", import.meta.url);
const shellPath = new URL("./components/ProductShell.tsx", import.meta.url);
const cssPath = new URL("./app/globals.css", import.meta.url);
const nextConfigPath = new URL("./next.config.ts", import.meta.url);

describe("onboarding frontend boundaries", () => {
  it("OB-08, OB-09 and OB-10 keep the real browser voice lifecycle explicit", async () => {
    const [component, nextConfig] = await Promise.all([readFile(componentPath, "utf8"), readFile(nextConfigPath, "utf8")]);
    for (const state of ["requesting_permission", "recording", "transcribing", "reviewing", "confirmed", "cancelled", "permission_denied", "unavailable", "failed"]) {
      expect(component).toContain(`"${state}"`);
    }
    expect(component).toContain("new Recognition()");
    expect(component).toContain("recognition.onstart");
    expect(component).toContain("abortRecognition(recognitionRef)");
    expect(component).not.toContain("mockTranscript");
    expect(nextConfig).toContain("microphone=(self)");
    expect(nextConfig).not.toContain("microphone=*");
  });

  it("OB-13, OB-14 and OB-15 expose failed/conflict states without polling or browser persistence", async () => {
    const component = await readFile(componentPath, "utf8");
    expect(component).toContain('saveState !== "dirty"');
    expect(component).toContain('caught.status === 409');
    expect(component).toContain('setSaveState("failed")');
    expect(component).toContain('setSaveState("conflict")');
    expect(component).not.toMatch(/localStorage|sessionStorage|setInterval/);
  });

  it("OB-19 and OB-20 show unknown metrics explicitly and link edits to the persisted restaurant draft", async () => {
    const shell = await readFile(shellPath, "utf8");
    expect(shell).toContain('"Non mesuré"');
    expect(shell).toContain("/onboarding?restaurantId=");
    expect(shell).not.toContain('value={`${summary.occupancyPercent} %`}');
    expect(shell).not.toContain('value={`${summary.availableTables} tables`}');
  });

  it("OB-21 and OB-22 keep six stable responsive progress tracks and both themes", async () => {
    const [component, css] = await Promise.all([readFile(componentPath, "utf8"), readFile(cssPath, "utf8")]);
    expect(component.match(/key: "(establishment|priorities|reservations|operations|authority|review)"/g)).toHaveLength(6);
    expect(css).toContain("grid-template-columns: repeat(6, 1fr)");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain(".final-onboarding.theme-clear");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("OB-25 and OB-28 have no business fallback and render an actionable load failure", async () => {
    const component = await readFile(componentPath, "utf8");
    expect(component).toContain('loadState === "failed"');
    expect(component).toContain("<LoadFailure");
    expect(component).toContain("copy.common.retry");
    expect(component).not.toMatch(/fallback|polling/);
  });
});
