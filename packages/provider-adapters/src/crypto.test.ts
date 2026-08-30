import { describe, expect, it } from "vitest";
import { constantTimeEqual, hashSecret, idempotencyKey, randomDigits } from "./crypto.js";

describe("crypto adapters", () => {
  it("creates six digit codes", () => expect(randomDigits()).toMatch(/^\d{6}$/));
  it("compares hashes in constant time", () => {
    const hash = hashSecret("424242", "a".repeat(32));
    expect(constantTimeEqual(hash, hashSecret("424242", "a".repeat(32)))).toBe(true);
    expect(constantTimeEqual(hash, hashSecret("111111", "a".repeat(32)))).toBe(false);
  });
  it("creates stable idempotency keys", () => {
    expect(idempotencyKey(["a", 1])).toBe(idempotencyKey(["a", 1]));
  });
});
