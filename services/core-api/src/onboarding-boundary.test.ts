import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const repositoryPath = new URL("./repository.ts", import.meta.url);
const appPath = new URL("./app.ts", import.meta.url);

function method(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Unable to isolate ${start}`);
  return source.slice(from, to);
}

describe("onboarding server boundaries", () => {
  it("OB-04, OB-12 and OB-25 never seed demo data, configure a provider or enqueue an external effect", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const completion = method(repository, "public async completeOnboardingDraft", "public async createRestaurant");
    const pilotCreation = method(repository, "public async createPilot", "public async listPilots");
    expect(completion).not.toMatch(/ensureDemoWorkspace|configureReservationSystems|outbox\(|insert into jobs/);
    expect(pilotCreation).not.toContain("ensureDemoWorkspace");
    expect(pilotCreation).toContain("is_demo)");
    expect(pilotCreation).toContain("false)");
  });

  it("OB-16 serializes completion and returns the existing result after a committed retry", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const completion = method(repository, "public async completeOnboardingDraft", "public async createRestaurant");
    const lockedDraft = method(repository, "async function lockedDraft", "function onboardingDraftView");
    expect(lockedDraft).toContain("for update");
    expect(completion).toContain('current.status === "completed" && current.first_result_id');
    expect(completion).toContain("on conflict (tenant_id, restaurant_id, profile_revision)");
    expect(completion).toContain("onboarding_completion_keys");
    expect(completion.indexOf("current.revision !== input.expectedRevision")).toBeLessThan(completion.indexOf('current.status === "completed"'));
  });

  it("OB-14 and OB-20 do not advance a completed profile revision for navigation alone", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const save = method(repository, "public async saveOnboardingDraft", "public async completeOnboardingDraft");
    expect(save).toContain('!answersChanged && current.status === "completed"');
    expect(save.indexOf('!answersChanged && current.status === "completed"')).toBeLessThan(save.indexOf("revision = revision + 1"));
  });

  it("OB-07 records trusted provenance and blocks unconfirmed interpretations on forward navigation", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const save = method(repository, "public async saveOnboardingDraft", "public async completeOnboardingDraft");
    expect(save).toContain("trustedOnboardingProvenance");
    expect(save).toContain("hasUnconfirmedOnboardingProvenance");
    expect(repository).toContain('entry.sourceType === "connected_source" && !trusted');
  });

  it("OB-17 validates authority from the authenticated role and never from the declared job title", async () => {
    const [repository, app] = await Promise.all([readFile(repositoryPath, "utf8"), readFile(appPath, "utf8")]);
    const completion = method(repository, "public async completeOnboardingDraft", "public async createRestaurant");
    expect(completion).toContain("validateOnboardingCompletion(actor.role");
    expect(completion).not.toContain("declaredJobTitle ===");
    expect(app).toContain('ONBOARDING_AUTHORITY_REQUIRED: { status: 403');
  });

  it("OB-18 validates restaurant and approval assignee inside the actor tenant", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const assignee = method(repository, "async function validateApprovalAssignee", "function canCompleteOnboarding");
    expect(repository).toContain("selectTenantRestaurant(restaurants, input.restaurantId)");
    expect(assignee).toContain("tenant_id = ${tenantId} and user_id = ${assigneeId}");
    expect(assignee).toContain("canCompleteOnboarding(membership.role)");
  });

  it("OB-20 invalidates a prior result only when answers actually change", async () => {
    const repository = await readFile(repositoryPath, "utf8");
    const save = method(repository, "public async saveOnboardingDraft", "public async completeOnboardingDraft");
    expect(save).toContain("isDeepStrictEqual(previousAnswers, answers)");
    expect(save).toContain("if (answersChanged && current.first_result_id)");
    expect(save).toContain("case when ${answersChanged} then null else first_result_id end");
  });
});
