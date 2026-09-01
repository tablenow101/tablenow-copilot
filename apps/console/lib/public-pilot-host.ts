const publicPilotHosts = new Set([
  "copilot.tablenow.io",
  "tablenow-copilot-v2.vercel.app",
  "tablenow-copilot-v2-tablenow101.vercel.app",
]);

export function isPublicPilotHostname(hostname: string): boolean {
  return publicPilotHosts.has(hostname.trim().toLowerCase());
}

export function isPublicPilotRuntime(): boolean {
  return typeof window !== "undefined" && isPublicPilotHostname(window.location.hostname);
}
