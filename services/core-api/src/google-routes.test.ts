import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { totpAt, passwordHash, passwordMatches, seal, unseal, newTotpSecret } from "./account-crypto.js";
import { googleConfiguration, googlePreviewOrigin, googleStablePreviewOrigin, googleCallbackConfiguration, type GoogleExchange } from "./google-identity.js";

let app: FastifyInstance, database: Database, n = 1;
const exchange = vi.fn<GoogleExchange>();
const send = vi.fn();
const cookieOf = (r: { cookies: { name: string; value: string }[] }) => r.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; ");
const get = (url: string, cookie = "") => app.inject({ method: "GET", url, headers: { host: "localhost:3000", cookie }, remoteAddress: `127.0.0.${n++}` });
const post = (url: string, payload: Record<string, unknown>, cookie = "") => app.inject({ method: "POST", url, payload, headers: { host: "localhost:3000", origin: "http://localhost:3000", cookie }, remoteAddress: `127.0.0.${n++}` });
async function start(remember = "1") {
  const r = await get(`/v1/oauth/google/start?remember=${remember}`);
  expect(r.statusCode).toBe(302);
  const target = new URL(r.headers.location!);
  expect(target.origin).toBe("https://accounts.google.com");
  expect(target.searchParams.get("scope")).toBe("openid email profile");
  expect(target.searchParams.get("code_challenge_method")).toBe("S256");
  expect(target.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/v1/oauth/google/callback");
  expect(r.cookies[0]).toMatchObject({ name: "tn_google", httpOnly: true, path: "/api/v1/oauth/google", sameSite: "Lax" });
  return { state: target.searchParams.get("state")!, cookie: cookieOf(r) };
}
async function google(sub: string, email: string, remember = "1") {
  exchange.mockResolvedValueOnce({ sub, email, name: "Restaurateur" });
  const s = await start(remember);
  const r = await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie);
  expect(r.headers.location).toBe("http://localhost:3000/login?google=continue");
  const cookie = cookieOf(r);
  expect(cookie).not.toContain("tn_session");
  return { cookie, next: (await get("/v1/account/google-continuation", cookie)).json() };
}
beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: "http://localhost:3000", SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "log", LOG_LEVEL: "silent", GOOGLE_OAUTH_CLIENT_ID: "fixture.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "fixture-only" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, googleExchange: exchange, email: { send } });
}, 60000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

