import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const consoleRoot = new URL("./", import.meta.url);
const source = (path: string) => readFile(new URL(path, consoleRoot), "utf8");

describe("unified authentication boundary", () => {
  it("presents one clear entry on login and registration", async () => {
    const [flow, login, register] = await Promise.all([
      source("components/account/AccountFlow.tsx"),
      source("components/LoginFlow.tsx"),
      source("app/register/page.tsx"),
    ]);

    expect(flow).toContain('"Se connecter ou créer un compte"');
    expect(flow).toContain("Continuer avec Google");
    expect(flow).toContain('"Continuer"');
    expect(flow).toContain('type Stage = "credentials" | "email" | "profile"');
    expect(flow).not.toContain("Rester connecté sur cet appareil");
    expect(flow).not.toContain("Nouveau sur TableNow");
    expect(flow.indexOf("<Brand />")).toBeGreaterThan(flow.indexOf('className="tn-auth-card"'));
    expect(flow.indexOf("Continuer avec Google")).toBeLessThan(flow.indexOf('name="email"'));
    expect(login).toContain("<AccountFlow />");
    expect(register).toContain("<AccountFlow />");
  });
});
