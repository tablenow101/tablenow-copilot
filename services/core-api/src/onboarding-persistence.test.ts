import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { onboardingLegalVersions, type OnboardingAnswers, type OnboardingSection } from "@tablenow/contracts";
import { withTenant, type Database } from "@tablenow/provider-adapters";
import { PlatformRepository } from "./repository.js";
import { onboardingSectionOrder } from "./onboarding.js";
import { createTestDatabase } from "./testing/pglite.js";
import { ownerEmail, seedOwnerFixture } from "./testing/owner-fixture.js";
import type { AuthActor } from "./types.js";

let database: Database, repository: PlatformRepository, actor: AuthActor;
type Draft = Awaited<ReturnType<PlatformRepository["readOnboardingDraft"]>>;

beforeAll(async () => {
  ({ sql: database } = await createTestDatabase());
  const fixture = await seedOwnerFixture(database, false);
  repository = new PlatformRepository(database);
  actor = {
    tenantId: fixture.tenantId, userId: fixture.userId, actorId: fixture.userId,
    actorType: "user", role: "owner", email: ownerEmail, displayName: "Alex Rivage",
    tenantName: "Maison Rivage", tenantSlug: "maison-rivage-recette", onboardingComplete: false, csrfHash: null,
  };
}, 60000);
afterAll(async () => { await database?.end(); });

async function newProfile(name: string) {
  const restaurant = await withTenant(database, actor.tenantId, async tx => {
    const [created] = await tx<{ id: string }[]>`insert into restaurants (tenant_id,name,slug,timezone,is_demo) values (${actor.tenantId},${name},${randomUUID()},'Europe/Paris',false) returning id`;
    return created!;
  });
  return repository.readOnboardingDraft(actor, restaurant.id);
}

function businessAnswers({ presentationStep: _presentationStep, ...answers }: OnboardingAnswers) {
  return answers;
}

function completeAnswers(draft: Draft): OnboardingAnswers {
  const answers = structuredClone(draft.answers);
  answers.establishment.cityCountry = "Paris, France";
  answers.establishment.identityConfirmed = true;
  answers.interaction.preferredModeConfirmed = true;
  answers.priorities.primaryFocus = "supplier_orders";
  answers.priorities.scope = "targeted";
  answers.priorities.timeConsumers = ["supplier_orders"];
  answers.reservations.methods = ["none"];
  answers.operations.suppliers.intent = "prepare_order";
  answers.operations.suppliers.items = [{ name: "Tomates historiques", quantity: 12, unit: "kg" }];
  answers.operations.team.friction = ["planning"];
  answers.operations.team.stations = ["kitchen"];
  answers.authority.declaredJobTitle = "owner";
  answers.authority.approvalAssigneeUserId = actor.userId!;
  answers.authority.rulesAcknowledged = true;
  return answers;
}

function save(draft: Draft, answers: OnboardingAnswers, currentSection: OnboardingSection) {
  return repository.saveOnboardingDraft(actor, {
    restaurantId: draft.restaurantId, expectedRevision: draft.revision, currentSection, answers, provenance: draft.provenance,
  });
}

async function advanceToReview(draft: Draft, answers: OnboardingAnswers) {
  let current = draft;
  for (const section of onboardingSectionOrder.slice(onboardingSectionOrder.indexOf(current.currentSection) + 1)) {
    current = await save(current, answers, section);
  }
  return current;
}

function complete(draft: Draft) {
  return repository.completeOnboardingDraft(actor, {
    restaurantId: draft.restaurantId, expectedRevision: draft.revision, idempotencyKey: randomUUID(),
    termsVersion: onboardingLegalVersions.terms, dpaVersion: onboardingLegalVersions.dpa,
    acceptTerms: true, acceptDpa: true,
  }, { ipHash: "fixture-ip-hash", userAgent: "persistence-test" });
}

async function firstResult(restaurantId: string) {
  return (await repository.getWorkspace(actor.tenantId)).firstResults.find(result => result.restaurantId === restaurantId);
}

