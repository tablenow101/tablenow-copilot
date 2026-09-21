import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { ownerEmail, seedOwnerFixture } from "./testing/owner-fixture.js";
import { readServiceContext } from "./governed-copilot.js";
import type { AuthActor } from "./types.js";

let database: Database, app: FastifyInstance, actor: AuthActor;
let fixture: Awaited<ReturnType<typeof seedOwnerFixture>>;
let headers: Record<string, string>;
const message = "Test de recette du cockpit : prépare un briefing pour notre service.";

beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: "http://localhost:3000", SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "log", AUTH_FIXED_OTP: "424242", LOG_LEVEL: "silent" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  fixture = await seedOwnerFixture(database);
  actor = { tenantId: fixture.tenantId, userId: fixture.userId, actorId: fixture.userId, actorType: "user", role: "owner", email: ownerEmail, displayName: "Test", tenantName: "Test", tenantSlug: "test", onboardingComplete: true, csrfHash: null };
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async () => undefined } });
  await app.inject({ method: "POST", url: "/v1/auth/request-code", payload: { email: ownerEmail } });
  const login = await app.inject({ method: "POST", url: "/v1/auth/verify-code", payload: { email: ownerEmail, code: "424242" } });
  expect(login.statusCode).toBe(200);
  headers = { origin: "http://localhost:3000", cookie: login.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; "), "x-csrf-token": login.cookies.find(cookie => cookie.name === "tn_csrf")!.value };
}, 60000);

afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

async function newRestaurant() {
  const [restaurant] = await database<{ id: string }[]>`insert into restaurants(tenant_id,name,slug,is_demo) values(${fixture.tenantId},'Conversation métier',${randomUUID()},false) returning id`;
  return restaurant!.id;
}
const chat = (restaurantId: string, idempotencyKey = randomUUID()) => app.inject({ method: "POST", url: "/v1/operating/chat", headers, payload: { restaurantId, message, idempotencyKey } });

