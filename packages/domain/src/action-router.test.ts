import { describe, expect, it } from "vitest";
import { routeRestaurantAction, type RestaurantSystemCandidate } from "./action-router.js";

const systems: RestaurantSystemCandidate[] = [
  { id: "native", accessMethod: "native", status: "ready", capabilities: ["reservation.create"], isSourceOfTruth: false, priority: 10 },
  { id: "browser", accessMethod: "browser", status: "ready", capabilities: ["reservation.create"], isSourceOfTruth: true, priority: 20 },
  { id: "paper", accessMethod: "manual", status: "ready", capabilities: ["reservation.create"], isSourceOfTruth: false, priority: 90 },
];

describe("restaurant action router", () => {
  it("respects the restaurant source of truth", () => {
    expect(routeRestaurantAction("reservation.create", systems)?.primary.id).toBe("browser");
  });

  it("falls back to TableNow native when the external system is offline", () => {
    const offline = systems.map((system) => system.id === "browser" ? { ...system, status: "offline" as const } : system);
    expect(routeRestaurantAction("reservation.create", offline)?.primary.id).toBe("native");
  });

  it("keeps manual operations available for paper-first restaurants", () => {
    expect(routeRestaurantAction("reservation.create", [systems[2]!])?.requiresHuman).toBe(true);
  });
});
