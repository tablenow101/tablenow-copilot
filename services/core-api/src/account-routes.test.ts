import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { getConfig } from "./environment.js";
import { seal } from "./account-crypto.js";

let app: FastifyInstance, database: Database;
const inbox: string[] = [];
let deliveryFailure = false;
let requestNumber = 1;
const email = "new-owner@tablenow.test", password = "Une longue phrase privée 123";
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
  app = await buildApp({ database, email: { send: async message => { if (deliveryFailure) throw new Error("fixture delivery failure"); inbox.push(message.text); } } });
}, 60000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

async function owner(address: string, protectedAccount = false) {
  const signup = await post("account/signup", { email: address, password });
  const verified = await post("account/verify-email", { code: emailCode() }, authCookie(signup));
  expect(verified.json()).toEqual({ authenticated: true });
  const session = await app.inject({ url: "/v1/auth/session", headers: { cookie: authCookie(verified) } });
  if (protectedAccount) await database`update account_credentials set totp_secret=${seal("historic-factor-fixture", "s".repeat(48))} where user_id=${session.json().user.id}`;
  return { verified, userId: session.json().user.id, tenantId: session.json().tenant.id };
}
const wrongCode = () => emailCode() === "000000" ? "111111" : "000000";

it("confirms signup without a name or extra factor and resumes an email without sending again", async () => {
  expect((await continuation()).statusCode).toBe(204);
  const address = "resume@tablenow.test";
  const signup = await post("account/signup", { email: address, password, rememberMe: false });
  const cookie = authCookie(signup), mailCount = inbox.length;
  expect(await database`select id from users where email=${address}`).toHaveLength(0);
  const first = await continuation(cookie), second = await continuation(cookie);
  expect(first.json()).toMatchObject({ stage: "email", purpose: "signup", email: address });
  expect(second.json().expiresAt).toBe(first.json().expiresAt);
  expect(second.json().expiresInSeconds).toBeLessThanOrEqual(first.json().expiresInSeconds);
  expect(second.cookies).toHaveLength(0);
  expect(first.headers["cache-control"]).toBe("no-store");
  expect(inbox.length).toBe(mailCount);
  const verified = await post("account/verify-email", { code: emailCode() }, cookie);
  expect(verified.json()).toEqual({ authenticated: true });
  expect(verified.cookies.filter(c => ["tn_session", "tn_csrf"].includes(c.name)).every(c => c.maxAge === undefined)).toBe(true);
  expect((await app.inject({ url: "/v1/onboarding", headers: { cookie: authCookie(verified) } })).statusCode).toBe(200);
  expect((await post("account/verify-email", { code: emailCode() }, cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
});
it("preserves password-only login and its existing session when no extra check was configured", async () => {
  const address = "unchanged@tablenow.test";
  const previous = await owner(address), count = inbox.length;
  const login = await post("account/login", { email: address, password, rememberMe: true });
  expect(login.json()).toEqual({ authenticated: true });
  expect(inbox.length).toBe(count);
  expect(login.cookies.filter(c => ["tn_session", "tn_csrf"].includes(c.name)).every(c => c.maxAge === getConfig().SESSION_TTL_HOURS * 3600)).toBe(true);
  expect((await app.inject({ url: "/v1/auth/session", headers: { cookie: authCookie(previous.verified) } })).statusCode).toBe(200);
});
it("requires mailbox proof instead of an app code while keeping old credential data unchanged", async () => {
  const address = "protected@tablenow.test", previous = await owner(address, true);
  const [before] = await database`select password_hash,totp_secret,backup_hashes,last_totp_step from account_credentials where user_id=${previous.userId}`;
  const count = inbox.length;
  expect((await post("account/login", { email: address, password: "wrong" })).statusCode).toBe(400);
  expect(inbox.length).toBe(count);
  const login = await post("account/login", { email: address, password });
  expect(login.statusCode).toBe(202);
  expect(login.json().stage).toBe("email");
  expect(authCookie(login)).not.toContain("tn_session");
  const verified = await post("account/verify-email", { code: emailCode() }, authCookie(login));
  expect(verified.json()).toEqual({ authenticated: true });
  const [after] = await database`select password_hash,totp_secret,backup_hashes,last_totp_step from account_credentials where user_id=${previous.userId}`;
  expect(JSON.stringify(after) === JSON.stringify(before)).toBe(true);
});
it("rejects expired proofs without counting an attempt and denies unrelated origins", async () => {
  const signup = await post("account/signup", { email: "expired@tablenow.test", password });
  await database`update account_challenges set expires_at=now()-interval '1 minute' where email='expired@tablenow.test'`;
  expect((await post("account/verify-email", { code: emailCode() }, authCookie(signup))).statusCode).toBe(410);
  const [row] = await database`select attempts from account_challenges where email='expired@tablenow.test'`;
  expect(row!.attempts).toBe(0);
  expect((await app.inject({ method: "POST", url: "/v1/account/login", payload: { email, password }, headers: { origin: "https://unrelated.example" } })).statusCode).toBe(403);
  expect((await app.inject({ url: "/v1/account/continuation", headers: { "sec-fetch-site": "cross-site" } })).statusCode).toBe(403);
});
it("bounds wrong proofs to five per challenge without locking the victim's account", async () => {
  const address = "victim@tablenow.test", victim = await owner(address, true);
  for (const path of ["signup", "reset", "access"]) {
    const challenge = await post(`account/${path}`, path === "access" ? { email: address } : { email: address, password });
    const cookie = authCookie(challenge), incorrect = wrongCode();
    for (let i = 0; i < 5; i++) expect((await post("account/verify-email", { code: incorrect }, cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    expect((await post("account/verify-email", { code: emailCode() }, cookie)).json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
  }
  const [credentials] = await database`select failed_attempts,locked_until from account_credentials where user_id=${victim.userId}`;
  expect(credentials).toMatchObject({ failed_attempts: 0, locked_until: null });
  const legitimate = await post("account/login", { email: address, password });
  expect(legitimate.statusCode).toBe(202);
  expect((await post("account/verify-email", { code: emailCode() }, authCookie(legitimate))).json()).toEqual({ authenticated: true });
});
it("allows only one concurrent verification and invalidates other pending proofs", async () => {
  const address = "concurrent@tablenow.test";
  await owner(address, true);
  const previous = await post("account/login", { email: address, password });
  const login = await post("account/login", { email: address, password });
  const code = emailCode(), cookie = authCookie(login);
  const results = await Promise.all([post("account/verify-email", { code }, cookie), post("account/verify-email", { code }, cookie)]);
  expect(results.map(r => r.statusCode).sort()).toEqual([200, 400]);
  expect((await continuation(authCookie(previous))).statusCode).toBe(400);
});
it("enforces resend cooldown, invalidates the old code and persists the recipient budget", async () => {
  const address = "budget@tablenow.test";
  const start = await post("account/signup", { email: address, password }), original = emailCode();
  expect((await post("account/resend", {}, authCookie(start))).statusCode).toBe(400);
  await database`update account_challenges set created_at=now()-interval '61 seconds' where email=${address}`;
  const next = await post("account/resend", {}, authCookie(start));
  expect(next.statusCode).toBe(202);
  expect((await post("account/verify-email", { code: original }, authCookie(start))).statusCode).toBe(400);
  for (let i = 0; i < 3; i++) expect((await post("account/signup", { email: address, password })).statusCode).toBe(202);
  expect((await post("account/signup", { email: address, password })).statusCode).toBe(429);
});
it("reports delivery failures, consumes failed challenges and never creates a session", async () => {
  const address = "delivery@tablenow.test";
  await owner(address, true);
  deliveryFailure = true;
  try {
    const login = await post("account/login", { email: address, password });
    expect(login.statusCode).toBe(503);
    expect(login.json().error.code).toBe("ACCOUNT_EMAIL_UNAVAILABLE");
    expect(login.cookies.some(c => c.name === "tn_session")).toBe(false);
    const [row] = await database`select bool_and(consumed_at is not null) as consumed from account_challenges where email=${address}`;
    expect(row!.consumed).toBe(true);
  } finally { deliveryFailure = false; }
});
it("retires pending Authenticator challenges without revealing or accepting their secret", async () => {
  const start = await post("account/signup", { email: "retired@tablenow.test", password });
  await database`update account_challenges set stage='mfa' where email='retired@tablenow.test'`;
  const resumed = await continuation(authCookie(start));
  expect(resumed.statusCode).toBe(410);
  expect(Object.keys(resumed.json())).toEqual(["error"]);
  expect((await post("account/verify-mfa", { code: "123456" }, authCookie(start))).statusCode).toBe(410);
  expect((await app.inject({ url: "/v1/account/google-continuation", headers: { cookie: authCookie(start) } })).statusCode).toBe(410);
});
