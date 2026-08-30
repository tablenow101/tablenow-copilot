import { describe, expect, it } from "vitest";
import { assertVercelDeploymentBoundary } from "./deployment-boundary";

const valid = {
  VERCEL: "1",
  TABLENOW_STACK_ID: "tablenow-v2",
  DATABASE_SCOPE: "tablenow-v2",
  VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app",
};

describe("Vercel deployment boundary", () => {
  it("accepts the isolated V2 project", () => {
    expect(() => assertVercelDeploymentBoundary(valid)).not.toThrow();
  });

  it("does not constrain self-hosted builds", () => {
    expect(() => assertVercelDeploymentBoundary({})).not.toThrow();
  });

  it("rejects a missing V2 identity or database scope", () => {
    expect(() => assertVercelDeploymentBoundary({ ...valid, TABLENOW_STACK_ID: "tablenow-v2-test" })).toThrow("TABLENOW_STACK_ID");
    expect(() => assertVercelDeploymentBoundary({ ...valid, DATABASE_SCOPE: "other" })).toThrow("DATABASE_SCOPE");
  });

  it.each(["app.tablenow.io", "tablenow.io", "www.tablenow.io"])("rejects protected host %s", (host) => {
    expect(() => assertVercelDeploymentBoundary({ ...valid, VERCEL_PROJECT_PRODUCTION_URL: host })).toThrow("cannot deploy");
  });
});
