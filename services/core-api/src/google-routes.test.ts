import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { passwordHash, passwordMatches, seal, unseal, newTotpSecret, totpAt } from "./account-crypto.js";
import {
  googleCallbackConfiguration,
  googleConfiguration,
  googlePreviewOrigin,
  googleProductionOrigin,
  type GoogleExchange,
} from "./google-identity.js";

let app: FastifyInstance, database: Database, n = 1;
const exchange = vi.fn<GoogleExchange>();
const send = vi.fn();
const cookieOf = (r: { cookies: { name: string; value: string }[] }) => r.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; ");
const get = (url: string, cookie = "") => app.inject({ method: "GET", url, headers: { host: "localhost:3000", cookie }, remoteAddress: `127.0.0.${n++}` });
const post = (url: string, payload: Record<string, unknown>, cookie = "") => app.inject({ method: "POST", url, payload, headers: { host: "localhost:3000", origin: "http://localhost:3000", cookie }, remoteAddress: `127.0.0.${n++}` });
async function start(remember = "1", intent = "signup") {
  const r = await get(`/v1/oauth/google/start?remember=${remember}&intent=${intent}`);
  expect(r.statusCode).toBe(302);
  const target = new URL(r.headers.location!);
  expect(target.origin).toBe("https://accounts.google.com");
  expect(target.searchParams.get("scope")).toBe("openid email profile");
  expect(target.searchParams.get("code_challenge_method")).toBe("S256");
  expect(target.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/v1/oauth/google/callback");
  expect(r.cookies[0]).toMatchObject({ name: "tn_google", httpOnly: true, path: "/api/v1/oauth/google", sameSite: "Lax" });
  return { state: target.searchParams.get("state")!, cookie: cookieOf(r) };
}
async function google(sub: string, email: string, remember = "1", destination = "/onboarding", intent = "signup") {
  exchange.mockResolvedValueOnce({ sub, email, name: "Restaurateur", emailAuthoritative: true });
  const s = await start(remember, intent);
  const r = await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie);
  expect(r.headers.location).toBe(`http://localhost:3000${destination}`);
  const cookie = cookieOf(r);
  expect(cookie).toContain("tn_session");
  return { cookie, response: r, session: await get("/v1/auth/session", cookie) };
}
beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: "http://localhost:3000", SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "test.invalid", SMTP_USER: "test", SMTP_PASSWORD: "test", LOG_LEVEL: "silent", GOOGLE_OAUTH_CLIENT_ID: "fixture.apps.googleusercontent.com", GOOGLE_OAUTH_CLIENT_SECRET: "fixture-only" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, googleExchange: exchange, email: { send } });
}, 60000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

