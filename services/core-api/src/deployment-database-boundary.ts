import { resolveVercelDeployment, tableNowDeploymentTopology, type DeploymentEnvironment } from "@tablenow/contracts";

export function assertVercelDatabaseBoundary(connection: string, environment: DeploymentEnvironment): void {
  const deployment = resolveVercelDeployment(environment);
  if (!deployment) {
    throw new Error("Database migration blocked: the Vercel project, branch and origin are not approved.");
  }

  const url = new URL(connection);
  const endpoint = url.hostname.split(".")[0]!;
  const approvedEndpoint = deployment.neonEndpoint;
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.hostname.endsWith(".neon.tech")
    || url.pathname !== `/${tableNowDeploymentTopology.database}`
    || (endpoint !== approvedEndpoint && !endpoint.startsWith(`${approvedEndpoint}-`))) {
    throw new Error(`Database migration blocked: ${deployment.environment} requires its dedicated Copilot Neon database. No credentials are logged.`);
  }
}
