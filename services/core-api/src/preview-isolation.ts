// Non-secret compute identifiers verified in the dedicated Copilot Neon project.
// A new delivery branch must not migrate production or another branch's workspace.
const protectedEndpoints = [
  "ep-crimson-sound-za2s6xo0", // main
  "ep-crimson-dust-za2sb4ht", // preserved onboarding preview
  "ep-soft-hill-zati6ggr", "ep-jolly-thunder-zatrtfhc",
  "ep-soft-river-zavbu5e7", "ep-spring-wildflower-zaqhw3br",
  "ep-square-brook-za81rnjx", "ep-summer-forest-zab0ihvj",
];

export function assertPreviewDatabaseIsolation(connection: string): void {
  const url = new URL(connection);
  const endpoint = url.hostname.split(".")[0]!;
  if (!["postgres:", "postgresql:"].includes(url.protocol)
    || !url.hostname.endsWith(".neon.tech")
    || !endpoint.startsWith("ep-")
    || protectedEndpoints.some((id) => endpoint === id || endpoint.startsWith(`${id}-`))) {
    throw new Error("Preview migration blocked: a separate Copilot Neon branch is required. No database credentials are logged.");
  }
}
