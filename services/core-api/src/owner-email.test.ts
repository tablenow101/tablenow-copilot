import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { ownerEmail, seedOwnerFixture } from "./testing/owner-fixture.js";

let app: FastifyInstance,
  database: Database,
  restaurantId: string,
  headers: Record<string, string>;
const send = vi.fn(async (_message: { to: string; html: string }) => undefined);
beforeAll(async () => {
  for (const [key, value] of Object.entries({
    NODE_ENV: "test",
    APP_ENV: "test",
    DATABASE_URL: "postgres://test:test@localhost/test",
    PUBLIC_ORIGIN: "http://localhost:3000",
    SESSION_SECRET: "s".repeat(48),
    OTP_PEPPER: "p".repeat(48),
    PLATFORM_ADMIN_EMAIL: "admin@tablenow.test",
    EMAIL_TRANSPORT: "smtp",
    SMTP_HOST: "smtp.example.test",
    SMTP_USER: "test-user",
    SMTP_PASSWORD: "test-password",
    AUTH_FIXED_OTP: "424242",
    LOG_LEVEL: "silent",
  }))
    vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  ({ restaurantId } = await seedOwnerFixture(database));
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send } });
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
    cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    "x-csrf-token": response.cookies.find((c) => c.name === "tn_csrf")!.value,
  };
  send.mockClear();
}, 60000);
afterAll(async () => {
  await app?.close();
  await database?.end();
});

async function draft(body: string) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/communications/drafts",
    headers,
    payload: {
      restaurantId,
      recipient: "guest@example.test",
      subject: "Réservation",
      body,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(response.statusCode).toBe(201);
  return `/v1/communications/drafts/${response.json().id}/send`;
}
describe("email dispatch contract (capturing adapter, no network)", () => {
  it("sends only after approval, escapes HTML and does not resend a sent draft", async () => {
    const url = await draft('Bonjour <script>alert("bad")</script>');
    expect(send).not.toHaveBeenCalled();
    const response = await app.inject({
      method: "POST",
      url,
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "sent", delivered: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].html).toContain("&lt;script&gt;");
    expect(
      (await app.inject({ method: "POST", url, headers, payload: {} }))
        .statusCode,
    ).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("preserves an uncertain send for reconciliation instead of causing a duplicate", async () => {
    const url = await draft("Merci pour votre demande.");
    send.mockClear();
    send.mockRejectedValueOnce(new Error("Timeout after provider acceptance"));
    expect(
      (await app.inject({ method: "POST", url, headers, payload: {} }))
        .statusCode,
    ).toBe(409);
    expect(
      (await app.inject({ method: "POST", url, headers, payload: {} }))
        .statusCode,
    ).toBe(409);
    expect(send).toHaveBeenCalledTimes(1);
    const state = (
      await app.inject({ method: "GET", url: "/v1/operating", headers })
    ).json();
    expect(
      state.outgoing.find((m: { id: string }) => url.includes(m.id)).status,
    ).toBe("queued");
  });
});