describe("Google authentication", () => {
  it("uses only the stable Preview and production domains", () => {
    const credentials = { GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "secret", VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app" };
    const preview = { APP_ENV: "preview", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "product/onboarding-owner", PUBLIC_ORIGIN: googlePreviewOrigin, ...credentials };
    expect(googleConfiguration(preview)?.origin).toBe(googlePreviewOrigin);
    expect(googleConfiguration({ ...preview, PUBLIC_ORIGIN: "https://copilot.tablenow.io" })).toBeNull();
    expect(googleConfiguration({ ...preview, PUBLIC_ORIGIN: "https://app.tablenow.io" })).toBeNull();

    const production = { APP_ENV: "production", VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", PUBLIC_ORIGIN: googleProductionOrigin, ...credentials };
    expect(googleConfiguration(production)?.origin).toBe(googleProductionOrigin);
    expect(googleConfiguration({ ...production, VERCEL_GIT_COMMIT_REF: "product/onboarding-owner" })).toBeNull();
    expect(googleConfiguration({ ...preview, VERCEL_GIT_COMMIT_REF: "other" })).toBeNull();
    expect(googleConfiguration({ ...preview, GOOGLE_OAUTH_CLIENT_SECRET: "" })).toBeNull();
  });
  it("accepts only the configured Preview callback host", () => {
    const config = { clientId: "fixture", clientSecret: "fixture", origin: googlePreviewOrigin };
    expect(googleCallbackConfiguration(config, "preview.tablenow.io")?.origin).toBe(googlePreviewOrigin);
    for (const host of ["os.tablenow.io", "copilot.tablenow.io", "app.tablenow.io", "preview.tablenow.io.attacker.test", "preview.tablenow.io:444", "localhost:3000"]) {
      expect(googleCallbackConfiguration(config, host)).toBeNull();
    }
  });
  it("accepts only the production host for a production callback", () => {
    const config = { clientId: "fixture", clientSecret: "fixture", origin: googleProductionOrigin };
    expect(googleCallbackConfiguration(config, "os.tablenow.io")?.origin).toBe(googleProductionOrigin);
    for (const host of ["preview.tablenow.io", "copilot.tablenow.io", "app.tablenow.io", "os.tablenow.io.attacker.test"]) {
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
    await database`update google_login_attempts set payload=${seal({ ...payload, origin: googlePreviewOrigin }, "s".repeat(48))} where state_hash=${row!.state_hash}`;
    const response = await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie);
    expect(response.headers.location).toBe("http://localhost:3000/login?google=error");
    expect(exchange.mock.calls).toHaveLength(calls);
  });
  it("creates the new Google owner and a transient session without TOTP or recovery codes", async () => {
    const flow = await google("new-sub", "google-new@tablenow.test", "0");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({to:"google-new@tablenow.test",subject:"Bienvenue sur TableNow"}));
    expect(flow.response.cookies.filter(c => c.name === "tn_session" || c.name === "tn_csrf").every(c => c.maxAge === undefined)).toBe(true);
    expect(flow.session.statusCode).toBe(200);
    expect(flow.session.json().tenant.onboardingComplete).toBe(false);
    expect((await get("/v1/onboarding", flow.cookie)).statusCode).toBe(200);
    expect(await database`select subject from google_identities`).toEqual([{ subject: "new-sub" }]);
    expect(await database`select user_id from account_credentials`).toHaveLength(0);
    expect((await get("/v1/account/continuation", flow.cookie)).statusCode).toBe(204);
  });
  it("keeps the existing credentials, membership and completed profile when linking Google", async () => {
    const { seedOwnerFixture } = await import("./testing/owner-fixture.js");
    const fixture = await seedOwnerFixture(database);
    await database`update users set email='existing@tablenow.test' where id=${fixture.userId}`;
    await database.begin(async tx => {
      await tx`select set_config('app.tenant_id',${fixture.tenantId},true)`;
      await tx`insert into onboarding_drafts(tenant_id,restaurant_id,status,completed_at) values (${fixture.tenantId},${fixture.restaurantId},'completed',now())`;
    });
    const hash = await passwordHash("Phrase du propriétaire existant 123");
    const totpSecret = newTotpSecret();
    const sealedTotp = seal(totpSecret, "s".repeat(48));
    await database`insert into account_credentials(user_id,password_hash,totp_secret) values (${fixture.userId},${hash},${sealedTotp})`;
    exchange.mockResolvedValueOnce({ sub: "existing-sub", email: "existing@tablenow.test", name: "Owner", emailAuthoritative: true });
    const attempt = await start();
    const callback = await get(`/v1/oauth/google/callback?state=${attempt.state}&code=fixture`, attempt.cookie);
    expect(callback.headers.location).toBe("http://localhost:3000/login?google=continue");
    expect((await get("/v1/auth/session", cookieOf(callback))).statusCode).toBe(401);
    const mfa = await post("/v1/account/verify-mfa", {code: totpAt(totpSecret, Math.floor(Date.now()/30000))}, cookieOf(callback));
    expect(mfa.statusCode).toBe(200);
    const flow = { session: await get("/v1/auth/session", cookieOf(mfa)) };
    const [credential] = await database<{ password_hash: string; totp_secret: string }[]>`select password_hash,totp_secret from account_credentials where user_id=${fixture.userId}`;
    expect(credential!.password_hash).toBe(hash);
    expect(credential!.totp_secret).toBe(sealedTotp);
    expect(await passwordMatches("Phrase du propriétaire existant 123", credential!.password_hash)).toBe(true);
    const session = flow.session.json();
    expect(session.user.id).toBe(fixture.userId);
    expect(session.tenant.id).toBe(fixture.tenantId);
    expect(session.tenant.onboardingComplete).toBe(true);
    exchange.mockResolvedValueOnce({ sub: "existing-sub", email: "changed-email@tablenow.test", name: "Owner", emailAuthoritative: true });
    const returning = await start("1", "login");
    const again = await get(`/v1/oauth/google/callback?state=${returning.state}&code=fixture`, returning.cookie);
    expect(again.headers.location).toBe("http://localhost:3000/login?google=continue");
    expect((await get("/v1/account/continuation", cookieOf(again))).json().email).toBe("existing@tablenow.test");
    exchange.mockResolvedValueOnce({ sub: "different-sub", email: "existing@tablenow.test", name: "Other", emailAuthoritative: true });
    const s = await start();
    expect((await get(`/v1/oauth/google/callback?state=${s.state}&code=fixture`, s.cookie)).headers.location).toContain("google=error");
  });
});

it("does not create an account from the Google login screen", async () => {
  exchange.mockResolvedValueOnce({sub:"never-create",email:"not-registered@gmail.com",name:"New",emailAuthoritative:true});
  const attempt=await start("1","login");
  const callback=await get(`/v1/oauth/google/callback?state=${attempt.state}&code=fixture`,attempt.cookie);
  expect(callback.headers.location).toBe("http://localhost:3000/login?google=signup-required");
  expect((await get("/v1/auth/session",cookieOf(callback))).statusCode).toBe(401);
  expect(await database`select id from users where email='not-registered@gmail.com'`).toHaveLength(0);
});
it("requires mailbox proof before creating an identity whose email Google does not own", async () => {
  exchange.mockResolvedValueOnce({sub:"external-mail",email:"outside@tablenow.test",name:"External",emailAuthoritative:false});
  const attempt=await start();
  const callback=await get(`/v1/oauth/google/callback?state=${attempt.state}&code=fixture`,attempt.cookie);
  expect(callback.headers.location).toBe("http://localhost:3000/login?google=continue");
  expect((await get("/v1/auth/session",cookieOf(callback))).statusCode).toBe(401);
  expect(await database`select id from users where email='outside@tablenow.test'`).toHaveLength(0);
  const code = send.mock.calls.at(-1)![0].text.match(/\b\d{6}\b/)![0];
  const verified = await post("/v1/account/verify-email",{code},cookieOf(callback));
  expect(verified.json()).toEqual({authenticated:true});
  expect((await get("/v1/auth/session",cookieOf(verified))).json().user.email).toBe("outside@tablenow.test");
});

it("signs a linked Google account in through login without creating a second user", async()=>{
 const returned=await google("new-sub","google-new@tablenow.test","1","/onboarding","login");
 expect(returned.session.json().user.email).toBe("google-new@tablenow.test");
 expect(await database`select id from users where email='google-new@tablenow.test'`).toHaveLength(1);
});

it("returns a readable login error when additional mailbox verification cannot be delivered",async()=>{
 send.mockRejectedValueOnce(new Error("SMTP unavailable"));
 exchange.mockResolvedValueOnce({sub:"failed-mail",email:"failed@tablenow.test",name:"External",emailAuthoritative:false});
 const attempt=await start();
 const callback=await get(`/v1/oauth/google/callback?state=${attempt.state}&code=fixture`,attempt.cookie);
 expect(callback.headers.location).toBe("http://localhost:3000/login?google=email-error");
 expect(await database`select id from users where email='failed@tablenow.test'`).toHaveLength(0);
 expect((await get("/v1/auth/session",cookieOf(callback))).statusCode).toBe(401);
});