describe("onboarding persistence on real PostgreSQL", () => {
  it("resumes a new profile and persists its presentation step without inventing answers", async () => {
    const initial = await newProfile("Profil neuf");
    expect(initial.status).toBe("draft");
    expect(initial.firstResultId).toBeNull();
    expect(initial.confirmedSections).toEqual([]);
    expect(initial.answers.priorities.primaryFocus).toBeUndefined();
    expect(initial.answers.presentationStep).toBeUndefined();
    const saved = await save(initial, { ...initial.answers, presentationStep: "priorities" }, "priorities");
    const resumed = await repository.readOnboardingDraft(actor, initial.restaurantId);
    expect(resumed.id).toBe(initial.id);
    expect(resumed.revision).toBe(saved.revision);
    expect(resumed.answers.presentationStep).toBe("priorities");
    expect(businessAnswers(resumed.answers)).toEqual(businessAnswers(initial.answers));
    expect(resumed.confirmedSections).toEqual([]);
    expect(await firstResult(initial.restaurantId)).toBeUndefined();
  });

  it("preserves a partial profile and inactive operations when its priority changes", async () => {
    const initial = await newProfile("Profil partiel");
    const historical = completeAnswers(initial);
    let partial = initial;
    for (const section of ["establishment", "interaction", "reservations", "operations"] as const) {
      partial = await save(partial, historical, section);
    }
    const navigation = await save(partial, { ...partial.answers, presentationStep: "systems" }, "reservations");
    const resumed = await repository.readOnboardingDraft(actor, initial.restaurantId);
    expect(resumed.answers.presentationStep).toBe("systems");
    expect(resumed.currentSection).toBe("reservations");
    expect(resumed.confirmedSections).toEqual(partial.confirmedSections);
    expect(businessAnswers(resumed.answers)).toEqual(businessAnswers(partial.answers));
    expect(resumed.status).toBe("draft");
    expect(resumed.firstResultId).toBeNull();

    const teamAnswers = structuredClone(resumed.answers);
    teamAnswers.priorities.primaryFocus = "team";
    teamAnswers.priorities.timeConsumers = ["team"];
    teamAnswers.presentationStep = "priorities";
    const changed = await save(navigation, teamAnswers, "priorities");
    const reviewed = await advanceToReview(changed, teamAnswers);
    const completion = await complete(reviewed);
    const completed = await repository.readOnboardingDraft(actor, initial.restaurantId);
    expect(completed.answers.operations.suppliers).toEqual(historical.operations.suppliers);
    expect(completed.answers.operations.team).toEqual(historical.operations.team);
    expect(completed.firstResultId).toBe(completion.firstResultId);
    const result = await firstResult(initial.restaurantId);
    expect(result).toMatchObject({ id: completion.firstResultId, kind: "team" });
    expect(JSON.stringify(result)).not.toContain("Tomates historiques");
    expect(JSON.stringify(result)).not.toContain("supplier_order_draft");
  });

  it("navigates all presentation steps of a completed profile without invalidating its saved result", async () => {
    const initial = await newProfile("Profil terminé");
    const reviewed = await advanceToReview(initial, completeAnswers(initial));
    await complete(reviewed);
    const completed = await repository.readOnboardingDraft(actor, initial.restaurantId);
    const originalResult = await firstResult(initial.restaurantId);
    expect(completed.status).toBe("completed");
    expect(originalResult).toMatchObject({ id: completed.firstResultId, kind: "supplier_order", status: "ready_for_review" });
    let current = completed;
    const navigation = [
      ["priorities", "priorities"], ["establishment", "establishment"], ["systems", "reservations"],
      ["connections", "reservations"], ["complements", "operations"], ["review", "review"],
    ] as const;
    for (const [presentationStep, currentSection] of navigation) {
      await save(current, { ...current.answers, presentationStep }, currentSection);
      current = await repository.readOnboardingDraft(actor, initial.restaurantId);
      expect(current.answers.presentationStep).toBe(presentationStep);
      expect(current.currentSection).toBe(currentSection);
      expect(current.status).toBe("completed");
      expect(current.revision).toBe(completed.revision);
      expect(current.completedAt).toEqual(completed.completedAt);
      expect(current.firstResultId).toBe(completed.firstResultId);
      expect(current.confirmedSections).toEqual(completed.confirmedSections);
      expect(current.provenance).toEqual(completed.provenance);
      expect(businessAnswers(current.answers)).toEqual(businessAnswers(completed.answers));
    }
    expect(await firstResult(initial.restaurantId)).toEqual(originalResult);
  });
  it("keeps grouped interpretation confirmation explicit without blocking a deferred preference", async () => {
    let current = await newProfile("Préférences reportées");
    const answers = completeAnswers(current);
    current = await save(current, answers, "establishment");
    current = await save(current, answers, "interaction");
    const suggested = [{ fieldPath: "answers.interaction.preferredMode", sourceType: "user_voice" as const, observedAt: new Date().toISOString(), confirmationStatus: "suggested" as const }];
    current = await repository.saveOnboardingDraft(actor, { restaurantId: current.restaurantId, expectedRevision: current.revision, currentSection: "reservations", answers, provenance: suggested });
    expect(current.provenance[0]?.confirmationStatus).toBe("suggested");
    current = await save(current, answers, "operations");
    await expect(repository.saveOnboardingDraft(actor, { restaurantId: current.restaurantId, expectedRevision: current.revision, currentSection: "review", answers, provenance: current.provenance })).rejects.toThrow("ONBOARDING_INCOMPLETE");
    const reloaded = await repository.readOnboardingDraft(actor, current.restaurantId);
    expect(reloaded.currentSection).toBe("operations");
    expect(reloaded.revision).toBe(current.revision);
  });

});
