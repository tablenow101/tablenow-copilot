import { describe, expect, it } from "vitest";
import { emptyOnboardingAnswers } from "./onboarding";
import { allPrioritiesSelected, toggleAllPriorities } from "./priority-selection";
describe("selecting priorities", () => {
  it("preserves an explicitly supplied other need without opting into excluded work", () => {
    const { priorities } = emptyOnboardingAnswers();
    priorities.timeConsumers = ["other", "supplier_orders"];
    priorities.otherText = "Organiser mes événements privés";
    priorities.primaryFocus = "other";
    toggleAllPriorities(priorities);
    expect(priorities.timeConsumers).toContain("other");
    expect(priorities.timeConsumers).not.toContain("supplier_orders");
    expect(priorities.otherText).toBe("Organiser mes événements privés");
    expect(priorities.primaryFocus).toBe("other");
    expect(allPrioritiesSelected(priorities)).toBe(true);
  });
  it("includes collapsed choices without opting into stock or unspecified other work", () => {
    const { priorities } = emptyOnboardingAnswers();
    priorities.timeConsumers = ["reservations"];
    priorities.primaryFocus = "reservations";
    toggleAllPriorities(priorities);
    expect(allPrioritiesSelected(priorities)).toBe(true);
    expect(priorities.timeConsumers).toContain("operations");
    expect(priorities.outcomes).toContain("customer_loyalty");
    expect(priorities.outcomes).not.toContain("stock_control");
    expect(priorities.timeConsumers).not.toContain("other");
    expect(priorities.primaryFocus).toBe("reservations");
    toggleAllPriorities(priorities);
    expect(priorities.timeConsumers).toEqual([]);
    expect(priorities.outcomes).toEqual([]);
    expect(priorities.primaryFocus).toBeUndefined();
  });
});
