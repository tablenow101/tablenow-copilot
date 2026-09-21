import { describe, expect, it } from "vitest";
import { applyFreeText, confirmStatement, editStatement, emptyOnboardingAnswers, removeStatement, reviewableStatements } from "./onboarding";
import { onboardingCopy } from "./onboarding-copy";

describe("explicit complement edits", () => {
  it("keeps every other idea and revokes the edited rule confirmation until confirmed again", () => {
    const answers = applyFreeText(emptyOnboardingAnswers(), "final_note", "Le chef doit valider les groupes.\nNous ouvrons à midi.", "user_voice");
    const first = answers.finalNote.statements[0]!;
    const second = structuredClone(answers.finalNote.statements[1]!);
    confirmStatement(answers, first.id);
    editStatement(answers, first.id, "La directrice doit valider les groupes.");
    expect(answers.finalNote.statements[0]).toMatchObject({ value: "La directrice doit valider les groupes.", status: "proposed", source: "user_text" });
    expect(answers.finalNote.confirmedStatementIds).not.toContain(first.id);
    expect(answers.authority.proposedRules).toEqual([]);
    expect(answers.finalNote.statements[1]).toEqual(second);
    expect(answers.finalNote.text).toBe("La directrice doit valider les groupes.\nNous ouvrons à midi.");
  });
  it("does not resurrect a deliberately deleted idea when adding another one", () => {
    let answers = applyFreeText(emptyOnboardingAnswers(), "final_note", "Nous ouvrons à midi.\nLe chef doit valider les groupes.", "user_text");
    const deleted = answers.finalNote.statements[0]!;
    removeStatement(answers, deleted.id);
    answers = applyFreeText(answers, "final_note", `${answers.finalNote.text}\nNous avons une terrasse.`, "user_text");
    expect(answers.finalNote.text).not.toContain(deleted.value);
    expect(answers.finalNote.statements.some(item => item.id === deleted.id)).toBe(false);
    expect(answers.finalNote.statements).toHaveLength(2);
  });
  it("does not reject an unrelated idea when confirming one of several written ideas", () => {
    const answers = applyFreeText(emptyOnboardingAnswers(), "final_note", "Nous ouvrons à midi.\nNous avons une terrasse.", "user_text");
    confirmStatement(answers, answers.finalNote.statements[0]!.id);
    expect(answers.finalNote.statements.map(item => item.status)).toEqual(["confirmed", "proposed"]);
    confirmStatement(answers, answers.finalNote.statements[1]!.id);
    expect(answers.finalNote.statements.map(item => item.status)).toEqual(["confirmed", "confirmed"]);
  });
  it("shows proposed and confirmed ideas in the summary without changing their status", () => {
    const answers = applyFreeText(emptyOnboardingAnswers(), "final_note", "Nous ouvrons à midi.\nNous avons une terrasse.\nNous sommes fermés dimanche.", "user_text");
    answers.finalNote.statements[0]!.status = "confirmed";
    answers.finalNote.statements[2]!.status = "rejected";
    expect(reviewableStatements(answers).map(item => item.status)).toEqual(["confirmed", "proposed"]);
    expect(answers.finalNote.statements.map(item => item.status)).toEqual(["confirmed", "proposed", "rejected"]);
  });
  it("uses the exact validated prompt and explicit end action", () => {
    expect(onboardingCopy.fr.common.finalNoteTitle).toBe("Avons-nous oublié quelque chose ?");
    expect(onboardingCopy.fr.common.done).toBe("J’ai terminé");
    expect(onboardingCopy.fr.common.composerPlaceholder).toBe("Écrivez ou parlez…");
  });
});
