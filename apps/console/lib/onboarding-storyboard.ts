import { onboardingSectionOrder, onboardingPresentationSteps, type OnboardingPresentationStep } from "@tablenow/contracts";
import type { SectionKey } from "./onboarding";

export const onboardingStoryboard: readonly SectionKey[] = onboardingSectionOrder;
// Eight storage keys are retained. Connections is a new presentation step, not a
// reinterpretation of an old confirmation. Preferences remain in Complements.
export const onboardingProgressGroups: ReadonlyArray<{ key: OnboardingPresentationStep; sections: readonly SectionKey[]; target: SectionKey }> = [
  { key: "priorities", sections: ["priorities"], target: "priorities" },
  { key: "establishment", sections: ["establishment"], target: "establishment" },
  { key: "systems", sections: ["reservations"], target: "reservations" },
  { key: "connections", sections: [], target: "reservations" },
  { key: "complements", sections: ["interaction", "operations", "authority", "final_note"], target: "operations" },
  { key: "review", sections: ["review"], target: "review" },
];
export function presentationStepForSection(section: SectionKey): OnboardingPresentationStep {
  // An old partial draft at interaction has not yet declared its systems.
  if (section === "interaction" || section === "reservations") return "systems";
  if (["operations", "authority", "final_note"].includes(section)) return "complements";
  return section as "priorities" | "establishment" | "review";
}
export function presentationSection(step: OnboardingPresentationStep): SectionKey {
  return onboardingProgressGroups.find(group => group.key === step)!.target;
}
export function adjacentPresentationStep(step: OnboardingPresentationStep, direction: -1 | 1): OnboardingPresentationStep {
  const index = onboardingPresentationSteps.indexOf(step);
  return onboardingPresentationSteps[Math.max(0, Math.min(onboardingPresentationSteps.length - 1, index + direction))]!;
}
export function conversationSection(step: OnboardingPresentationStep | undefined, storedSection: SectionKey): SectionKey {
  if (step === "systems") return "reservations";
  if (step === "complements" || step === "connections" || step === "review" || storedSection === "review") return "final_note";
  return storedSection;
}
export function nextOnboardingSection(section: SectionKey): SectionKey {
  const index = onboardingStoryboard.indexOf(section);
  return onboardingStoryboard[Math.min(onboardingStoryboard.length - 1, index + 1)] ?? section;
}
export function previousOnboardingSection(section: SectionKey): SectionKey {
  const index = onboardingStoryboard.indexOf(section);
  return onboardingStoryboard[Math.max(0, index - 1)] ?? section;
}
