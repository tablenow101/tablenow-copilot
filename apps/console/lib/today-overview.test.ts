import { describe, expect, it } from "vitest";
import { summarizeToday } from "./today-overview";

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
