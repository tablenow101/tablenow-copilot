const protectedHosts = new Set(["app.tablenow.io", "tablenow.io", "www.tablenow.io"]);

type DeploymentEnvironment = Record<string, string | undefined>;

export function assertVercelDeploymentBoundary(environment: DeploymentEnvironment): void {
  if (environment.VERCEL !== "1") return;
  if (environment.TABLENOW_STACK_ID !== "tablenow-v2") {
    throw new Error("Vercel V2 build requires TABLENOW_STACK_ID=tablenow-v2");
  }
  if (environment.DATABASE_SCOPE !== "tablenow-v2") {
    throw new Error("Vercel V2 build requires DATABASE_SCOPE=tablenow-v2");
  }
  if (protectedHosts.has(environment.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase() || "")) {
    throw new Error("The V2 console cannot deploy onto the V1 or website project");
  }
}
