import { describe, expect, it } from "vitest";
import {
  nextOnboardingSection,
  savedOnboardingUrl,
  requestedPresentationStep,
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

  it("keeps a direct systems link explicit, but restores each saved visible step after reload", () => {
    expect(requestedPresentationStep("reservations", null)).toBe("systems");
    let url = "https://preview.tablenow.io/onboarding?restaurantId=restaurant-1&section=reservations&from=decisions#details";
    for (const [section, step] of [["reservations", "connections"], ["operations", "complements"], ["review", "review"], ["reservations", "systems"]] as const) {
      url = new URL(savedOnboardingUrl(url, { restaurantId: "restaurant-1", currentSection: section, answers: { presentationStep: step } }), url).href;
      const reloaded = new URL(url);
      expect(reloaded.searchParams.get("restaurantId")).toBe("restaurant-1");
      expect(reloaded.searchParams.get("from")).toBe("decisions");
      expect(reloaded.hash).toBe("#details");
      expect(reloaded.searchParams.get("section")).toBe(section);
      expect(requestedPresentationStep(section, reloaded.searchParams.get("step"))).toBe(step);
    }
  });

  it("uses confirmed draft navigation without trusting unrelated or stale query stages", () => {
    const url = savedOnboardingUrl("https://preview.tablenow.io/onboarding?section=review&step=connections", {
      restaurantId: "restaurant-2", currentSection: "authority", answers: { presentationStep: "complements" },
    });
    expect(url).toBe("/onboarding?section=authority&step=complements&restaurantId=restaurant-2");
    expect(requestedPresentationStep("review", "connections")).toBe("review");
    expect(requestedPresentationStep("reservations", "not-a-step")).toBe("systems");
    expect(requestedPresentationStep("authority", "complements")).toBe("complements");
  });

});
