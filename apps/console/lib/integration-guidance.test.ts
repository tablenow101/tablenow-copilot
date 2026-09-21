import { describe, expect, it } from "vitest";
import { emptyOnboardingAnswers } from "./onboarding";
import { declaredIntegrationGuides, integrationGuides } from "./integration-guidance";
import { onboardingChecklist } from "./onboarding-checklist";
import { onboardingAnswersSchema } from "@tablenow/contracts";

describe("declared integration readiness", () => {
  it("never invents software from an empty or manual workflow", () => {
    const answers = emptyOnboardingAnswers();
    expect(declaredIntegrationGuides(answers)).toEqual([]);
    answers.reservations.methods = ["paper"];
    answers.reservations.otherProvider = "Zenchef"; // dormant answer preserved, not selected
    answers.systems = { pointOfSale: { status: "none", name: "Old POS" } };
    expect(declaredIntegrationGuides(answers)).toEqual([]);
  });
  it("covers all explicitly selected tools without mutating historical answers", () => {
    const answers = emptyOnboardingAnswers();
    answers.reservations.providers = ["zenchef", "sevenrooms", "thefork", "opentable", "other"];
    answers.reservations.otherProvider = "My tool";
    answers.reservations.methods = ["software", "calendar"];
    answers.reservations.calendarProvider = "outlook";
    answers.operations.communications.channels = ["whatsapp", "instagram", "messenger", "emails", "sms", "calls"];
    answers.systems = { pointOfSale: { status: "declared", name: "My POS" } };
    const before = JSON.stringify(answers);
    const rows = declaredIntegrationGuides(answers);
    expect(rows.map(row => row.id)).toEqual(["zenchef", "sevenrooms", "thefork", "opentable", "reservation-other", "outlook", "pos", "whatsapp", "instagram", "messenger", "emails", "sms", "calls"]);
    expect(rows.every(row => row.status === "to_connect" && row.blocker.fr && row.next.en)).toBe(true);
    expect(declaredIntegrationGuides(answers)).toEqual(rows);
    expect(JSON.stringify(answers)).toBe(before);
    expect(onboardingAnswersSchema.parse(answers)).toEqual(answers);
    expect(onboardingChecklist(answers).filter(row => row.step === "connections").every(row => !row.complete)).toBe(true);
  });
  it("recognizes exact historical other-provider declarations without rewriting them", () => {
    const answers = emptyOnboardingAnswers();
    answers.reservations.providers = ["other"];
    answers.reservations.otherProvider = "OpenTable";
    expect(declaredIntegrationGuides(answers)[0]?.id).toBe("opentable");
    expect(answers.reservations.providers).toEqual(["other"]);
    answers.reservations.otherProvider = "Maybe OpenTable later";
    expect(declaredIntegrationGuides(answers)[0]?.id).toBe("reservation-other");
  });
  it("provides official guidance without declaring unsupported adapters available", () => {
    for (const row of integrationGuides) {
      expect(row.status).toBe("to_connect");
      expect(row.next.fr.length).toBeGreaterThan(40);
      if (row.source) expect(new URL(row.source).protocol).toBe("https:");
    }
    expect(integrationGuides.find(row => row.id === "google_calendar")?.next.fr).toContain("ne donne aucun accès");
  });
});
