import type { OnboardingAnswers } from "@tablenow/contracts";

export const priorityActivities = ["team", "reservations", "customer_communication", "operations"] as const;
export const priorityOutcomes = ["profitability", "occupancy", "customer_requests", "team_coordination", "service_disruptions", "customer_loyalty"] as const;

export function allPrioritiesSelected(priorities: OnboardingAnswers["priorities"]): boolean {
  return priorityActivities.every(key => priorities.timeConsumers.includes(key)) && priorityOutcomes.every(key => priorities.outcomes.includes(key));
}
/** Select all defined, in-scope choices, including collapsed ones. Free text stays explicit. */
export function toggleAllPriorities(priorities: OnboardingAnswers["priorities"]): void {
  const deselect = allPrioritiesSelected(priorities);
  priorities.timeConsumers = deselect ? [] : [...priorityActivities, ...(priorities.timeConsumers.includes("other") ? ["other" as const] : [])];
  priorities.outcomes = deselect ? [] : [...priorityOutcomes];
  priorities.scope = "targeted";
  if (deselect) priorities.primaryFocus = undefined;
  // The user chooses the starting point; selecting everything does not rank priorities.
}
