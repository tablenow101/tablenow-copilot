import { tableNowDeploymentTopology, type DeploymentEnvironment } from "@tablenow/contracts";

const legacyCopilotHost = "copilot\\.tablenow\\.io";

export function legacyCopilotRedirect(environment: DeploymentEnvironment) {
  const production = environment.VERCEL_ENV === tableNowDeploymentTopology.production.environment;
  const target = production ? tableNowDeploymentTopology.production : tableNowDeploymentTopology.preview;

  return {
    source: "/:path*",
    has: [{ type: "host" as const, value: legacyCopilotHost }],
    destination: `${target.origin}/:path*`,
    // Do not cache the temporary Preview destination. Once main is live, the
    // same legacy hostname becomes a permanent redirect to os.tablenow.io.
    permanent: production,
  };
}
