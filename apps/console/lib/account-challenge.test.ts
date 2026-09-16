import { describe, expect, it } from "vitest";
import { challengeSecondsRemaining } from "./account-challenge";

describe("account challenge expiry", () => {
  it("rounds up the visible remaining seconds and never returns a negative value", () => {
    expect(challengeSecondsRemaining("2026-09-16T20:10:00.001Z", Date.parse("2026-09-16T20:10:00.000Z"))).toBe(1);
    expect(challengeSecondsRemaining("2026-09-16T20:10:30.000Z", Date.parse("2026-09-16T20:10:00.000Z"))).toBe(30);
    expect(challengeSecondsRemaining("2026-09-16T20:09:59.000Z", Date.parse("2026-09-16T20:10:00.000Z"))).toBe(0);
    expect(challengeSecondsRemaining("invalid", Date.parse("2026-09-16T20:10:00.000Z"))).toBe(0);
  });
});
