export type AccessMethod = "native" | "api" | "mcp" | "calendar" | "browser" | "desktop" | "manual";
export type SystemStatus = "setup" | "ready" | "limited" | "offline" | "paused";

export interface RestaurantSystemCandidate {
  id: string;
  accessMethod: AccessMethod;
  status: SystemStatus;
  capabilities: string[];
  isSourceOfTruth: boolean;
  priority: number;
}

export interface ActionRoute {
  primary: RestaurantSystemCandidate;
  fallbacks: RestaurantSystemCandidate[];
  requiresHuman: boolean;
}

const reliability: Record<AccessMethod, number> = {
  native: 100,
  api: 95,
  mcp: 90,
  calendar: 80,
  browser: 65,
  desktop: 55,
  manual: 20,
};

export function routeRestaurantAction(capability: string, systems: RestaurantSystemCandidate[]): ActionRoute | null {
  const eligible = systems
    .filter((system) => system.capabilities.includes(capability) && ["ready", "limited"].includes(system.status))
    .sort((left, right) => score(right) - score(left));
  const [primary, ...fallbacks] = eligible;
  if (!primary) return null;
  return { primary, fallbacks, requiresHuman: primary.accessMethod === "manual" || primary.status === "limited" };
}

function score(system: RestaurantSystemCandidate): number {
  return (system.isSourceOfTruth ? 10_000 : 0) + reliability[system.accessMethod] * 10 - Math.max(0, system.priority);
}