describe("Google Preview authentication", () => {
  it("fails closed outside the approved Preview branch and without complete credentials", () => {
    const env = { APP_ENV: "preview", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "product/stitch-functional-owner", GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret" };
    expect(googleConfiguration(env)?.origin).toBe(googlePreviewOrigin);
    expect(googleConfiguration({ ...env, PUBLIC_ORIGIN: googleStablePreviewOrigin })?.origin).toBe(googleStablePreviewOrigin);
    expect(googleConfiguration({ ...env, PUBLIC_ORIGIN: "https://app.tablenow.io" })?.origin).toBe(googlePreviewOrigin);
    expect(googleConfiguration({ ...env, APP_ENV: "production" })).toBeNull();
    expect(googleConfiguration({ ...env, VERCEL_ENV: "production" })).toBeNull();
    expect(googleConfiguration({ ...env, VERCEL_GIT_COMMIT_REF: "main" })).toBeNull();
    expect(googleConfiguration({ ...env, GOOGLE_OAUTH_CLIENT_SECRET: "" })).toBeNull();
  });
  it("allows only the two approved callback hosts during the domain transition", () => {
    const config = { clientId: "fixture", clientSecret: "fixture", origin: googleStablePreviewOrigin };
    expect(googleCallbackConfiguration(config, "copilot.tablenow.io")?.origin).toBe(googleStablePreviewOrigin);
    expect(googleCallbackConfiguration(config, new URL(googlePreviewOrigin).host)?.origin).toBe(googlePreviewOrigin);
    for (const host of ["app.tablenow.io", "tablenow.io", "copilot.tablenow.io.attacker.test", "copilot.tablenow.io:444", "localhost:3000"]) {
      expect(googleCallbackConfiguration(config, host)).toBeNull();
    }
  });
  it("rejects missing browser binding, forged state, cancellation, expiry and replay before exchanging codes", async () => {
    const s = await start();
    const calls = exchange.mock.calls.length;
    for (const [query, cookie] of [[`state=${s.state}&code=fixture`, ""], [`state=${"x".repeat(43)}&code=fixture`, s.cookie], [`state=${s.state}&error=access_denied`, s.cookie], [`state=${s.state}&code=fixture`, s.cookie]]) {
      expect((await get(`/v1/oauth/google/callback?${query}`, cookie)).headers.location).toBe("http://localhost:3000/login?google=error");
    }
    const expired = await start();
    await database`update google_login_attempts set expires_at=now()-interval '1 second'`;
    expect((await get(`/v1/oauth/google/callback?state=${expired.state}&code=fixture`, expired.cookie)).headers.location).toContain("google=error");
    expect(exchange.mock.calls).toHaveLength(calls);
  });
  it("rejects an attempt returned on an origin different from its sealed redirect", async () => {
    const s = await start();
    const calls = exchange.mock.calls.length;
    const [row] = await database<{ state_hash: string; payload: string }[]>`select state_hash,payload from google_login_attempts order by expires_at desc limit 1`;
    const payload = unseal<Record<string, unknown>>(row!.payload, "s".repeat(48));
    await database`update google_login_attempts set payload=${seal({ ...payload, origin: googleStablePreviewOrigin }, "s".repeat(48))} where state_hash=${row!.state_hash}`;
    const response = await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie);
    expect(response.headers.location).toBe("http://localhost:3000/login?google=error");
    expect(exchange.mock.calls).toHaveLength(calls);
  });
  it("creates no account or session until the new Google owner proves TOTP; respects transient cookies", async () => {
    const flow = await google("new-sub", "google-new@tablenow.test", "0");
    expect(flow.next.stage).toBe("enroll");
    expect(await database`select id from users`).toHaveLength(0);
    const r = await post("/v1/account/verify-mfa", { code: totpAt(flow.next.secret, Math.floor(Date.now()/30000)) }, flow.cookie);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().backupCodes).toHaveLength(8);
    expect(r.cookies.filter(c => c.name === "tn_session" || c.name === "tn_csrf").every(c => c.maxAge === undefined)).toBe(true);
    const session = await get("/v1/auth/session", cookieOf(r));
    expect(session.json().tenant.onboardingComplete).toBe(false);
    expect((await get("/v1/onboarding", cookieOf(r))).statusCode).toBe(200);
    expect(await database`select subject from google_identities`).toEqual([{ subject: "new-sub" }]);
    expect(await database`select password_hash is null as no_password from account_credentials`).toEqual([{ no_password: true }]);
    await post("/v1/auth/request-code", { email: "google-new@tablenow.test" });
    expect(send).not.toHaveBeenCalled();
    expect((await post("/v1/account/login", { email: "google-new@tablenow.test", password: "anything" })).statusCode).toBe(400);
    expect((await post("/v1/account/verify-mfa", { code: r.json().backupCodes[0] }, flow.cookie)).statusCode).toBe(400);
  });
  it("keeps the existing password, TOTP, membership and completed profile when linking Google", async () => {
    const { seedOwnerFixture } = await import("./testing/owner-fixture.js");
    const fixture = await seedOwnerFixture(database);
    await database`update users set email='existing@tablenow.test' where id=${fixture.userId}`;
    await database.begin(async tx => {
      await tx`select set_config('app.tenant_id',${fixture.tenantId},true)`;
      await tx`insert into onboarding_drafts(tenant_id,restaurant_id,status,completed_at) values (${fixture.tenantId},${fixture.restaurantId},'completed',now())`;
    });
    const totp = newTotpSecret();
    const hash = await passwordHash("Phrase du propriétaire existant 123");
    await database`insert into account_credentials(user_id,password_hash,totp_secret) values (${fixture.userId},${hash},${seal(totp,"s".repeat(48))})`;
    const flow = await google("existing-sub", "existing@tablenow.test");
    expect(flow.next.stage).toBe("mfa");
    expect(flow.next.secret).toBeUndefined();
    expect(await database`select subject from google_identities where subject='existing-sub'`).toHaveLength(0);
    const r = await post("/v1/account/verify-mfa", { code: totpAt(totp, Math.floor(Date.now()/30000)) }, flow.cookie);
    expect(r.statusCode, r.body).toBe(200);
    const [credential] = await database<{ password_hash: string; totp_secret: string }[]>`select password_hash,totp_secret from account_credentials where user_id=${fixture.userId}`;
    expect(credential!.password_hash).toBe(hash);
    expect(await passwordMatches("Phrase du propriétaire existant 123", credential!.password_hash)).toBe(true);
    const session = (await get("/v1/auth/session", cookieOf(r))).json();
    expect(session.user.id).toBe(fixture.userId);
    expect(session.tenant.id).toBe(fixture.tenantId);
    expect(session.tenant.onboardingComplete).toBe(true);
    const again = await google("existing-sub", "changed-email@tablenow.test");
    expect(again.next.email).toBe("existing@tablenow.test");
    exchange.mockResolvedValueOnce({ sub: "different-sub", email: "existing@tablenow.test", name: "Other" });
    const s = await start();
    expect((await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie)).headers.location).toContain("google=error");
  });
});
