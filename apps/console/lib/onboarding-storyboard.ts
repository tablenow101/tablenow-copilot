import { onboardingSectionOrder } from "@tablenow/contracts";
import type { SectionKey } from "./onboarding";

export const onboardingStoryboard: readonly SectionKey[] = onboardingSectionOrder;

export const onboardingProgressGroups: ReadonlyArray<{
  key: string;
  sections: readonly SectionKey[];
  target: SectionKey;
}> = [
  { key: "priorities", sections: ["priorities"], target: "priorities" },
  { key: "establishment", sections: ["establishment"], target: "establishment" },
  { key: "reservations", sections: ["interaction", "reservations"], target: "reservations" },
  { key: "operations", sections: ["operations"], target: "operations" },
  { key: "authority", sections: ["authority", "final_note"], target: "authority" },
  { key: "review", sections: ["review"], target: "review" },
];

export function nextOnboardingSection(section: SectionKey): SectionKey {
  const index = onboardingStoryboard.indexOf(section);
  return onboardingStoryboard[Math.min(onboardingStoryboard.length - 1, index + 1)] ?? section;
}

export function previousOnboardingSection(section: SectionKey): SectionKey {
  const index = onboardingStoryboard.indexOf(section);
  return onboardingStoryboard[Math.max(0, index - 1)] ?? section;
}
