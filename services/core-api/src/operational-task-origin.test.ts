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

let database: Database, app: FastifyInstance;
let fixture: Awaited<ReturnType<typeof seedOwnerFixture>>;
let headers: Record<string, string>;
let restaurantId: string;
const title = "Recette — test du nouveau menu";

beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: "http://localhost:3000", SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "log", AUTH_FIXED_OTP: "424242", LOG_LEVEL: "silent" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  fixture = await seedOwnerFixture(database);
  const [restaurant] = await database<{ id: string }[]>`insert into restaurants(tenant_id,name,slug,is_demo) values(${fixture.tenantId},'Restaurant métier','task-origin',false) returning id`;
  restaurantId = restaurant!.id;
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async () => undefined } });
  await app.inject({ method: "POST", url: "/v1/auth/request-code", payload: { email: ownerEmail } });
  const login = await app.inject({ method: "POST", url: "/v1/auth/verify-code", payload: { email: ownerEmail, code: "424242" } });
  expect(login.statusCode).toBe(200);
  headers = { origin: "http://localhost:3000", cookie: login.cookies.map(cookie => `${cookie.name}=${cookie.value}`).join("; "), "x-csrf-token": login.cookies.find(cookie => cookie.name === "tn_csrf")!.value };
}, 60000);

afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

const createTask = () => app.inject({ method: "POST", url: "/v1/tasks", headers, payload: { restaurantId, title, category: "service" } });

describe("explicit operational task origin", () => {
  it("defaults normal API writes to business regardless of their title and rejects unknown origins", async () => {
    const response = await createTask();
    expect(response.statusCode, response.body).toBe(201);
    const [saved] = await database`select data_origin,title from operational_tasks where id=${response.json().id}`;
    expect(saved).toEqual({ data_origin: "business", title });
    await expect(database`update operational_tasks set data_origin='title_guess' where id=${response.json().id}`).rejects.toThrow();
    await expect(database`update operational_tasks set data_origin=null where id=${response.json().id}`).rejects.toThrow();
  });
  it("excludes explicitly marked tasks from workspace, counts, service context and mutations while retaining an identical business title", async () => {
    const initial = (await app.inject({ method: "GET", url: "/v1/workspace", headers })).json();
    const business = await createTask();
    const acceptance = await createTask();
    expect(business.statusCode).toBe(201);
    expect(acceptance.statusCode).toBe(201);
    const businessId = business.json().id, acceptanceId = acceptance.json().id;
    // Explicit IDs in this isolated fixture only: no classification by title.
    await database`update operational_tasks set data_origin='acceptance_test' where id=${acceptanceId} and tenant_id=${fixture.tenantId} and restaurant_id=${restaurantId}`;
    const workspace = (await app.inject({ method: "GET", url: "/v1/workspace", headers })).json();
    expect(workspace.tasks).toHaveLength(initial.tasks.length + 1);
    expect(workspace.tasks).toContainEqual(expect.objectContaining({ id: businessId, title }));
    expect(workspace.tasks.some((task: { id: string }) => task.id === acceptanceId)).toBe(false);
    const actor: AuthActor = { tenantId: fixture.tenantId, userId: fixture.userId, actorId: fixture.userId, actorType: "user", role: "owner", email: ownerEmail, displayName: "Test", tenantName: "Test", tenantSlug: "test", onboardingComplete: true, csrfHash: null };
    const context = await readServiceContext(database, actor, restaurantId);
    expect(context.tasks).toContainEqual(expect.objectContaining({ id: businessId, title }));
    expect(context.tasks.some(task => task.id === acceptanceId)).toBe(false);
    const denied = await app.inject({ method: "PATCH", url: `/v1/tasks/${acceptanceId}`, headers, payload: { status: "done" } });
    expect(denied.statusCode, denied.body).toBe(404);
    expect((await database`select status from operational_tasks where id=${acceptanceId}`)[0]!.status).toBe("open");
    expect(await database`select id from audit_events where resource_id=${acceptanceId} and action='operation.updated'`).toHaveLength(0);
    const updated = await app.inject({ method: "PATCH", url: `/v1/tasks/${businessId}`, headers, payload: { status: "done" } });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({ id: businessId, status: "done" });
  });

  it("adds the origin without rewriting pre-existing tasks or encrypted documents", async () => {
    const prior = await PGlite.create({ extensions: { pgcrypto } });
    try {
      const directory = new URL("../migrations/", import.meta.url);
      for (const name of (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name) && name < "014_").sort()) {
        await prior.exec(await readFile(new URL(name, directory), "utf8"));
      }
      const tenant = (await prior.query<{ id: string }>("insert into tenants(name,slug) values('Migration fixture','origin-migration') returning id")).rows[0]!;
      const user = (await prior.query<{ id: string }>("insert into users(email,display_name) values('origin-migration@tablenow.test','Fixture') returning id")).rows[0]!;
      const restaurant = (await prior.query<{ id: string }>("insert into restaurants(tenant_id,name,slug) values($1,'Migration fixture','origin-migration') returning id", [tenant.id])).rows[0]!;
      const task = (await prior.query<{ id: string }>("insert into operational_tasks(tenant_id,restaurant_id,title,category,status) values($1,$2,$3,'service','in_progress') returning *", [tenant.id, restaurant.id, title])).rows[0]!;
      const attachment = (await prior.query<{ id: string }>("insert into onboarding_attachments(tenant_id,user_id,name,mime_type,byte_size,encrypted_content) values($1,$2,'document-recette.txt','text/plain',10,'synthetic-encrypted-content') returning *", [tenant.id, user.id])).rows[0]!;
      await prior.exec(await readFile(new URL("014_acceptance_data_origin.sql", directory), "utf8"));
      expect((await prior.query("select * from operational_tasks where id=$1", [task.id])).rows).toEqual([{ ...task, data_origin: "business" }]);
      expect((await prior.query("select * from onboarding_attachments where id=$1", [attachment.id])).rows).toEqual([{ ...attachment, data_origin: "business" }]);
    } finally { await prior.close(); }
  });

});
