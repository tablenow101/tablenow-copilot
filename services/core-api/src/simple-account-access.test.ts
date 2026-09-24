import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { hashSecret, type Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { newTotpSecret, passwordHash, seal } from "./account-crypto.js";

let app: FastifyInstance;
let database: Database;
let requestNumber = 1;
const inbox: Array<{ to: string; text: string }> = [];

const post = (path: string, payload: Record<string, unknown>, cookie = "") => app.inject({
  method: "POST",
  url: `/v1/${path}`,
  payload,
  headers: { cookie, origin: "http://localhost:3000" },
  remoteAddress: `127.0.1.${requestNumber++}`,
});

function cookies(response: { cookies: { name: string; value: string }[] }) {
  return response.cookies.filter(cookie => cookie.value).map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
}

function latestCode(to: string) {
  const message = inbox.findLast(item => item.to === to);
  const code = message?.text.match(/\b\d{6}\b/)?.[0];
  expect(code).toMatch(/^\d{6}$/);
  return code!;
}

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
    SMTP_HOST: "test.invalid",
    SMTP_USER: "test-user",
    SMTP_PASSWORD: "test-password",
    LOG_LEVEL: "silent",
  })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({
    database,
    email: { send: async message => { inbox.push({ to: message.to, text: message.text }); } },
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
  await database?.end();
  vi.unstubAllEnvs();
});

