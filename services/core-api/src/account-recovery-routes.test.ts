import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { createTestDatabase } from "./testing/pglite.js";
import { totpAt } from "./account-crypto.js";

let app: FastifyInstance, database: Database, sequence = 1;
const inbox: string[] = [];
const password = "Phrase de recette confidentielle 123";
const cookies = (response: { cookies: { name: string; value: string }[] }) => response.cookies.filter(c => c.value).map(c => `${c.name}=${c.value}`).join("; ");
const csrf = (cookie: string) => cookie.split("; ").find(value => value.startsWith("tn_csrf="))?.slice(8) || "";
const post = (path: string, body: object, cookie = "", headers: Record<string, string> = {}) => app.inject({ method: "POST", url: `/v1/account/${path}`, payload: body, headers: { origin: "http://localhost:3000", cookie, "x-csrf-token": csrf(cookie), ...headers }, remoteAddress: `127.0.0.${sequence++}` });
const recover = (action: string, body: object, cookie = "", headers: Record<string, string> = {}) => post(`backup-codes/${action}`, body, cookie, headers);
async function enrolled() {
  const email = `recovery-${randomUUID()}@tablenow.test`;
  const signup = await post("signup", { email, password, name: "Owner" });
  const challengeCookie = cookies(signup);
  const code = inbox.at(-1)!.match(/\b\d{6}\b/)![0];
  const enrollment = await post("verify-email", { code }, challengeCookie);
  const secret = enrollment.json().secret as string;
  const verification = await post("verify-mfa", { code: totpAt(secret, Math.floor(Date.now() / 30000) - 1) }, challengeCookie);
  expect(verification.statusCode).toBe(200);
  return { email, secret, cookie: cookies(verification), oldBackup: verification.json().backupCodes as string[] };
}

beforeAll(async () => {
  for (const [key, value] of Object.entries({ NODE_ENV: "test", APP_ENV: "test", DATABASE_URL: "postgres://test:test@localhost/test", PUBLIC_ORIGIN: "http://localhost:3000", SESSION_SECRET: "s".repeat(48), OTP_PEPPER: "p".repeat(48), PLATFORM_ADMIN_EMAIL: "admin@tablenow.test", EMAIL_TRANSPORT: "smtp", SMTP_HOST: "test.invalid", SMTP_USER: "fixture", SMTP_PASSWORD: "fixture", LOG_LEVEL: "silent" })) vi.stubEnv(key, value);
  ({ sql: database } = await createTestDatabase());
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email: { send: async message => { inbox.push(message.text); } } });
}, 60000);
afterAll(async () => { await app?.close(); await database?.end(); vi.unstubAllEnvs(); });

