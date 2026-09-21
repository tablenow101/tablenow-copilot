import { describe, expect, it } from "vitest";
import { emptyOnboardingAnswers } from "./onboarding";
import { onboardingChecklist } from "./onboarding-checklist";

describe("saved-answer setup checklist", () => {
  it("asks for missing information without inventing software or connections", () => {
    const items = onboardingChecklist(emptyOnboardingAnswers());
    expect(items.map(item => item.id)).toEqual(["priorities", "establishment", "reservation-inventory", "pos-inventory"]);
    expect(items.every(item => !item.complete)).toBe(true);
    expect(JSON.stringify(items)).not.toMatch(/Zenchef|connecté/);
  });
  it("recalculates from the actual declared systems, never treating declarations as verified connections", () => {
    const answers = emptyOnboardingAnswers();
    answers.priorities.primaryFocus = "reservations";
    answers.establishment.identityConfirmed = true;
    answers.reservations.providers = ["zenchef", "other"];
    answers.reservations.otherProvider = "Mon outil";
    const before = JSON.stringify(answers);
    const items = onboardingChecklist(answers);
    expect(items.filter(item => item.id.startsWith("reservation-") && item.id !== "reservation-inventory").map(item => [item.title, item.complete])).toEqual([["Zenchef : connexion à préparer", false], ["Mon outil : connexion à préparer", false]]);
    expect(onboardingChecklist(answers)).toEqual(items);
    expect(JSON.stringify(answers)).toBe(before);
  });
  it("preserves the distinction between no POS and a POS still awaiting a connection", () => {
    const answers = emptyOnboardingAnswers();
    answers.systems = { pointOfSale: { status: "none" } };
    expect(onboardingChecklist(answers).find(item => item.id === "pos-inventory")?.complete).toBe(true);
    answers.systems.pointOfSale = { status: "declared", name: "Ma caisse" };
    expect(onboardingChecklist(answers).find(item => item.id === "pos-inventory")).toMatchObject({ title: "Caisse : Ma caisse", complete: false, step: "connections" });
  });
  it("accepts an explicitly paper-based organisation without imposing software", () => {
    const answers = emptyOnboardingAnswers();
    answers.reservations.methods = ["paper"];
    const items = onboardingChecklist(answers);
    expect(items.find(item => item.id === "reservation-inventory")?.complete).toBe(true);
    expect(items).toHaveLength(4);
  });
});
