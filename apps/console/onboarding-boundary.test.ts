import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { conversationSection, onboardingProgressGroups } from "./lib/onboarding-storyboard";

const componentPath = new URL("./components/OnboardingFlow.tsx", import.meta.url);
const shellPath = new URL("./components/ProductShell.tsx", import.meta.url);
const cssPath = new URL("./app/globals.css", import.meta.url);
const nextConfigPath = new URL("./next.config.ts", import.meta.url);

describe("onboarding frontend boundaries", () => {
  it("keeps conversation and navigation separate on every onboarding step", async () => {
    const component = await readFile(componentPath, "utf8");
    expect(component).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance|toggleReading/);
    expect(component).toContain('onSend={sendConversation}');
    expect(component).toContain('surface: "onboarding"');
    expect(component).toContain('keepComplement(reply.id)');
    expect(component).not.toContain('if (sectionRef.current === "review") moveTo("final_note")');
    expect(conversationSection("review", "review")).toBe("final_note");
    expect(conversationSection("complements", "operations")).toBe("final_note");
    expect(conversationSection("systems", "interaction")).toBe("reservations");
  });

  it("uses the same guarded dictation controller as the cockpit and rejects unsupported file types", async () => {
    const component = await readFile(componentPath, "utf8");
    const owner = await readFile(new URL("./components/OwnerShell.tsx", import.meta.url), "utf8");
    const composer = await readFile(new URL("./components/ConversationInput.tsx", import.meta.url), "utf8");
    const hook = await readFile(new URL("./hooks/useDictation.ts", import.meta.url), "utf8");
    expect(component).toContain("useDictation(");
    expect(owner).toContain("useDictation(");
    expect(hook).toContain("if (ref.current) { stop(); return; }");
    expect(composer).toContain("busy || mutationRef.current");
    expect(composer).toContain("].includes(file.type)");
    expect(composer).not.toContain('file.type || "text/plain"');
  });

  it("OB-08, OB-09 and OB-10 keep microphone scope local and the shared lifecycle bounded", async () => {
    const [hook, nextConfig] = await Promise.all([readFile(new URL("./hooks/useDictation.ts", import.meta.url), "utf8"), readFile(nextConfigPath, "utf8")]);
    expect(hook).toContain('if (ref.current !== session) return;');
    expect(hook).toContain('session.finish()');
    expect(hook).toContain('startAudioSpectrum(');
    expect(hook).not.toContain("mockTranscript");
    expect(nextConfig).toContain("microphone=(self)");
    expect(nextConfig).not.toContain("microphone=*");
  });

  it("keeps Back visible before a restaurant identity has been selected", async () => {
    const component = await readFile(componentPath, "utf8");
    expect(component).not.toContain('{(!isWelcome || identityOpen) && <footer');
    const footer = component.slice(component.indexOf('<footer className="onboarding-actions">'), component.indexOf('</footer>', component.indexOf('<footer className="onboarding-actions">')));
    expect(footer).toContain('goBack(previousSection, previousStep)');
    expect(footer.indexOf('goBack(')).toBeLessThan(footer.indexOf('(!isWelcome || identityOpen)'));
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
    const css = await readFile(cssPath, "utf8");
    expect(onboardingProgressGroups.map((group) => group.target)).toEqual([
      "priorities",
      "establishment",
      "reservations",
      "reservations",
      "operations",
      "review",
    ]);
    expect(onboardingProgressGroups.map(group => group.key)).toEqual(["priorities", "establishment", "systems", "connections", "complements", "review"]);
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
