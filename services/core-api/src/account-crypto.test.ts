import { describe, expect, it } from "vitest";
import { newTotpSecret, passwordHash, passwordMatches, seal, unseal, totpAt, validTotpStep } from "./account-crypto.js";
describe("account credential primitives", () => {
  it("matches the RFC 6238 SHA-1 test vector and refuses replay", () => {
    expect(totpAt("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toBe("287082");
    const secret = newTotpSecret(), step = Math.floor(Date.now()/30000);
    const code = totpAt(secret, step);
    expect(validTotpStep(secret, code)).toBe(step);
    expect(validTotpStep(secret, code, step)).toBeNull();
    expect(validTotpStep(secret, "abcdef")).toBeNull();
  });
  it("salts password hashes and rejects wrong passwords", async () => {
    const hash = await passwordHash("Une phrase privée 1234");
    expect(await passwordMatches("Une phrase privée 1234", hash)).toBe(true);
    expect(await passwordMatches("Une autre phrase 5678", hash)).toBe(false);
    expect(await passwordMatches("Une phrase privée 1234")).toBe(false);
    expect(await passwordHash("Une phrase privée 1234")).not.toBe(hash);
  });
  it("authenticates encrypted payloads", () => {
    const sealed = seal({ secret: "private" }, "server-key");
    expect(unseal(sealed, "server-key")).toEqual({ secret: "private" });
    expect(() => unseal(sealed, "wrong-key")).toThrow();
    const bytes = Buffer.from(sealed,"base64"); bytes[30] = bytes[30]! ^ 1;
    expect(() => unseal(bytes.toString("base64"), "server-key")).toThrow();
  });
});
