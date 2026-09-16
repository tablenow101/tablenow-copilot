import { describe, expect, it } from "vitest";
import { assertVercelDatabaseBoundary } from "./deployment-database-boundary.js";

const base = {
  VERCEL: "1",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
};
const preview = {
  ...base,
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "product/onboarding-owner",
  PUBLIC_ORIGIN: "https://preview.tablenow.io",
};
const production = {
  ...base,
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_REF: "main",
  PUBLIC_ORIGIN: "https://os.tablenow.io",
};

describe("Vercel database migration boundary", () => {
  it("checks project, branch and origin before accepting a Preview database", () => {
    const connection = "postgres://test:test@ep-rapid-leaf-zas11naf-pooler.c-2.eu-west-2.aws.neon.tech/neondb";
    expect(() => assertVercelDatabaseBoundary(connection, preview)).not.toThrow();
    expect(() => assertVercelDatabaseBoundary(connection, { ...preview, VERCEL_GIT_COMMIT_REF: "other" })).toThrow("branch and origin");
    expect(() => assertVercelDatabaseBoundary(connection, { ...preview, PUBLIC_ORIGIN: "https://copilot.tablenow.io" })).toThrow("branch and origin");
  });

  it("refuses production and unrelated endpoints during Preview", () => {
    for (const endpoint of ["ep-crimson-sound-za2s6xo0", "ep-crimson-dust-za2sb4ht", "ep-unrelated"]) {
      expect(() => assertVercelDatabaseBoundary(`postgres://test:test@${endpoint}.c-2.eu-west-2.aws.neon.tech/neondb`, preview)).toThrow("dedicated Copilot Neon");
    }
  });

  it("accepts only the dedicated production database for main", () => {
    const connection = "postgres://test:test@ep-crimson-sound-za2s6xo0-pooler.c-2.eu-west-2.aws.neon.tech/neondb";
    expect(() => assertVercelDatabaseBoundary(connection, production)).not.toThrow();
    expect(() => assertVercelDatabaseBoundary(connection, { ...production, VERCEL_GIT_COMMIT_REF: "product/onboarding-owner" })).toThrow("branch and origin");
    expect(() => assertVercelDatabaseBoundary(connection.replace("/neondb", "/other"), production)).toThrow("dedicated Copilot Neon");
  });
});
