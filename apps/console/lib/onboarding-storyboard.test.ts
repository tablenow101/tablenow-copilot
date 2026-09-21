import { describe, expect, it } from "vitest";
import {
  nextOnboardingSection,
  onboardingProgressGroups,
  presentationStepForSection,
  presentationSection,
  adjacentPresentationStep,
  onboardingStoryboard,
  previousOnboardingSection,
} from "./onboarding-storyboard";

describe("onboarding storyboard", () => {
  it("opens priorities first and establishment second", () => {
    expect(onboardingStoryboard.slice(0, 2)).toEqual(["priorities", "establishment"]);
    expect(nextOnboardingSection("priorities")).toBe("establishment");
    expect(previousOnboardingSection("establishment")).toBe("priorities");
  });

  it("does not skip a persisted step", () => {
    expect(nextOnboardingSection("establishment")).toBe("interaction");
    expect(nextOnboardingSection("final_note")).toBe("review");
    expect(nextOnboardingSection("review")).toBe("review");
  });
  it("shows six canonical groups while retaining every historical section", () => {
    expect(onboardingProgressGroups.map(group => group.key)).toEqual(["priorities", "establishment", "systems", "connections", "complements", "review"]);
    expect(onboardingProgressGroups.flatMap(group => group.sections).sort()).toEqual([...onboardingStoryboard].sort());
    expect(presentationStepForSection("authority")).toBe("complements");
    expect(presentationStepForSection("interaction")).toBe("systems");
    expect(presentationStepForSection("review")).toBe("review");
    expect(adjacentPresentationStep("systems", 1)).toBe("connections");
    expect(adjacentPresentationStep("connections", 1)).toBe("complements");
    expect(presentationSection("connections")).toBe("reservations");
  });

});
