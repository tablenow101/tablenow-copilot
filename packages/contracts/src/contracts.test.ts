import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { copilotMessageSchema, inventoryCreateSchema, onboardingSchema, privacyRequestSchema, reservationCreateSchema, restaurantCreateSchema, shiftCreateSchema, syncPushSchema, taskCreateSchema } from "./index.js";

describe("public contracts", () => {
  it("requires explicit legal acceptance before onboarding", () => {
    const result = onboardingSchema.safeParse({
      organizationName: "Maison Test",
      restaurantName: "Test Bastille",
      ownerName: "Camille Test",
      roleTitle: "Direction",
      phone: "+33102030405",
      address: "12 rue du Test, Paris",
      timezone: "Europe/Paris",
      serviceGoals: ["capture_demand"],
      demoMode: true,
      acceptTerms: false,
      acceptDpa: true,
    });
    expect(result.success).toBe(false);
  });

  it("limits privacy requests to supported rights", () => {
    expect(privacyRequestSchema.safeParse({ type: "sell_my_data" }).success).toBe(false);
    expect(privacyRequestSchema.safeParse({ type: "restriction", details: "Limiter le traitement." }).success).toBe(true);
  });

  it("caps synchronization batches", () => {
    const event = { id: crypto.randomUUID(), type: "test.event", aggregateType: "reservation", aggregateId: crypto.randomUUID(), occurredAt: new Date().toISOString(), payload: {} };
    expect(syncPushSchema.safeParse({ nodeId: crypto.randomUUID(), events: Array.from({ length: 251 }, () => ({ ...event, id: crypto.randomUUID() })) }).success).toBe(false);
  });

  it("accepts an explicit restaurant for reservations and Copilot requests", () => {
    const restaurantId = crypto.randomUUID();
    expect(reservationCreateSchema.safeParse({ restaurantId, guestName: "Alex", startsAt: new Date().toISOString(), partySize: 2 }).success).toBe(true);
    expect(copilotMessageSchema.safeParse({ restaurantId, message: "Comment se présente le service ?" }).success).toBe(true);
    expect(copilotMessageSchema.safeParse({ restaurantId: "wrong", message: "Comment se présente le service ?" }).success).toBe(false);
  });

  it("supports native, software, calendar and paper restaurant setups", () => {
    const base = { name: "Rivage Lyon", address: "12 rue du Test, Lyon", capacity: 80, isDemo: true };
    expect(restaurantCreateSchema.safeParse({ ...base, operatingSetup: { reservationMode: "paper", providers: [], keepPaperWorkflow: true } }).success).toBe(true);
    expect(restaurantCreateSchema.safeParse({ ...base, operatingSetup: { reservationMode: "software", providers: [] } }).success).toBe(false);
    expect(restaurantCreateSchema.safeParse({ ...base, operatingSetup: { reservationMode: "software", providers: ["zenchef"] } }).success).toBe(true);
  });

  it("requires every manual entry to target one restaurant", () => {
    const restaurantId = crypto.randomUUID();
    expect(taskCreateSchema.safeParse({ restaurantId, title: "Préparer la terrasse" }).success).toBe(true);
    expect(inventoryCreateSchema.safeParse({ restaurantId, name: "Saumon", unit: "kg", quantity: 4, reorderThreshold: 2 }).success).toBe(true);
    expect(taskCreateSchema.safeParse({ title: "Préparer la terrasse" }).success).toBe(false);
    expect(inventoryCreateSchema.safeParse({ name: "Saumon", unit: "kg", quantity: 4, reorderThreshold: 2 }).success).toBe(false);
  });

  it("rejects a shift that ends before it starts", () => {
    const restaurantId = crypto.randomUUID();
    expect(shiftCreateSchema.safeParse({ restaurantId, teamMemberName: "Alex Martin", roleTitle: "Chef de rang", startsAt: "2026-08-30T18:00:00.000Z", endsAt: "2026-08-31T00:00:00.000Z" }).success).toBe(true);
    expect(shiftCreateSchema.safeParse({ restaurantId, teamMemberName: "Alex Martin", roleTitle: "Chef de rang", startsAt: "2026-08-30T18:00:00.000Z", endsAt: "2026-08-30T17:00:00.000Z" }).success).toBe(false);
  });
});
