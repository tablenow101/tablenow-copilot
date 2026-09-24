import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";

let app: FastifyInstance;
let database: Database;
const inbox: string[] = [];
const origin = "http://localhost:3000";
const password = "Local recipe passphrase only!";
const email = "onboarding-session@tablenow.test";
const cookies = (response: { cookies: { name: string; value: string }[] }) => response.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; ");
beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: origin, SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "test.invalid", SMTP_USER: "test", SMTP_PASSWORD: "test", LOG_LEVEL: "silent" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async message => { inbox.push(message.text); } } });
}, 60_000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

it("revokes the session, retains the exact draft, and resumes without an extra OTP or browser storage", async () => {
  const signup = await app.inject({ method: "POST", url: "/v1/account/signup", payload: { email, password }, headers: { origin } });
  const verification = await app.inject({ method: "POST", url: "/v1/account/verify-email", payload: { code: inbox.at(-1)!.match(/\b\d{6}\b/)![0] }, headers: { origin, cookie: cookies(signup) } });
  expect(verification.statusCode).toBe(200);
  let cookie = cookies(verification);
  const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } });
  expect(session.statusCode).toBe(200);
  const csrf = verification.cookies.find(c => c.name === "tn_csrf")!.value;
  let draft = (await app.inject({ method: "GET", url: "/v1/onboarding", headers: { cookie } })).json();
  const answers = { ...draft.answers, presentationStep: "priorities", conversationDraft: "Question à terminer, sans envoi", priorities: { ...draft.answers.priorities, scope: "targeted", primaryFocus: "team", timeConsumers: ["team"], otherText: "Mon texte en cours" } };
  const save = await app.inject({ method: "PATCH", url: "/v1/onboarding", headers: { cookie, origin, "x-csrf-token": csrf }, payload: { restaurantId: draft.restaurantId, expectedRevision: draft.revision, currentSection: "priorities", answers, provenance: draft.provenance } });
  expect(save.statusCode, save.body).toBe(200);
  draft = save.json();
  const logout = await app.inject({ method: "POST", url: "/v1/auth/logout", headers: { cookie, origin, "x-csrf-token": csrf } });
  expect(logout.statusCode).toBe(200);
  expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })).statusCode).toBe(401);
  expect((await app.inject({ method: "GET", url: "/v1/onboarding", headers: { cookie } })).statusCode).toBe(401);
  const sent = inbox.length;
  const login = await app.inject({ method: "POST", url: "/v1/account/login", payload: { email, password }, headers: { origin } });
  expect(login.statusCode).toBe(200);
  expect(inbox.length).toBe(sent);
  cookie = cookies(login);
  const resumed = (await app.inject({ method: "GET", url: "/v1/onboarding", headers: { cookie } })).json();
  expect(resumed).toMatchObject({ id: draft.id, revision: draft.revision, currentSection: "priorities", status: "draft", answers });
});
