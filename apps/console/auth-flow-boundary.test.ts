import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const consoleRoot = new URL("./", import.meta.url);
const source = (path: string) => readFile(new URL(path, consoleRoot), "utf8");

describe("separate authentication screens", () => {
  it("keeps existing-account login distinct from signup and asks for no name", async () => {
    const [flow, login, register] = await Promise.all([
      source("components/account/AccountFlow.tsx"), source("components/LoginFlow.tsx"), source("app/register/page.tsx"),
    ]);
    expect(flow).toContain('name="password"');
    expect(flow).toContain('href="/register"');
    expect(flow).toContain('href="/forgot-password"');
    expect(flow).toContain('href="/login/email"');
    expect(flow).not.toContain('name="name"');
    expect(flow).toContain("Code reçu par e-mail");
    expect(flow).not.toContain("Code de votre application d’authentification");
    expect(login).toContain("<AccountFlow />");
    expect(register).toContain('<AccountFlow mode="signup" />');
  });
});