describe("explicit conversation origin", () => {
  it("keeps new conversations and messages business by default without inferring origin from their words", async () => {
    const restaurantId = await newRestaurant();
    const response = await chat(restaurantId);
    expect(response.statusCode, response.body).toBe(200);
    const id = response.json().runId;
    expect((await database`select data_origin,message from copilot_runs where id=${id}`)[0]).toEqual({ data_origin: "business", message });
    expect((await database`select data_origin from copilot_messages where run_id=${id}`).map(row => row.data_origin)).toEqual(["business", "business"]);
    await expect(database`update copilot_runs set data_origin='guessed' where id=${id}`).rejects.toThrow();
    await expect(database`update copilot_messages set data_origin=null where run_id=${id}`).rejects.toThrow();
  });
  it("hides only explicitly classified history and observations, blocks replay, and retains identical business content", async () => {
    const restaurantId = await newRestaurant(), businessKey = randomUUID(), acceptanceKey = randomUUID();
    const business = await chat(restaurantId, businessKey), acceptance = await chat(restaurantId, acceptanceKey);
    expect(business.statusCode).toBe(200);
    expect(acceptance.statusCode).toBe(200);
    const businessId = business.json().runId, acceptanceId = acceptance.json().runId;
    const observe = (id: string) => app.inject({ method: "POST", url: `/v1/operating/runs/${id}/observations`, headers, payload: { restaurantId, idempotencyKey: randomUUID(), kind: "decision", body: "Le briefing sera relu avant le service." } });
    expect((await observe(businessId)).statusCode).toBe(200);
    expect((await observe(acceptanceId)).statusCode).toBe(200);
    // Verified IDs in this isolated fixture; no inference from any text.
    await database.begin(async tx => {
      await tx`update copilot_runs set data_origin='acceptance_test' where id=${acceptanceId} and tenant_id=${fixture.tenantId} and restaurant_id=${restaurantId} and user_id=${fixture.userId}`;
      await tx`update copilot_messages set data_origin='acceptance_test' where run_id=${acceptanceId} and tenant_id=${fixture.tenantId} and restaurant_id=${restaurantId} and user_id=${fixture.userId}`;
    });
    const storedMessages = await database`select * from copilot_messages where run_id=${acceptanceId} order by id`;
    const storedObservations = await database`select * from copilot_observations where run_id=${acceptanceId} order by id`;
    const history = await app.inject({ method: "GET", url: `/v1/operating/runs?restaurantId=${restaurantId}`, headers });
    expect(history.statusCode).toBe(200);
    expect(history.json().runs.map((run: { id: string }) => run.id)).toEqual([businessId]);
    expect(history.json().runs[0].message).toBe(message);
    expect(history.json().observations.map((item: { runId: string }) => item.runId)).toEqual([businessId]);
    const operating = (await app.inject({ method: "GET", url: "/v1/operating", headers })).json();
    const visibleMessages = operating.chat.filter((entry: { restaurantId: string }) => entry.restaurantId === restaurantId);
    expect(visibleMessages).toHaveLength(2);
    expect(visibleMessages.find((entry: { role: string }) => entry.role === "user").body).toBe(message);
    const context = await readServiceContext(database, actor, restaurantId);
    expect(context.history).toHaveLength(2);
    expect(context.history.find(entry => entry.role === "user")?.body).toBe(message);
    expect((await observe(acceptanceId)).statusCode).toBe(404);
    for (const status of ["succeeded", "failed", "running"]) {
      await database`update copilot_runs set status=${status},lease_until=now()-interval '1 minute' where id=${acceptanceId}`;
      const before = await database`select * from copilot_runs where id=${acceptanceId}`;
      const replay = await chat(restaurantId, acceptanceKey);
      expect(replay.statusCode, replay.body).toBe(404);
      expect(replay.json()).not.toHaveProperty("answer");
      expect(replay.json()).not.toHaveProperty("report");
      expect(await database`select * from copilot_runs where id=${acceptanceId}`).toEqual(before);
    }
    expect(await database`select * from copilot_messages where run_id=${acceptanceId} order by id`).toEqual(storedMessages);
    expect(await database`select * from copilot_observations where run_id=${acceptanceId} order by id`).toEqual(storedObservations);
    const businessReplay = await chat(restaurantId, businessKey);
    expect(businessReplay.statusCode).toBe(200);
    expect(businessReplay.json().runId).toBe(businessId);
    expect(businessReplay.json().answer).toBe(business.json().answer);
    expect((await observe(businessId)).statusCode).toBe(200);
  });

  it("does not finalize or publish messages if a run is classified while the provider is answering", async () => {
    const restaurantId = await newRestaurant(), requestKey = randomUUID();
    let classified: unknown;
    let runId = "";
    const { buildApp } = await import("./app.js");
    const modelApp = await buildApp({ database, email: { send: async () => undefined }, model: { complete: async () => {
      // The provider is outside the DB transaction: reproduce an administrative
      // classification at this exact boundary without any external service.
      const [run] = await database<{ id: string }[]>`update copilot_runs set data_origin='acceptance_test' where request_key=${requestKey} and tenant_id=${fixture.tenantId} and restaurant_id=${restaurantId} and user_id=${fixture.userId} returning id`;
      runId = run!.id;
      classified = await database`select * from copilot_runs where id=${runId}`;
      return { text: "Réponse de recette après classement.", model: "synthetic", inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 };
    } } });
    try {
      const response = await modelApp.inject({ method: "POST", url: "/v1/operating/chat", headers, payload: { restaurantId, message, idempotencyKey: requestKey } });
      expect(response.statusCode, response.body).toBe(409);
      expect(response.json().error.code).toBe("COPILOT_LEASE_EXPIRED");
      expect(response.body).not.toContain("Réponse de recette après classement");
      expect(await database`select * from copilot_runs where id=${runId}`).toEqual(classified);
      expect(await database`select id from copilot_messages where run_id=${runId}`).toHaveLength(0);
      expect((await app.inject({ method: "GET", url: `/v1/operating/runs?restaurantId=${restaurantId}`, headers })).json().runs).toEqual([]);
    } finally { await modelApp.close(); }
  });

  it("preserves pre-migration conversation contents and metadata with business as the default", async () => {
    const prior = await PGlite.create({ extensions: { pgcrypto } });
    try {
      const directory = new URL("../migrations/", import.meta.url);
      for (const name of (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name) && name < "015_").sort()) await prior.exec(await readFile(new URL(name, directory), "utf8"));
      const tenant = (await prior.query<{ id: string }>("insert into tenants(name,slug) values('Migration fixture','copilot-origin-migration') returning id")).rows[0]!;
      const user = (await prior.query<{ id: string }>("insert into users(email,display_name) values('copilot-origin@tablenow.test','Fixture') returning id")).rows[0]!;
      const restaurant = (await prior.query<{ id: string }>("insert into restaurants(tenant_id,name,slug) values($1,'Migration fixture','copilot-origin-migration') returning id", [tenant.id])).rows[0]!;
      const run = (await prior.query<{ id: string }>("insert into copilot_runs(tenant_id,restaurant_id,user_id,request_key,input_hash,message,status,answer,mode) values($1,$2,$3,$4,'synthetic-fingerprint',$5,'succeeded','Réponse sauvegardée','summary') returning *", [tenant.id, restaurant.id, user.id, randomUUID(), message])).rows[0]!;
      const entry = (await prior.query<{ id: string }>("insert into copilot_messages(tenant_id,restaurant_id,user_id,role,body,mode,run_id) values($1,$2,$3,'user',$4,'user',$5) returning *", [tenant.id, restaurant.id, user.id, message, run.id])).rows[0]!;
      await prior.exec(await readFile(new URL("015_copilot_data_origin.sql", directory), "utf8"));
      expect((await prior.query("select * from copilot_runs where id=$1", [run.id])).rows).toEqual([{ ...run, data_origin: "business" }]);
      expect((await prior.query("select * from copilot_messages where id=$1", [entry.id])).rows).toEqual([{ ...entry, data_origin: "business" }]);
    } finally { await prior.close(); }
  });

});
