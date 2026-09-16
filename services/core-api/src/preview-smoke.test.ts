import { describe, expect, it } from "vitest";
import { shouldRunPreviewSmoke } from "./preview-smoke.js";

const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
  VERCEL_GIT_COMMIT_REF: "product/onboarding-owner",
  PUBLIC_ORIGIN: "https://preview.tablenow.io",
};

describe("preview smoke gate", () => {
  it("runs only for an explicitly seeded Vercel preview", () => {
    expect(shouldRunPreviewSmoke({ ...preview, TABLENOW_PREVIEW_SEED: "true" })).toBe(true);
    expect(shouldRunPreviewSmoke({ ...preview, PUBLIC_ORIGIN: "https://copilot.tablenow.io", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
    expect(shouldRunPreviewSmoke({ VERCEL: "1", VERCEL_ENV: "production", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
    expect(shouldRunPreviewSmoke(preview)).toBe(false);
  });
});