describe("secure backup code recovery after a lost response", () => {
  it("requires a user session, CSRF, allowed origin and a fresh TOTP before recovering codes", async () => {
    const operationId = randomUUID();
    expect((await recover("replace", { operationId, code: "123456" })).statusCode).toBe(401);
    const owner = await enrolled();
    expect((await recover("replace", { operationId, code: "123456" }, owner.cookie, { "x-csrf-token": "" })).statusCode).toBe(403);
    expect((await recover("replace", { operationId, code: "123456" }, owner.cookie, { origin: "https://unrelated.example" })).statusCode).toBe(403);
    expect((await recover("replace", { operationId, code: totpAt(owner.secret, Math.floor(Date.now() / 30000) - 1) }, owner.cookie)).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    expect((await recover("read", { operationId }, owner.cookie)).json()).toEqual({ state: "missing" });
    expect((await recover("replace", { operationId, code: owner.oldBackup[0] }, owner.cookie)).statusCode).toBe(400);
    const generated = await recover("replace", { operationId, code: totpAt(owner.secret, Math.floor(Date.now() / 30000)) }, owner.cookie);
    expect(generated.statusCode).toBe(200);
    expect(generated.json().backupCodes).toHaveLength(8);
    expect(generated.headers["cache-control"]).toBe("no-store");
    expect(generated.cookies).toHaveLength(0);
  });

  it("recovers one encrypted batch after a lost response and erases its escrow after acknowledgment", async () => {
    const owner = await enrolled(), operationId = randomUUID();
    const code = totpAt(owner.secret, Math.floor(Date.now() / 30000));
    const first = await recover("replace", { operationId, code }, owner.cookie);
    expect(first.statusCode).toBe(200);
    // The caller can discard the replace response and reconcile before resubmitting.
    const resumed = await recover("read", { operationId }, owner.cookie);
    expect(resumed.json().state).toBe("ready");
    expect(resumed.json().backupCodes).toHaveLength(8);
    const retried = await recover("replace", { operationId, code }, owner.cookie);
    expect(JSON.stringify(retried.json().backupCodes) === JSON.stringify(resumed.json().backupCodes)).toBe(true);
    expect(retried.json().expiresAt).toBe(resumed.json().expiresAt);
    expect(retried.json().expiresInSeconds).toBeLessThanOrEqual(resumed.json().expiresInSeconds);
    const replay = await recover("replace", { operationId: randomUUID(), code }, owner.cookie);
    expect(replay.json().error.code).toBe("ACCOUNT_CODE_INVALID");
    const stored = await database<{ payload: string }[]>`select payload from account_challenges where email=${owner.email} and token_hash like 'backup:%'`;
    expect(stored).toHaveLength(1);
    expect(stored.every(row => resumed.json().backupCodes.every((value: string) => !row.payload.includes(value)))).toBe(true);
    const login = await post("login", { email: owner.email, password });
    expect((await post("verify-mfa", { code: owner.oldBackup[0] }, cookies(login))).json().error.code).toBe("ACCOUNT_CODE_INVALID");
    const otherSession = await post("verify-mfa", { code: resumed.json().backupCodes[0] }, cookies(login));
    expect(otherSession.statusCode).toBe(200);
    expect((await recover("read", { operationId }, cookies(otherSession))).json()).toEqual({ state: "missing" });
    expect((await recover("acknowledge", { operationId }, owner.cookie)).json()).toEqual({ state: "acknowledged" });
    expect((await recover("acknowledge", { operationId }, owner.cookie)).json()).toEqual({ state: "acknowledged" });
    expect((await recover("read", { operationId }, owner.cookie)).json()).toEqual({ state: "acknowledged" });
    expect((await recover("replace", { operationId, code }, owner.cookie)).json()).toEqual({ state: "acknowledged" });
    const [erased] = await database<{ payload: string }[]>`select payload from account_challenges where email=${owner.email} and token_hash like 'backup:%'`;
    expect(erased!.payload).not.toBe(stored[0]!.payload);
  });

  it("expires recovery without renewing the lifetime or rotating codes", async () => {
    const owner = await enrolled(), operationId = randomUUID();
    const code = totpAt(owner.secret, Math.floor(Date.now() / 30000));
    expect((await recover("replace", { operationId, code }, owner.cookie)).statusCode).toBe(200);
    await database`update account_challenges set expires_at=now()-interval '1 second' where email=${owner.email} and token_hash like 'backup:%'`;
    expect((await recover("read", { operationId }, owner.cookie)).statusCode).toBe(410);
    expect((await recover("replace", { operationId, code }, owner.cookie)).statusCode).toBe(410);
    const [count] = await database<{ total: number }[]>`select count(*)::int as total from account_challenges where email=${owner.email} and token_hash like 'backup:%'`;
    expect(count?.total).toBe(1);
  });

  it("keeps account lockout across operation identifiers and rejects revoked sessions", async () => {
    const owner = await enrolled();
    const activeCodes = [-1, 0, 1].map(offset => totpAt(owner.secret, Math.floor(Date.now() / 30000) + offset));
    const wrongCode = ["000000", "111111", "222222", "333333"].find(value => !activeCodes.includes(value))!;
    for (let attempt = 0; attempt < 10; attempt++) {
      const invalid = await recover("replace", { operationId: randomUUID(), code: wrongCode }, owner.cookie);
      expect(invalid.statusCode).toBe(400);
    }
    const locked = await recover("replace", { operationId: randomUUID(), code: totpAt(owner.secret, Math.floor(Date.now() / 30000)) }, owner.cookie);
    expect(locked.json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    await database`delete from sessions where user_id in (select id from users where email=${owner.email})`;
    expect((await recover("read", { operationId: randomUUID() }, owner.cookie)).statusCode).toBe(401);
  });
  it("serializes concurrent rotations and invalidates an older encrypted recovery batch", async () => {
    const owner = await enrolled();
    const operationIds = [randomUUID(), randomUUID()];
    const step = Math.floor(Date.now() / 30000);
    const replies = await Promise.all(operationIds.map(operationId => recover("replace", { operationId, code: totpAt(owner.secret, step) }, owner.cookie)));
    expect(replies.map(reply => reply.statusCode).sort()).toEqual([200, 400]);
    const won = replies.findIndex(reply => reply.statusCode === 200);
    const replaced = await recover("replace", { operationId: randomUUID(), code: totpAt(owner.secret, step + 1) }, owner.cookie);
    expect(replaced.statusCode).toBe(200);
    const stale = await recover("read", { operationId: operationIds[won] }, owner.cookie);
    expect(stale.statusCode).toBe(400);
    expect(stale.json().error.code).toBe("ACCOUNT_CHALLENGE_UNAVAILABLE");
    expect(stale.json().backupCodes).toBeUndefined();
  });

  it("rate limits replacement attempts from one source", async () => {
    const owner = await enrolled();
    for (let attempt = 0; attempt < 6; attempt++) {
      const reply = await app.inject({ method: "POST", url: "/v1/account/backup-codes/replace", payload: { operationId: randomUUID(), code: "invalid" }, headers: { cookie: owner.cookie, origin: "http://localhost:3000", "x-csrf-token": csrf(owner.cookie) }, remoteAddress: "192.0.2.20" });
      expect(reply.statusCode).toBe(attempt < 5 ? 400 : 429);
    }
  });

});
