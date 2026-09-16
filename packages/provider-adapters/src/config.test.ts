import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "./config.js";

const valid = {
  NODE_ENV: "production",
  TABLENOW_STACK_ID: "tablenow-v2",
  DATABASE_SCOPE: "tablenow-v2",
  DATABASE_URL: "postgresql://tablenow:secret@localhost:5432/tablenow",
  PUBLIC_ORIGIN: "https://app.example.test",
  SESSION_SECRET: "s".repeat(48),
  OTP_PEPPER: "p".repeat(48),
  PLATFORM_ADMIN_EMAIL: "owner@example.test",
  EMAIL_TRANSPORT: "smtp",
  SMTP_HOST: "smtp.example.test",
  SMTP_USER: "resend",
  SMTP_PASSWORD: "test-only-password",
  STORAGE_ENCRYPTION_KEY: "a".repeat(64),
};
const vercelPreview = {
  ...valid,
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
  VERCEL_GIT_COMMIT_REF: "product/onboarding-owner",
  PUBLIC_ORIGIN: "https://preview.tablenow.io",
  EMAIL_TRANSPORT: "log",
  SMTP_HOST: undefined,
  STORAGE_ENCRYPTION_KEY: undefined,
};

describe("runtime safety configuration", () => {
  it("rejects fixed login codes in production", () => {
    expect(() => loadRuntimeConfig({ ...valid, AUTH_FIXED_OTP: "424242" })).toThrow("AUTH_FIXED_OTP is forbidden");
  });

  it("requires a real mail transport in production", () => {
    expect(() => loadRuntimeConfig({ ...valid, EMAIL_TRANSPORT: "log" })).toThrow("Production requires a real SMTP transport");
  });

  it("requires complete SMTP authentication", () => {
    expect(() => loadRuntimeConfig({ ...valid, SMTP_USER: undefined })).toThrow("SMTP_USER");
    expect(() => loadRuntimeConfig({ ...valid, SMTP_PASSWORD: undefined })).toThrow("SMTP_PASSWORD");
  });

  it("accepts a portable PostgreSQL and SMTP configuration", () => {
    const config = loadRuntimeConfig(valid);
    expect(config.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(config.EMAIL_TRANSPORT).toBe("smtp");
  });

  it("treats an optimized Vercel preview as preview rather than production", () => {
    const config = loadRuntimeConfig(vercelPreview);
    expect(config.APP_ENV).toBe("preview");
    expect(config.PUBLIC_ORIGIN).toBe("https://preview.tablenow.io");
  });

  it("requires explicit secrets in previews and forbids fixed access codes", () => {
    expect(() => loadRuntimeConfig({ ...vercelPreview, SESSION_SECRET: undefined })).toThrow();
    expect(() => loadRuntimeConfig({ ...vercelPreview, OTP_PEPPER: undefined })).toThrow();
    expect(() => loadRuntimeConfig({ ...vercelPreview, AUTH_FIXED_OTP: "424242" })).toThrow("AUTH_FIXED_OTP is forbidden");
  });

  it("rejects every other Vercel project, branch and Preview origin", () => {
    expect(() => loadRuntimeConfig({ ...vercelPreview, VERCEL_PROJECT_PRODUCTION_URL: "another.vercel.app" })).toThrow("Vercel project");
    expect(() => loadRuntimeConfig({ ...vercelPreview, VERCEL_GIT_COMMIT_REF: "product/stitch-functional-owner" })).toThrow("Preview deployment");
    expect(() => loadRuntimeConfig({ ...vercelPreview, PUBLIC_ORIGIN: "https://copilot.tablenow.io" })).toThrow("Preview deployment");
  });

  it("accepts only main on os.tablenow.io in Vercel production", () => {
    const production = { ...valid, VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app", VERCEL_GIT_COMMIT_REF: "main", PUBLIC_ORIGIN: "https://os.tablenow.io" };
    expect(() => loadRuntimeConfig(production)).not.toThrow();
    expect(() => loadRuntimeConfig({ ...production, VERCEL_GIT_COMMIT_REF: "product/onboarding-owner" })).toThrow("production deployment");
  });

  it("does not create preview defaults for production", () => {
    expect(() => loadRuntimeConfig({
      NODE_ENV: "production",
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_PROJECT_PRODUCTION_URL: "copilot.tablenow.io",
      TABLENOW_STACK_ID: "tablenow-v2",
      DATABASE_SCOPE: "tablenow-v2",
      DATABASE_URL: valid.DATABASE_URL,
    })).toThrow();
  });

  it("rejects V1 and website origins for the V2 runtime", () => {
    expect(() => loadRuntimeConfig({ ...valid, PUBLIC_ORIGIN: "https://app.tablenow.io" })).toThrow("V2 cannot use");
    expect(() => loadRuntimeConfig({ ...valid, PUBLIC_ORIGIN: "https://www.tablenow.io" })).toThrow("V2 cannot use");
  });

  it("requires explicit V2 stack and database scopes in production", () => {
    expect(() => loadRuntimeConfig({ ...valid, TABLENOW_STACK_ID: "tablenow-v2-test" })).toThrow("TABLENOW_STACK_ID");
    expect(() => loadRuntimeConfig({ ...valid, DATABASE_SCOPE: "legacy" })).toThrow("DATABASE_SCOPE");
  });
});
