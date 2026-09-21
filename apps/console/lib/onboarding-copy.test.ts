import { describe, expect, it } from "vitest";
import { onboardingCopy } from "./onboarding-copy";

describe("onboarding language catalogs", () => {
  it("OB-23 exposes complete matching FR and EN catalogs only", () => {
    expect(Object.keys(onboardingCopy).sort()).toEqual(["en", "fr"]);
    expect(Object.keys(onboardingCopy.fr.common).sort()).toEqual(Object.keys(onboardingCopy.en.common).sort());
    expect(Object.keys(onboardingCopy.fr.sections).sort()).toEqual(Object.keys(onboardingCopy.en.sections).sort());
    expect(onboardingCopy.fr.direction).toBe("ltr");
    expect(onboardingCopy.en.direction).toBe("ltr");
  });

  it("keeps the six visible progress labels translated", () => {
    const fr = new Set(Object.values(onboardingCopy.fr.sections));
    const en = new Set(Object.values(onboardingCopy.en.sections));
    expect(fr).toEqual(new Set(["Établissement", "Priorités", "Réservations", "Fonctionnement", "Validation", "Votre plan"]));
    expect(en).toEqual(new Set(["Restaurant", "Priorities", "Reservations", "Operations", "Approval", "Your plan"]));
  });
  it("names the six visible stages without exposing storage keys", () => {
    expect(Object.values(onboardingCopy.fr.steps)).toEqual(["Priorités", "Établissement", "Systèmes", "Connexions", "Compléments", "Synthèse"]);
    expect(Object.keys(onboardingCopy.en.steps)).toEqual(Object.keys(onboardingCopy.fr.steps));
  });

});
