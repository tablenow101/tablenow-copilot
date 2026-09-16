import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { getConfig } from "./environment.js";
import { totpAt } from "./account-crypto.js";

let app: FastifyInstance, database: Database;
const inbox: string[] = [];
let requestNumber = 1;
const email = "new-owner@tablenow.test", password = "Une longue phrase privée 123";
let backup: string[], sessionCookie: string, totpSecret: string;
const post = (path: string, payload: Record<string, unknown>, cookie = "") => app.inject({ method: "POST", url: `/v1/${path}`, payload, headers: { cookie, origin: "http://localhost:3000" }, remoteAddress: `127.0.0.${requestNumber++}` });
function authCookie(response: { cookies: { name: string; value: string }[] }) { return response.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; "); }
function emailCode() { return inbox.at(-1)!.match(/\b\d{6}\b/)![0]; }
beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("APP_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgres://test:test@localhost/test");
  vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:3000");
  vi.stubEnv("SESSION_SECRET", "s".repeat(48)); vi.stubEnv("OTP_PEPPER", "p".repeat(48));
  vi.stubEnv("PLATFORM_ADMIN_EMAIL", "admin@tablenow.test");
  vi.stubEnv("EMAIL_TRANSPORT", "smtp"); vi.stubEnv("SMTP_HOST", "test.invalid");
  vi.stubEnv("SMTP_USER", "test-user"); vi.stubEnv("SMTP_PASSWORD", "test-password");
  vi.stubEnv("LOG_LEVEL", "silent");
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async message => { inbox.push(message.text); } } });
}, 60000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });
describe("registration and recurring authentication", () => {
  it("requires email ownership and TOTP before issuing an owner session", async () => {
    expect((await post("account/signup", { email, name: "Owner", password: "short" })).statusCode).toBe(400);
    const signup = await post("account/signup", { email, name: "Owner", password, rememberMe: false });
    expect(signup.statusCode).toBe(202);
    const cookie = authCookie(signup);
    expect(cookie).not.toContain("tn_session");
    expect(await database`select id from users where email=${email}`).toHaveLength(0);
    expect((await post("account/verify-email", { code: "000000" }, cookie)).statusCode).toBe(400);
    const enrollment = await post("account/verify-email", { code: emailCode() }, cookie);
    expect(enrollment.json()).toMatchObject({ stage: "enroll" });
    expect(enrollment.json()).toMatchObject({ expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    expect(enrollment.cookies.find(c => c.name === "tn_auth")?.maxAge).toBe(600);
    totpSecret = enrollment.json().secret;
    expect((await post("account/verify-mfa", { code: "abcdef" }, cookie)).statusCode).toBe(400);
    const verified = await post("account/verify-mfa", { code: totpAt(totpSecret, Math.floor(Date.now()/30000)) }, cookie);
    expect(verified.statusCode, verified.body).toBe(200);
    const transientCookies = verified.cookies.filter(c => ["tn_session", "tn_csrf"].includes(c.name));
    expect(transientCookies).toHaveLength(2);
    expect(transientCookies.every(c => c.maxAge === undefined && c.expires === undefined)).toBe(true);
    expect(transientCookies.find(c => c.name === "tn_session")?.httpOnly).toBe(true);
    backup = verified.json().backupCodes;
    expect(backup).toHaveLength(8);
    sessionCookie = authCookie(verified);
    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: sessionCookie } });
    expect(session.statusCode).toBe(200);
    expect(session.json().tenant.onboardingComplete).toBe(false);
    expect((await app.inject({ method: "GET", url: "/v1/onboarding", headers: { cookie: sessionCookie } })).statusCode).toBe(200);
    expect((await post("account/verify-mfa", { code: backup[0] }, cookie)).statusCode).toBe(400);
  });
  it("does not allow password-only or legacy email-code access; backup codes are single-use", async () => {
    const login = await post("account/login", { email, password, rememberMe: true });
    expect(login.json()).toMatchObject({ stage: "mfa", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    const cookie = authCookie(login);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })).statusCode).toBe(401);
    const [credential] = await database<{ last_totp_step: number }[]>`select last_totp_step from account_credentials`;
    expect((await post("account/verify-mfa", { code: totpAt(totpSecret, Number(credential!.last_totp_step)) }, cookie)).statusCode).toBe(400);
    const remembered = await post("account/verify-mfa", { code: backup[0] }, cookie);
    expect(remembered.statusCode).toBe(200);
    const persistentCookies = remembered.cookies.filter(c => ["tn_session", "tn_csrf"].includes(c.name));
    expect(persistentCookies).toHaveLength(2);
    expect(persistentCookies.every(c => Number(c.maxAge) === getConfig().SESSION_TTL_HOURS * 3600)).toBe(true);
    expect(persistentCookies.find(c => c.name === "tn_session")?.httpOnly).toBe(true);
    // Browser persistence must not extend the server-side lifetime of any session.
    const [sessionBounds] = await database<{ bounded: boolean }[]>`select bool_and(expires_at <= now() + (${getConfig().SESSION_TTL_HOURS} * interval '1 hour')) as bounded from sessions`;
    expect(sessionBounds?.bounded).toBe(true);
    const another = await post("account/login", { email, password });
    expect((await post("account/verify-mfa", { code: backup[0] }, authCookie(another))).statusCode).toBe(400);
    const count = inbox.length;
    await post("auth/request-code", { email });
    expect(inbox).toHaveLength(count);
    expect((await post("auth/verify-code", { email, code: "424242" })).statusCode).toBe(400);
  });
  it("keeps MFA during password recovery and revokes sessions and pending logins", async () => {
    const pending = await post("account/login", { email, password });
    const reset = await post("account/reset", { email, password: "Une nouvelle phrase privée 456" });
    const cookie = authCookie(reset);
    expect((await post("account/verify-email", { code: emailCode() }, cookie)).json()).toMatchObject({ stage: "mfa", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    const completed = await post("account/verify-mfa", { code: backup[1] }, cookie);
    expect(completed.statusCode, completed.body).toBe(200);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: sessionCookie } })).statusCode).toBe(401);
    expect((await post("account/verify-mfa", { code: backup[2] }, authCookie(pending))).statusCode).toBe(400);
    expect((await post("account/login", { email, password })).statusCode).toBe(400);
    expect((await post("account/login", { email, password: "Une nouvelle phrase privée 456" })).statusCode).toBe(200);
  });
  it("refuses expired challenges and unrelated browser origins", async () => {
    const signup = await post("account/signup", { email: "expired@tablenow.test", name: "Expired", password });
    await database`update account_challenges set expires_at=now()-interval '1 minute' where email='expired@tablenow.test'`;
    expect((await post("account/verify-email", { code: emailCode() }, authCookie(signup))).statusCode).toBe(400);

    const login = await post("account/login", { email, password: "Une nouvelle phrase privée 456" });
    const loginCookie = authCookie(login);
    await database`update account_challenges set expires_at=now()-interval '1 minute' where email=${email} and stage='mfa' and consumed_at is null`;
    const expiredMfa = await post("account/verify-mfa", { code: "000000" }, loginCookie);
    expect(expiredMfa.statusCode).toBe(410);
    expect(expiredMfa.json()).toEqual({ error: { code: "ACCOUNT_CHALLENGE_EXPIRED", message: "Cette vérification a expiré. Relancez la connexion pour continuer." } });
    const [expiredChallenge] = await database<{ attempts: number }[]>`select attempts from account_challenges where email=${email} and stage='mfa' and consumed_at is null order by created_at desc limit 1`;
    expect(expiredChallenge?.attempts).toBe(0);

    const response = await app.inject({ method: "POST", url: "/v1/account/login", payload: { email, password }, headers: { origin: "https://unrelated.example" } });
    expect(response.statusCode).toBe(403);
  });
  it("allows a recovery code to win only one simultaneous login", async () => {
    const credentials = { email, password: "Une nouvelle phrase privée 456" };
    const first = await post("account/login", credentials);
    const second = await post("account/login", credentials);
    const replies = await Promise.all([
      post("account/verify-mfa", { code: backup[3] }, authCookie(first)),
      post("account/verify-mfa", { code: backup[3] }, authCookie(second)),
    ]);
    expect(replies.map(r => r.statusCode).sort()).toEqual([200, 400]);
  });
  it("limits recipient mail across different source addresses", async () => {
    const before = inbox.length;
    for (let i = 0; i < 5; i++) {
      expect((await post("account/reset", { email: "budget@tablenow.test", password })).statusCode).toBe(202);
    }
    expect((await post("account/reset", { email: "budget@tablenow.test", password })).statusCode).toBe(429);
    expect(inbox.length - before).toBe(5);
  });
  it("keeps verified email challenges in the recipient budget", async () => {
    const recipient = "verified-budget@tablenow.test";
    const before = inbox.length;
    for (let index = 0; index < 5; index++) {
      const signup = await post("account/signup", { email: recipient, name: "Owner", password });
      expect(signup.statusCode).toBe(202);
      const code = emailCode();
      expect((await post("account/verify-email", { code }, authCookie(signup))).json()).toMatchObject({ stage: "enroll" });
      expect((await post("account/verify-email", { code }, authCookie(signup))).statusCode).toBe(400);
    }
    expect((await post("account/signup", { email: recipient, name: "Owner", password })).statusCode).toBe(429);
    expect(inbox.length - before).toBe(5);
  });
  it("keeps verified recovery challenges in the budget without counting password logins", async () => {
    await database`update account_challenges set created_at=now()-interval '16 minutes' where email=${email}`;
    const before = inbox.length;
    const currentPassword = "Une nouvelle phrase privée 456";
    for (let index = 0; index < 5; index++) {
      expect((await post("account/login", { email, password: currentPassword })).statusCode).toBe(200);
    }
    for (let index = 0; index < 5; index++) {
      const reset = await post("account/reset", { email, password: currentPassword });
      expect(reset.statusCode).toBe(202);
      expect((await post("account/verify-email", { code: emailCode() }, authCookie(reset))).json()).toMatchObject({ stage: "mfa", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    }
    expect((await post("account/reset", { email, password: currentPassword })).statusCode).toBe(429);
    expect(inbox.length - before).toBe(5);
    await database`update account_challenges set created_at=now()-interval '16 minutes' where email=${email}`;
    expect((await post("account/reset", { email, password: currentPassword })).statusCode).toBe(202);
  });
});
