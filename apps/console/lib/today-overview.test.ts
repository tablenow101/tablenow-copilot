import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { firstPlanPresentation, summarizeToday, taskAssignmentLabel } from "./today-overview";

describe("résumé opérationnel du jour", () => {
  it("compte seulement les couverts enregistrés du jour du restaurant, hors annulations et absences", () => {
    const data = summarizeToday([
      { startsAt: "2026-09-19T18:00:00Z", partySize: 4, status: "confirmed" },
      { startsAt: "2026-09-19T18:00:00Z", partySize: 2, status: "pending" },
      { startsAt: "2026-09-19T19:00:00Z", partySize: 8, status: "cancelled" },
      { startsAt: "2026-09-19T19:00:00Z", partySize: 3, status: "no_show" },
      { startsAt: "2026-09-19T22:30:00Z", partySize: 9, status: "confirmed" },
    ], [], "Europe/Paris", new Date("2026-09-19T12:00:00Z"));
    expect(data.covers).toBe(6);
    expect(data.reservations).toBe(2);
    expect(data.nextArrival).toBe("2026-09-19T18:00:00Z");
    expect(data.arrivals).toEqual([{ label: "20:00", covers: 6 }]);
  });
  it("ne fabrique ni service, ni progression lorsque les données manquent", () => {
    const data = summarizeToday([], [], "Europe/Paris", new Date("2026-09-19T12:00:00Z"));
    expect(data.covers).toBe(0);
    expect(data.nextArrival).toBeNull();
    expect(data.arrivals).toEqual([]);
    expect(data.preparation).toBeNull();
  });
  it("sépare les couverts terminés et calcule la préparation sur les tâches existantes", () => {
    const data = summarizeToday([
      { startsAt: "2026-09-19T18:00:00Z", partySize: 4, status: "completed" },
      { startsAt: "2026-09-19T19:00:00Z", partySize: 2, status: "seated" },
    ], [{ status: "done", category: "service" }, { status: "in_progress", category: "service" }, { status: "open", category: "supplier" }], "Europe/Paris", new Date("2026-09-19T20:00:00Z"));
    expect(data.completedCovers).toBe(4);
    expect(data.nextArrival).toBeNull();
    expect(data.preparation).toEqual({ done: 1, total: 2 });
  });
});


describe("accueil guidé et libellés métier", () => {
  it("uses the saved priority to choose a concrete next action without changing historical plans", () => {
    const saved = { kind: "team", businessArtifact: { type: "team_briefing" }, recommendations: ["Ouvrir le briefing et l’assigner à une personne réelle avant le service."] };
    const before = JSON.stringify(saved);
    const result = firstPlanPresentation(saved);
    expect(result.href).toBe("/team");
    expect(result.reason).toContain("organiser votre équipe");
    expect(result.summary).not.toContain("personne réelle");
    expect(result.recommendations?.join(" ")).not.toContain("personne réelle");
    expect(JSON.stringify(saved)).toBe(before);
  });
  it.each([
    ["customer_communication", "communication_protocol", "/communications"],
    ["reservations", "reservation_rules", "/service"],
    ["supplier_order", "supplier_order_draft", "/profile#tn-first-plan"],
    ["occupancy", "occupancy_plan", "/service"],
    ["profitability", "measurement_plan", "/profile#tn-first-plan"],
    ["customer_loyalty", "loyalty_protocol", "/communications"],
  ])("keeps %s connected to a real product destination", (kind, type, href) => {
    expect(firstPlanPresentation({ kind, businessArtifact: { type } }).href).toBe(href);
  });
  it("admits every CTA in the actual route handler and keeps the plan anchor rendered", async () => {
    const route = await readFile(new URL("../app/[section]/page.tsx", import.meta.url), "utf8");
    const sections = JSON.parse(route.match(/const sections = (\[[^;]+\]) as const;/)![1]!);
    const shell = await readFile(new URL("../components/OwnerShell.tsx", import.meta.url), "utf8");
    for (const kind of ["team", "customer_communication", "reservations", "supplier_order", "profitability", "occupancy", "customer_loyalty"]) {
      const { href } = firstPlanPresentation({ kind, businessArtifact: {} });
      const url = new URL(href!, "https://preview.tablenow.io");
      expect(sections).toContain(url.pathname.slice(1));
      if (url.hash) expect(shell).toContain(`id="${url.hash.slice(1)}"`);
    }
    expect(sections).not.toContain("inventory");
  });
  it("changes only recognised old wording and preserves custom recommendations in any position", () => {
    const recommendations = [
      "Lou accueille le groupe de douze à 20 h.",
      "Prévoir deux personnes au bar après 21 h.",
      "Aucun nom de salarié ni planning n’a été inventé.",
      "Ouvrir le briefing et l'assigner à une personne réelle avant le service.",
      "Le chef vérifie les allergies avant le briefing.",
    ];
    const result = firstPlanPresentation({ kind: "team", businessArtifact: { type: "team_briefing" }, recommendations });
    expect(result.recommendations).toEqual([
      recommendations[0], recommendations[1],
      "Complétez les personnes et les horaires utiles à votre équipe.",
      "Relisez le briefing et choisissez qui le partagera avec l’équipe avant le service.",
      recommendations[4],
    ]);
    expect(recommendations[2]).toBe("Aucun nom de salarié ni planning n’a été inventé.");
    expect(firstPlanPresentation({ kind: "reservations", businessArtifact: {}, recommendations }).recommendations).toEqual(recommendations);
  });
  it("keeps the briefing as one general recommendation when no profile data exists", () => {
    expect(firstPlanPresentation(undefined)).toMatchObject({ briefing: true, reason: "Conseil métier général, à adapter à votre organisation." });
    expect(firstPlanPresentation({ kind: "global", businessArtifact: { type: "service_preparation" } }).reason).toContain("accompagnement global");
  });
  it("does not describe a completed unassigned task as still to assign or invent its author", () => {
    expect(taskAssignmentLabel({ status: "done", assigneeName: null })).toBe("Terminée · auteur non renseigné");
    expect(taskAssignmentLabel({ status: "done", assigneeName: "Lou" })).toBe("Terminée · attribuée à Lou");
    expect(taskAssignmentLabel({ status: "open", assigneeName: null })).toBe("À attribuer · À faire");
  });
});
