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
const continuation = (cookie = "") => app.inject({ method: "GET", url: "/v1/account/continuation", headers: { cookie, origin: "http://localhost:3000" }, remoteAddress: `127.0.0.${requestNumber++}` });
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
  it("resumes the same email and enrollment challenge without sending mail or renewing its lifetime", async () => {
    expect((await continuation()).statusCode).toBe(204);
    expect((await continuation("tn_auth=unknown-challenge")).statusCode).toBe(204);
    const recipient = "resume@tablenow.test";
    const signup = await post("account/signup", { email: recipient, name: "Owner", password, rememberMe: false });
    const cookie = authCookie(signup);
    expect(signup.cookies.find(c => c.name === "tn_auth")?.httpOnly).toBe(true);
    const mailCount = inbox.length;
    const emailResume = await continuation(cookie);
    expect(emailResume.statusCode).toBe(200);
    expect(emailResume.json()).toEqual({ stage: "email", purpose: "signup", email: recipient, rememberMe: false, expiresAt: signup.json().expiresAt, expiresInSeconds: expect.any(Number) });
    expect(emailResume.cookies).toHaveLength(0);
    expect(emailResume.headers["cache-control"]).toBe("no-store");
    const enrollment = await post("account/verify-email", { code: emailCode() }, cookie);
    const firstResume = await continuation(cookie);
    const reload = await continuation(cookie);
    expect(firstResume.json()).toEqual({ stage: "enroll", purpose: "signup", email: recipient, rememberMe: false, expiresAt: enrollment.json().expiresAt, expiresInSeconds: expect.any(Number), secret: enrollment.json().secret });
    expect(reload.json().secret === firstResume.json().secret).toBe(true);
    expect(reload.json().expiresAt).toBe(firstResume.json().expiresAt);
    expect(reload.json().expiresInSeconds).toBeLessThanOrEqual(firstResume.json().expiresInSeconds);
    expect(reload.cookies).toHaveLength(0);
    expect(inbox).toHaveLength(mailCount);
    const verified = await post("account/verify-mfa", { code: totpAt(firstResume.json().secret, Math.floor(Date.now()/30000)) }, cookie);
    expect(verified.statusCode).toBe(200);
    const consumed = await continuation(cookie);
    expect(consumed.statusCode).toBe(400);
    expect(consumed.json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    expect(Object.keys(consumed.json())).toEqual(["error"]);
  });
  it("requires email ownership and TOTP before issuing an owner session", async () => {
    expect((await post("account/signup", { email, name: "Owner", password: "short" })).statusCode).toBe(400);
    const signup = await post("account/signup", { email, name: "Owner", password, rememberMe: false });
    expect(signup.statusCode).toBe(202);
    const cookie = authCookie(signup);
    expect(cookie).not.toContain("tn_session");
    expect(await database`select id from users where email=${email}`).toHaveLength(0);
    expect((await post("account/verify-email", { code: "abcdef" }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    const enrollment = await post("account/verify-email", { code: emailCode() }, cookie);
    expect(enrollment.json()).toMatchObject({ stage: "enroll" });
    expect(enrollment.json()).toMatchObject({ expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    expect(enrollment.cookies.find(c => c.name === "tn_auth")?.maxAge).toBe(600);
    totpSecret = enrollment.json().secret;
    expect((await post("account/verify-mfa", { code: "abcdef" }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
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
    expect((await post("account/verify-mfa", { code: backup[0] }, cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
  });
  it("does not allow password-only or legacy email-code access; backup codes are single-use", async () => {
    const login = await post("account/login", { email, password, rememberMe: true });
    expect(login.json()).toMatchObject({ stage: "mfa", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    const cookie = authCookie(login);
    expect((await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie } })).statusCode).toBe(401);
    const resumed = await continuation(cookie);
    expect(resumed.json()).toEqual({ stage: "mfa", purpose: "login", email, rememberMe: true, expiresAt: login.json().expiresAt, expiresInSeconds: expect.any(Number) });
    expect(resumed.cookies).toHaveLength(0);
    const [credential] = await database<{ last_totp_step: number }[]>`select c.last_totp_step from account_credentials c join users u on u.id=c.user_id where u.email=${email}`;
    expect((await post("account/verify-mfa", { code: totpAt(totpSecret, Number(credential!.last_totp_step)) }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
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
    expect((await continuation(cookie)).json()).toEqual({ stage: "email", purpose: "reset", email, rememberMe: true, expiresAt: reset.json().expiresAt, expiresInSeconds: expect.any(Number) });
    const mfa = await post("account/verify-email", { code: emailCode() }, cookie);
    expect(mfa.json()).toMatchObject({ stage: "mfa", expiresAt: expect.any(String), expiresInSeconds: expect.any(Number) });
    expect((await continuation(cookie)).json()).toEqual({ stage: "mfa", purpose: "reset", email, rememberMe: true, expiresAt: mfa.json().expiresAt, expiresInSeconds: expect.any(Number) });
    expect((await post("account/verify-mfa", { code: "invalid-backup" }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    expect((await post("account/login", { email, password: "Une nouvelle phrase privée 456" })).statusCode).toBe(400);
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
    const expiredEmail = await post("account/verify-email", { code: emailCode() }, authCookie(signup));
    expect(expiredEmail.statusCode).toBe(410);
    expect(expiredEmail.json().error.code).toBe("ACCOUNT_CHALLENGE_EXPIRED");
    expect((await continuation(authCookie(signup))).json().error.code).toBe("ACCOUNT_CHALLENGE_EXPIRED");
    const [emailChallenge] = await database<{ attempts: number }[]>`select attempts from account_challenges where email='expired@tablenow.test'`;
    expect(emailChallenge?.attempts).toBe(0);

    const login = await post("account/login", { email, password: "Une nouvelle phrase privée 456" });
    const loginCookie = authCookie(login);
    await database`update account_challenges set expires_at=now()-interval '1 minute' where email=${email} and stage='mfa' and consumed_at is null`;
    const expiredMfa = await post("account/verify-mfa", { code: "000000" }, loginCookie);
    expect(expiredMfa.statusCode).toBe(410);
    expect(expiredMfa.json()).toEqual({ error: { code: "ACCOUNT_CHALLENGE_EXPIRED", message: "Cette vérification a expiré. Relancez la connexion pour continuer." } });
    const [expiredChallenge] = await database<{ attempts: number }[]>`select attempts from account_challenges where email=${email} and stage='mfa' and consumed_at is null order by created_at desc limit 1`;
    expect(expiredChallenge?.attempts).toBe(0);
    const resumed = await continuation(loginCookie);
    expect(resumed.statusCode).toBe(410);
    expect(Object.keys(resumed.json())).toEqual(["error"]);
    const crossSite = await app.inject({ method: "GET", url: "/v1/account/continuation", headers: { cookie: loginCookie, "sec-fetch-site": "cross-site" } });
    expect(crossSite.statusCode).toBe(403);

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
  it("keeps the five-attempt limits and distinguishes unavailable challenges from incorrect codes", async () => {
    const recipient = "attempt-limits@tablenow.test";
    const signup = await post("account/signup", { email: recipient, name: "Owner", password });
    const cookie = authCookie(signup);
    for (let i = 0; i < 5; i++) {
      expect((await post("account/verify-email", { code: "abcdef" }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    }
    expect((await continuation(cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    expect((await post("account/verify-email", { code: emailCode() }, cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    const [emailAttempts] = await database<{ attempts: number }[]>`select attempts from account_challenges where email=${recipient}`;
    expect(emailAttempts?.attempts).toBe(5);
    const login = await post("account/login", { email, password: "Une nouvelle phrase privée 456" });
    const loginCookie = authCookie(login);
    for (let i = 0; i < 5; i++) {
      expect((await post("account/verify-mfa", { code: "invalid-backup" }, loginCookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    }
    expect((await continuation(loginCookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    expect((await post("account/verify-mfa", { code: backup[4] }, loginCookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    for (const route of ["account/verify-email", "account/verify-mfa"]) {
      expect((await post(route, { code: "123456" })).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
      expect((await post(route, { code: "123456" }, "tn_auth=unknown-challenge")).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    }
    // A new challenge still accepts an unused backup code; reading did not consume it.
    const retry = await post("account/login", { email, password: "Une nouvelle phrase privée 456" });
    expect((await continuation(authCookie(retry))).json().stage).toBe("mfa");
    expect((await post("account/verify-mfa", { code: backup[4] }, authCookie(retry))).statusCode).toBe(200);
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
