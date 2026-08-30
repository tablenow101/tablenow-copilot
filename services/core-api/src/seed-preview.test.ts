import { describe, expect, it } from "vitest";
import { shouldSeedPreview } from "./seed-preview.js";

describe("preview pilot seed gate", () => {
  it("runs only when explicitly enabled for a Vercel Preview", () => {
    expect(shouldSeedPreview({ VERCEL: "1", VERCEL_ENV: "preview", TABLENOW_PREVIEW_SEED: "true" })).toBe(true);
  });

  it("never runs in production", () => {
    expect(shouldSeedPreview({ VERCEL: "1", VERCEL_ENV: "production", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
  });

  it("stays disabled by default", () => {
    expect(shouldSeedPreview({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
  });
});
