// Every owner-product hostname now uses the authenticated API.
const publicPilotHosts = new Set<string>();

export function isPublicPilotHostname(hostname: string): boolean {
  return publicPilotHosts.has(hostname.trim().toLowerCase());
}

export function isPublicPilotRuntime(): boolean {
  return typeof window !== "undefined" && isPublicPilotHostname(window.location.hostname);
}
