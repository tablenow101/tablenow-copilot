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

  it("signs an existing owner in when they use the registration screen again", async () => {
    const email = "return-via-signup@tablenow.test";
    const first = await post("account/signup", { email, name: "Existing Owner", rememberMe: true });
    expect((await post("account/verify-email", { code: latestCode(email) }, cookies(first))).statusCode).toBe(200);

    const repeated = await post("account/signup", { email, name: "Existing Owner", rememberMe: true });
    const verified = await post("account/verify-email", { code: latestCode(email) }, cookies(repeated));

    expect(verified.statusCode, verified.body).toBe(200);
    expect(verified.json()).toEqual({ authenticated: true });
    expect(await database`select id from users where email=${email}`).toHaveLength(1);
  });

  it("also accepts an email code for an existing account that still has legacy credentials", async () => {
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
    expect(session.json().user.id).toBe(fixture.userId);
    expect(session.json().tenant.id).toBe(fixture.tenantId);
  });
});
