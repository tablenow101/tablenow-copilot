import { describe, expect, it } from "vitest";
import { shouldSeedPreview } from "./seed-preview.js";

const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
  VERCEL_GIT_COMMIT_REF: "product/onboarding-owner",
  PUBLIC_ORIGIN: "https://preview.tablenow.io",
};

describe("preview pilot seed gate", () => {
  it("runs only when explicitly enabled for a Vercel Preview", () => {
    expect(shouldSeedPreview({ ...preview, TABLENOW_PREVIEW_SEED: "true" })).toBe(true);
    expect(shouldSeedPreview({ ...preview, VERCEL_GIT_COMMIT_REF: "other", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
  });

  it("never runs in production", () => {
    expect(shouldSeedPreview({ VERCEL: "1", VERCEL_ENV: "production", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
  });

  it("stays disabled by default", () => {
    expect(shouldSeedPreview(preview)).toBe(false);
  });
});
