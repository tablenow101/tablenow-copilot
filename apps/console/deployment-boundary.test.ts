import { describe, expect, it } from "vitest";
import { assertVercelDeploymentBoundary } from "./deployment-boundary";

const base = {
  VERCEL: "1",
  TABLENOW_STACK_ID: "tablenow-v2",
  DATABASE_SCOPE: "tablenow-v2",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
};
const preview = {
  ...base,
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "product/onboarding-owner",
  PUBLIC_ORIGIN: "https://preview.tablenow.io",
};

describe("Vercel deployment boundary", () => {
  it("accepts the isolated V2 project", () => {
    expect(() => assertVercelDeploymentBoundary(preview)).not.toThrow();
  });

  it("does not constrain self-hosted builds", () => {
    expect(() => assertVercelDeploymentBoundary({})).not.toThrow();
  });

  it("rejects a missing V2 identity or database scope", () => {
    expect(() => assertVercelDeploymentBoundary({ ...preview, TABLENOW_STACK_ID: "tablenow-v2-test" })).toThrow("TABLENOW_STACK_ID");
    expect(() => assertVercelDeploymentBoundary({ ...preview, DATABASE_SCOPE: "other" })).toThrow("DATABASE_SCOPE");
  });

  it("rejects every other project, branch and Preview origin", () => {
    expect(() => assertVercelDeploymentBoundary({ ...preview, VERCEL_PROJECT_PRODUCTION_URL: "another.vercel.app" })).toThrow("Vercel project");
    expect(() => assertVercelDeploymentBoundary({ ...preview, VERCEL_GIT_COMMIT_REF: "product/stitch-functional-owner" })).toThrow("Preview requires");
    expect(() => assertVercelDeploymentBoundary({ ...preview, PUBLIC_ORIGIN: "https://copilot.tablenow.io" })).toThrow("Preview requires");
  });

  it("accepts only main on the production domain", () => {
    const production = { ...base, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", PUBLIC_ORIGIN: "https://os.tablenow.io" };
    expect(() => assertVercelDeploymentBoundary(production)).not.toThrow();
    expect(() => assertVercelDeploymentBoundary({ ...production, VERCEL_GIT_COMMIT_REF: "product/onboarding-owner" })).toThrow("production requires");
    expect(() => assertVercelDeploymentBoundary({ ...production, PUBLIC_ORIGIN: "https://preview.tablenow.io" })).toThrow("production requires");
  });
});
