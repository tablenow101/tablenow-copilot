import { describe, expect, it } from "vitest";
import { addLocalHours, formatRestaurantTime, nextServiceLocal, restaurantLocalToIso } from "./timezone";

describe("restaurant timezone", () => {
  it("stores the same wall-clock time according to each restaurant timezone", () => {
    expect(restaurantLocalToIso("2026-08-30T19:30", "Europe/Paris")).toBe("2026-08-30T17:30:00.000Z");
    expect(restaurantLocalToIso("2026-08-30T19:30", "America/New_York")).toBe("2026-08-30T23:30:00.000Z");
  });

  it("displays an instant in the selected restaurant timezone", () => {
    expect(formatRestaurantTime("2026-08-30T17:30:00.000Z", "Europe/Paris")).toBe("19:30");
    expect(formatRestaurantTime("2026-08-30T17:30:00.000Z", "America/New_York")).toBe("13:30");
  });

  it("moves the next service to tomorrow after the local service time", () => {
    expect(nextServiceLocal("Europe/Paris", new Date("2026-08-30T18:00:00.000Z"))).toBe("2026-08-31T19:30");
    expect(addLocalHours("2026-08-30T19:30", 6)).toBe("2026-08-31T01:30");
  });
});
