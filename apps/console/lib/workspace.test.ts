import { describe, expect, it } from "vitest";
import type { Workspace } from "./types";
import { aggregateWorkspaceMetrics, scopeWorkspace } from "./workspace";

const firstRestaurantId = "00000000-0000-4000-8000-000000000001";
const secondRestaurantId = "00000000-0000-4000-8000-000000000002";

const workspace = {
  summary: { occupancyPercent: 75, openDecisions: 3, availableTables: 8, inventoryAlerts: 2, revenueCapturedToday: 3000, timeSavedMinutes: 90, coversToday: 120 },
  restaurantSummaries: [
    { restaurantId: firstRestaurantId, occupancyPercent: 90, openDecisions: 2, availableTables: 2, inventoryAlerts: 1, revenueCapturedToday: 2000, timeSavedMinutes: 60, coversToday: 90 },
    { restaurantId: secondRestaurantId, occupancyPercent: 50, openDecisions: 1, availableTables: 6, inventoryAlerts: 1, revenueCapturedToday: 1000, timeSavedMinutes: 30, coversToday: 30 },
  ],
  restaurants: [
    { id: firstRestaurantId, name: "TableNow Bastille", slug: "bastille", address: "Paris", phone: null, timezone: "Europe/Paris", capacity: 100, isDemo: true },
    { id: secondRestaurantId, name: "TableNow Lyon", slug: "lyon", address: "Lyon", phone: null, timezone: "Europe/Paris", capacity: 60, isDemo: true },
  ],
  reservations: [{ id: "r1", restaurantId: firstRestaurantId, guestName: "Camille", guestEmail: null, guestPhone: null, startsAt: new Date().toISOString(), partySize: 2, status: "confirmed", source: "manual", notes: null }],
  communications: [], decisions: [], tasks: [], shifts: [], inventory: [], metrics: [],
  actions: [
    { id: "a1", restaurantId: firstRestaurantId, conversationId: "c1", tool: "workspace.explain", title: "Analyse", rationale: "Test", risk: "low", approvalRequired: false, status: "proposed", createdAt: new Date().toISOString() },
    { id: "a2", restaurantId: secondRestaurantId, conversationId: "c2", tool: "workspace.explain", title: "Analyse", rationale: "Test", risk: "low", approvalRequired: false, status: "proposed", createdAt: new Date().toISOString() },
  ],
} satisfies Workspace;

describe("restaurant workspace scope", () => {
  it("keeps the group workspace unchanged when no restaurant is selected", () => {
    expect(scopeWorkspace(workspace, null)).toBe(workspace);
  });

  it("filters data, actions and summary to the selected restaurant", () => {
    const scoped = scopeWorkspace(workspace, firstRestaurantId);
    expect(scoped?.restaurants.map((item) => item.id)).toEqual([firstRestaurantId]);
    expect(scoped?.reservations.map((item) => item.id)).toEqual(["r1"]);
    expect(scoped?.actions.map((item) => item.id)).toEqual(["a1"]);
    expect(scoped?.summary).toMatchObject({ occupancyPercent: 90, coversToday: 90, availableTables: 2 });
  });

  it("fails safely by retaining the group view for an unknown restaurant", () => {
    expect(scopeWorkspace(workspace, "00000000-0000-4000-8000-000000000099")).toBe(workspace);
  });
});

describe("group performance aggregation", () => {
  it("combines every restaurant on the same reporting date", () => {
    expect(aggregateWorkspaceMetrics([
      { restaurantId: "paris", date: "2026-08-30", revenueCaptured: 120, covers: 20, callsHandled: 4, conversionRate: 50, timeSavedMinutes: 30 },
      { restaurantId: "lyon", date: "2026-08-30", revenueCaptured: 80, covers: 10, callsHandled: 2, conversionRate: 70, timeSavedMinutes: 20 },
      { restaurantId: "paris", date: "2026-08-31", revenueCaptured: 40, covers: 5, callsHandled: 1, conversionRate: 60, timeSavedMinutes: 10 },
    ])).toEqual([
      { restaurantId: "group", date: "2026-08-30", revenueCaptured: 200, covers: 30, callsHandled: 6, conversionRate: 60, timeSavedMinutes: 50 },
      { restaurantId: "group", date: "2026-08-31", revenueCaptured: 40, covers: 5, callsHandled: 1, conversionRate: 60, timeSavedMinutes: 10 },
    ]);
  });

  it("keeps an empty reporting period empty", () => {
    expect(aggregateWorkspaceMetrics([])).toEqual([]);
  });
});
