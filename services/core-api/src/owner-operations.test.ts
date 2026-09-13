import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { ownerEmail, seedOwnerFixture } from "./testing/owner-fixture.js";
let app: FastifyInstance, database: Database;
let fixture: Awaited<ReturnType<typeof seedOwnerFixture>>;
let headers: Record<string, string>;
beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost/test");
  vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:3000");
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("OTP_PEPPER", "p".repeat(48));
  vi.stubEnv("PLATFORM_ADMIN_EMAIL", "admin@tablenow.test");
  vi.stubEnv("EMAIL_TRANSPORT", "log");
  vi.stubEnv("AUTH_FIXED_OTP", "424242");
  vi.stubEnv("LOG_LEVEL", "silent");
  ({ sql: database } = await createTestDatabase());
  fixture = await seedOwnerFixture(database);
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async () => undefined } });
  await app.inject({
    method: "POST",
    url: "/v1/auth/request-code",
    payload: { email: ownerEmail },
  });
  const response = await app.inject({
    method: "POST",
    url: "/v1/auth/verify-code",
    payload: { email: ownerEmail, code: "424242" },
  });
  expect(response.statusCode).toBe(200);
  headers = {
    origin: "http://localhost:3000",
    cookie: response.cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; "),
    "x-csrf-token": response.cookies.find(
      (cookie) => cookie.name === "tn_csrf",
    )!.value,
  };
}, 60000);
afterAll(async () => {
  await app?.close();
  await database?.end();
});
describe("owner workflows on embedded PostgreSQL", () => {
  it("stores private onboarding documents and enforces permissions and file boundaries", async () => {
    const payload = { name: "informations.txt", mimeType: "text/plain", base64: Buffer.from("Informations du restaurant").toString("base64") };
    expect((await app.inject({ method: "POST", url: "/v1/onboarding-attachments", payload })).statusCode).toBe(401);
    const uploaded = await app.inject({ method: "POST", url: "/v1/onboarding-attachments", headers, payload });
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    const id = uploaded.json().id;
    const [stored] = await database<{ encrypted_content: string }[]>`select encrypted_content from onboarding_attachments where id=${id}`;
    expect(stored!.encrypted_content).not.toContain(payload.base64);
    const downloaded = await app.inject({ method: "GET", url: `/v1/onboarding-attachments/${id}`, headers });
    expect(downloaded.body).toBe("Informations du restaurant");
    expect(downloaded.headers["content-disposition"]).toContain("attachment");
    expect((await app.inject({ method: "POST", url: "/v1/onboarding-attachments", headers, payload: { ...payload, mimeType: "image/png" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/v1/onboarding-attachments", headers, payload: { ...payload, name: "../private.txt" } })).statusCode).toBe(422);
    await database`update memberships set role='viewer' where user_id=${fixture.userId} and tenant_id=${fixture.tenantId}`;
    try { expect((await app.inject({ method: "GET", url: `/v1/onboarding-attachments/${id}`, headers })).statusCode).toBe(403); }
    finally { await database`update memberships set role='owner' where user_id=${fixture.userId} and tenant_id=${fixture.tenantId}`; }
    expect((await app.inject({ method: "DELETE", url: `/v1/onboarding-attachments/${id}`, headers })).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: `/v1/onboarding-attachments/${id}`, headers })).statusCode).toBe(404);
  });
  it("protects every new mutation and read with an authenticated session", async () => {
    for (const url of ["/v1/operating", "/v1/workspace"])
      expect((await app.inject({ method: "GET", url })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/dining/tables",
          payload: {},
        })
      ).statusCode,
    ).toBe(401);
  });
  it("never lists, downloads or deletes another tenant's onboarding document", async () => {
    const [tenant] = await database<{ id: string }[]>`insert into tenants(name,slug) values ('Autre restaurant','document-isolation') returning id`;
    const [file] = await database<{ id: string }[]>`insert into onboarding_attachments(tenant_id,user_id,name,mime_type,byte_size,encrypted_content) values (${tenant!.id},${fixture.userId},'confidentiel.txt','text/plain',1,'opaque-test-value') returning id`;
    try {
      const list = await app.inject({ method: "GET", url: "/v1/onboarding-attachments", headers });
      expect(list.statusCode).toBe(200);
      expect(list.json().files.some((item: { id: string }) => item.id === file!.id)).toBe(false);
      expect((await app.inject({ method: "GET", url: `/v1/onboarding-attachments/${file!.id}`, headers })).statusCode).toBe(404);
      expect((await app.inject({ method: "DELETE", url: `/v1/onboarding-attachments/${file!.id}`, headers })).statusCode).toBe(204);
      expect(await database`select id from onboarding_attachments where id=${file!.id}`).toHaveLength(1);
    } finally {
      await database`delete from tenants where id=${tenant!.id}`;
    }
  });
  it("rejects document uploads without CSRF and malformed or oversized content", async () => {
    const payload = { name: "note.txt", mimeType: "text/plain", base64: Buffer.from("Note").toString("base64") };
    expect((await app.inject({ method: "POST", url: "/v1/onboarding-attachments", headers: { cookie: headers.cookie! }, payload })).statusCode).toBe(403);
    for (const base64 of ["AA==", "Zh==", Buffer.alloc(2000001, 65).toString("base64")]) {
      expect((await app.inject({ method: "POST", url: "/v1/onboarding-attachments", headers, payload: { ...payload, base64 } })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: "GET", url: "/v1/onboarding-attachments/not-a-uuid", headers })).statusCode).toBe(422);
  });
  it("loads actual workspace and operating tables", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/operating",
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().tables).toHaveLength(12);
    expect(response.json().capabilities.email).toBe(false);
    expect(
      (await app.inject({ method: "GET", url: "/v1/workspace", headers }))
        .statusCode,
    ).toBe(200);
  });
  it("rejects mutations with missing CSRF or an unrelated origin", async () => {
    const payload = {
      restaurantId: fixture.restaurantId,
      name: "Blocked",
      area: "Salle",
      capacity: 2,
      status: "available",
    };
    const { "x-csrf-token": _csrf, ...withoutCsrf } = headers;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/dining/tables",
          headers: withoutCsrf,
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/dining/tables",
          headers: { ...headers, origin: "https://unrelated.example" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
  });
  it("does not elevate a read-only member to owner mutation permissions", async () => {
    await database`update memberships set role = 'viewer' where tenant_id = ${fixture.tenantId} and user_id = ${fixture.userId}`;
    try {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/v1/dining/tables",
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await database`update memberships set role = 'owner' where tenant_id = ${fixture.tenantId} and user_id = ${fixture.userId}`;
    }
  });
  it("saves a table, enforces revision conflicts, and refuses cross-restaurant access", async () => {
    const body = {
      restaurantId: fixture.restaurantId,
      name: "Terrasse 1",
      area: "Terrasse",
      capacity: 4,
      status: "available",
    };
    const created = await app.inject({
      method: "POST",
      url: "/v1/dining/tables",
      headers,
      payload: body,
    });
    expect(created.statusCode).toBe(201);
    const url = `/v1/dining/tables/${created.json().id}`;
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          headers,
          payload: { ...body, status: "occupied", expectedRevision: 1 },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url,
          headers,
          payload: { ...body, expectedRevision: 1 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/dining/tables",
          headers,
          payload: {
            ...body,
            restaurantId: "00000000-0000-4000-8000-000000000001",
          },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("saves one draft after an idempotent retry and never sends through the log transport", async () => {
    const payload = {
      restaurantId: fixture.restaurantId,
      recipient: "guest@example.test",
      subject: "Votre réservation",
      body: "Merci pour votre demande.",
      idempotencyKey: crypto.randomUUID(),
    };
    const first = await app.inject({
      method: "POST",
      url: "/v1/communications/drafts",
      headers,
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await app.inject({
      method: "POST",
      url: "/v1/communications/drafts",
      headers,
      payload,
    });
    expect(second.json().id).toBe(first.json().id);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/communications/drafts",
          headers,
          payload: { ...payload, subject: "Different request" },
        })
      ).statusCode,
    ).toBe(409);
    const sent = await app.inject({
      method: "POST",
      url: `/v1/communications/drafts/${first.json().id}/send`,
      headers,
      payload: {},
    });
    expect(sent.statusCode).toBe(503);
    const state = (
      await app.inject({ method: "GET", url: "/v1/operating", headers })
    ).json();
    expect(state.outgoing[0].status).toBe("draft");
  });
  it("persists both conversation turns and declares the non-AI summary mode", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/operating/chat",
      headers,
      payload: {
        restaurantId: fixture.restaurantId,
        message: "Préparons le service",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().mode).toBe("summary");
    const state = (
      await app.inject({ method: "GET", url: "/v1/operating", headers })
    ).json();
    expect(state.chat.map((m: { role: string }) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
  });
  it("commits bad OTP attempts so the counter survives rollback boundaries", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/auth/request-code",
      payload: { email: ownerEmail },
    });
    await app.inject({
      method: "POST",
      url: "/v1/auth/verify-code",
      payload: { email: ownerEmail, code: "000000" },
    });
    const [row] = await database<
      { attempts: number }[]
    >`select attempts from otp_challenges where email = ${ownerEmail} and consumed_at is null order by created_at desc limit 1`;
    expect(row!.attempts).toBe(1);
  });
});
