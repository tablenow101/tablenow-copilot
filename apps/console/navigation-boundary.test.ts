import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const consoleRoot = new URL("./", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, consoleRoot), "utf8");
}

describe("TableNow OS navigation boundaries", () => {
  it("uses /dashboard as the authenticated cockpit route", async () => {
    const files = await Promise.all([
      source("app/[section]/page.tsx"),
      source("components/OwnerShell.tsx"),
      source("components/account/AccountFlow.tsx"),
      source("components/OnboardingFlow.tsx"),
      source("hooks/useSession.ts"),
    ]);
    const combined = files.join("\n");

    expect(combined).toContain('"dashboard"');
    expect(combined).toContain('"/dashboard"');
    expect(combined).not.toContain('"/today"');
    expect(combined).not.toContain('key: "today"');
  });

  it("keeps /today only as a compatibility redirect", async () => {
    const legacyRoute = await source("app/today/page.tsx");
    expect(legacyRoute).toContain('redirect("/dashboard")');
  });

  it("uses the official TableNow OS brand on loading and legal pages", async () => {
    const [loading, legal] = await Promise.all([
      source("components/LoadingScreen.tsx"),
      source("components/LegalDocument.tsx"),
    ]);

    expect(loading).toContain("<Brand");
    expect(legal).toContain("<Brand");
    expect(`${loading}\n${legal}`).not.toContain("brand-mark");
    expect(legal).not.toContain("Confiance & conformité");
    expect(legal).not.toContain("23 août 2026");
    expect(legal).not.toContain("Version pilot-2026-08-23");
    expect(legal).not.toContain("Conditions du pilote");
  });
});
