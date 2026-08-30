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
  STORAGE_ENCRYPTION_KEY: "a".repeat(64),
};

describe("runtime safety configuration", () => {
  it("rejects fixed login codes in production", () => {
    expect(() => loadRuntimeConfig({ ...valid, AUTH_FIXED_OTP: "424242" })).toThrow("AUTH_FIXED_OTP is forbidden");
  });

  it("requires a real mail transport in production", () => {
    expect(() => loadRuntimeConfig({ ...valid, EMAIL_TRANSPORT: "log" })).toThrow("Production requires a real SMTP transport");
  });

  it("accepts a portable PostgreSQL and SMTP configuration", () => {
    const config = loadRuntimeConfig(valid);
    expect(config.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(config.EMAIL_TRANSPORT).toBe("smtp");
  });

  it("treats an optimized Vercel preview as preview rather than production", () => {
    const config = loadRuntimeConfig({
      ...valid,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "tablenow-copilot-preview.vercel.app",
      PUBLIC_ORIGIN: undefined,
      EMAIL_TRANSPORT: "log",
      SMTP_HOST: undefined,
      STORAGE_ENCRYPTION_KEY: undefined,
      AUTH_FIXED_OTP: "424242",
    });
    expect(config.APP_ENV).toBe("preview");
    expect(config.PUBLIC_ORIGIN).toBe("https://tablenow-copilot-preview.vercel.app");
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
