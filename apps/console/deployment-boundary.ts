import { resolveVercelDeployment, tableNowDeploymentTopology } from "@tablenow/contracts";

type DeploymentEnvironment = Record<string, string | undefined>;

export function assertVercelDeploymentBoundary(environment: DeploymentEnvironment): void {
  if (environment.VERCEL !== "1") return;
  if (environment.TABLENOW_STACK_ID !== "tablenow-v2") {
    throw new Error("Vercel V2 build requires TABLENOW_STACK_ID=tablenow-v2");
  }
  if (environment.DATABASE_SCOPE !== "tablenow-v2") {
    throw new Error("Vercel V2 build requires DATABASE_SCOPE=tablenow-v2");
  }
  if (environment.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase() !== tableNowDeploymentTopology.vercelProject) {
    throw new Error("The V2 console cannot deploy to this Vercel project");
  }
  if (resolveVercelDeployment(environment)) return;
  if (environment.VERCEL_ENV === "preview") throw new Error("Vercel Preview requires product/onboarding-owner on https://preview.tablenow.io");
  if (environment.VERCEL_ENV === "production") throw new Error("Vercel production requires main on https://os.tablenow.io");
  throw new Error("Unsupported Vercel deployment environment");
}
