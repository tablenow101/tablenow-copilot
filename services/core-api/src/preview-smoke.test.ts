import { describe, expect, it } from "vitest";
import { shouldRunPreviewSmoke } from "./preview-smoke.js";

describe("preview smoke gate", () => {
  it("runs only for an explicitly seeded Vercel preview", () => {
    expect(shouldRunPreviewSmoke({ VERCEL: "1", VERCEL_ENV: "preview", TABLENOW_PREVIEW_SEED: "true" })).toBe(true);
    expect(shouldRunPreviewSmoke({ VERCEL: "1", VERCEL_ENV: "production", TABLENOW_PREVIEW_SEED: "true" })).toBe(false);
    expect(shouldRunPreviewSmoke({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(false);
  });
});
