import type { Workspace } from "./types";

export function scopeWorkspace(workspace: Workspace | null, restaurantId: string | null): Workspace | null {
  if (!workspace || !restaurantId) return workspace;
  const summary = workspace.restaurantSummaries.find((item) => item.restaurantId === restaurantId);
  const restaurant = workspace.restaurants.find((item) => item.id === restaurantId);
  if (!summary || !restaurant) return workspace;
  const belongsToRestaurant = <T extends { restaurantId: string }>(items: T[]) => items.filter((item) => item.restaurantId === restaurantId);
  return {
    ...workspace,
    summary: {
      occupancyPercent: summary.occupancyPercent,
      openDecisions: summary.openDecisions,
      availableTables: summary.availableTables,
      inventoryAlerts: summary.inventoryAlerts,
      revenueCapturedToday: summary.revenueCapturedToday,
      timeSavedMinutes: summary.timeSavedMinutes,
      coversToday: summary.coversToday,
    },
    restaurants: [restaurant],
    reservations: belongsToRestaurant(workspace.reservations),
    communications: belongsToRestaurant(workspace.communications),
    decisions: belongsToRestaurant(workspace.decisions),
    tasks: belongsToRestaurant(workspace.tasks),
    shifts: belongsToRestaurant(workspace.shifts),
    inventory: belongsToRestaurant(workspace.inventory),
    metrics: belongsToRestaurant(workspace.metrics),
    actions: workspace.actions.filter((item) => item.restaurantId === restaurantId),
  };
}

export function aggregateWorkspaceMetrics(metrics: Workspace["metrics"]): Workspace["metrics"] {
  const byDate = new Map<string, Workspace["metrics"]>();

  for (const metric of metrics) {
    const sameDay = byDate.get(metric.date) || [];
    sameDay.push(metric);
    byDate.set(metric.date, sameDay);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, sameDay]) => ({
      restaurantId: "group",
      date,
      revenueCaptured: sameDay.reduce((sum, metric) => sum + metric.revenueCaptured, 0),
      covers: sameDay.reduce((sum, metric) => sum + metric.covers, 0),
      callsHandled: sameDay.reduce((sum, metric) => sum + metric.callsHandled, 0),
      conversionRate: sameDay.reduce((sum, metric) => sum + metric.conversionRate, 0) / sameDay.length,
      timeSavedMinutes: sameDay.reduce((sum, metric) => sum + metric.timeSavedMinutes, 0),
    }));
}