describe("simple account access", () => {
  it("uses one email entry point and signs an existing owner in after the code", async () => {
    const email = "unified-returning@tablenow.test";
    const signup = await post("account/signup", { email, name: "Unified Returning", rememberMe: true });
    expect((await post("account/verify-email", { code: latestCode(email) }, cookies(signup))).statusCode).toBe(200);

    const access = await post("account/access", { email });
    expect(access.statusCode, access.body).toBe(202);
    expect(access.json()).toMatchObject({ stage: "email", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });

    const verified = await post("account/verify-email", { code: latestCode(email) }, cookies(access));
    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    expect(verified.cookies.find(cookie => cookie.name === "tn_session")?.httpOnly).toBe(true);
  });

  it("creates a new owner only through explicit signup, then reuses it at login", async () => {
    const email = "unified-new@tablenow.test";
    const access = await post("account/signup", { email });
    expect(access.statusCode).toBe(202);
    expect(await database`select id from users where email=${email}`).toHaveLength(0);
    expect((await post("account/complete-profile", {}, cookies(access))).statusCode).toBe(400);
    const code = latestCode(email);
    const verified = await post("account/verify-email", { code }, cookies(access));
    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    expect(verified.cookies.find(cookie => cookie.name === "tn_session")?.httpOnly).toBe(true);
    const [user] = await database<{ id: string; display_name: string | null }[]>`select id,display_name from users where email=${email}`;
    expect(user?.display_name).toBeNull();
    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies(verified) } });
    expect(session.json().tenant.onboardingComplete).toBe(false);
    expect((await post("account/verify-email", { code }, cookies(access))).statusCode).toBe(400);
    const returning = await post("account/access", { email });
    const signedIn = await post("account/verify-email", { code: latestCode(email) }, cookies(returning));
    expect(signedIn.json()).toEqual({ authenticated: true });
    const resumed = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies(signedIn) } });
    expect(resumed.json().user.id).toBe(user!.id);
    expect(resumed.json().tenant.id).toBe(session.json().tenant.id);
    expect(await database`select id from users where email=${email}`).toHaveLength(1);
  });

  it("finishes an already verified legacy profile challenge without asking for a name", async () => {
    const email = "pending-profile@tablenow.test";
    const access = await post("account/access", { email });
    // A challenge advanced by the previously deployed version: email proof already checked.
    await database`update account_challenges set stage='profile',payload=${seal({ purpose: 'access', passwordless: true }, 's'.repeat(48))} where email=${email}`;
    const completed = await post("account/complete-profile", {}, cookies(access));
    expect(completed.statusCode, completed.body).toBe(200);
    expect(completed.json()).toEqual({ authenticated: true });
    expect((await post("account/complete-profile", {}, cookies(access))).statusCode).toBe(400);
  });

  it("creates an owner session after the email code without password, TOTP or recovery codes", async () => {
    const email = "simple-signup@tablenow.test";
    const signup = await post("account/signup", { email, name: "Simple Owner", rememberMe: false });

    expect(signup.statusCode, signup.body).toBe(202);
    expect(signup.json()).toMatchObject({ stage: "email", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    expect(cookies(signup)).not.toContain("tn_session");
    expect(await database`select id from users where email=${email}`).toHaveLength(0);

    const code = latestCode(email);
    const [challenge] = await database<{ proof_hash: string }[]>`select proof_hash from account_challenges where email=${email} order by created_at desc limit 1`;
    expect(challenge?.proof_hash).toBe(hashSecret(code, "s".repeat(48)));
    const verified = await post("account/verify-email", { code }, cookies(signup));

    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    expect(verified.cookies.find(cookie => cookie.name === "tn_session")?.httpOnly).toBe(true);
    expect(verified.cookies.filter(cookie => ["tn_session", "tn_csrf"].includes(cookie.name)).every(cookie => cookie.maxAge === undefined)).toBe(true);
    expect(await database`select c.user_id from account_credentials c join users u on u.id=c.user_id where u.email=${email}`).toHaveLength(0);

    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies(verified) } });
    expect(session.statusCode).toBe(200);
    expect(session.json().user.email).toBe(email);
    expect(session.json().tenant.onboardingComplete).toBe(false);
  });

  it("lets a returning owner request a fresh email code and sign in", async () => {
    const email = "returning-owner@tablenow.test";
    const signup = await post("account/signup", { email, name: "Returning Owner", rememberMe: true });
    const registered = await post("account/verify-email", { code: latestCode(email) }, cookies(signup));
    expect(registered.statusCode, registered.body).toBe(200);

    const login = await post("account/login", { email, rememberMe: true });
    expect(login.statusCode, login.body).toBe(202);
    expect(login.json().stage).toBe("email");
    expect(cookies(login)).not.toContain("tn_session");

    const verified = await post("account/verify-email", { code: latestCode(email) }, cookies(login));
    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    expect(verified.cookies.filter(cookie => ["tn_session", "tn_csrf"].includes(cookie.name)).every(cookie => Number(cookie.maxAge) > 0)).toBe(true);
  });

  it("requires an existing owner to return to login instead of registering twice", async () => {
    const email = "return-via-signup@tablenow.test";
    const first = await post("account/signup", { email, name: "Existing Owner", rememberMe: true });
    expect((await post("account/verify-email", { code: latestCode(email) }, cookies(first))).statusCode).toBe(200);

    const repeated = await post("account/signup", { email, name: "Existing Owner", rememberMe: true });
    const verified = await post("account/verify-email", { code: latestCode(email) }, cookies(repeated));

    expect(verified.statusCode, verified.body).toBe(409);
    expect(verified.json().error.code).toBe("ACCOUNT_EXISTS");
    expect(await database`select id from users where email=${email}`).toHaveLength(1);
  });

  it("uses the proven mailbox instead of the existing TOTP without modifying credentials", async () => {
    const { seedOwnerFixture } = await import("./testing/owner-fixture.js");
    const fixture = await seedOwnerFixture(database);
    const email = "legacy-owner@tablenow.test";
    await database`update users set email=${email} where id=${fixture.userId}`;
    await database`insert into account_credentials(user_id,password_hash,totp_secret) values (${fixture.userId},${await passwordHash("Legacy phrase 123456")},${seal(newTotpSecret(), "s".repeat(48))})`;

    const login = await post("account/login", { email, rememberMe: false });
    expect(login.statusCode, login.body).toBe(202);
    const verified = await post("account/verify-email", { code: latestCode(email) }, cookies(login));

    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies(verified) } });
    expect(session.statusCode).toBe(200);
  });
});
