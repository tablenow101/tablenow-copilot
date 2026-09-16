import { describe, expect, it } from "vitest";
import {
  nextOnboardingSection,
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
});
