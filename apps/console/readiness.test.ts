import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";
import { GET } from "./app/api/system/readiness/route";

const keys = [
  "VERCEL", "VERCEL_ENV", "APP_ENV", "DATABASE_URL", "POSTGRES_URL",
  "SESSION_SECRET", "OTP_PEPPER", "PLATFORM_ADMIN_EMAIL", "EMAIL_TRANSPORT",
  "SMTP_HOST", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN",
] as const;
const original: Record<string, string | undefined> = {};

function configureLogin(): void {
  process.env.DATABASE_URL = "postgres://synthetic.invalid/example";
  process.env.SESSION_SECRET = "synthetic-session-secret";
  process.env.OTP_PEPPER = "synthetic-otp-pepper";
  process.env.PLATFORM_ADMIN_EMAIL = "admin@example.invalid";
  process.env.EMAIL_TRANSPORT = "smtp";
  process.env.SMTP_HOST = "smtp.example.invalid";
  process.env.EMAIL_FROM = "access@example.invalid";
}

beforeEach(() => {
  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("readiness reports explicit configuration, never simulated readiness", () => {
  it("reports no configured services in an empty environment", async () => {
    const result = await GET().json();
    assert.deepEqual(result.checks, {
      database: false, serverSecrets: false, administrator: false, email: false, storage: false,
    });
    assert.equal(result.readyForLogin, false);
    assert.equal(result.readyForMigrations, false);
  });

  it("does not infer services, secrets or an administrator from a Preview and database URL", async () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.DATABASE_URL = "postgres://synthetic.invalid/example";
    const result = await GET().json();
    assert.deepEqual(result.checks, {
      database: true, serverSecrets: false, administrator: false, email: false, storage: false,
    });
    assert.equal(result.readyForLogin, false);
  });

  it("does not treat a log transport as real e-mail even when SMTP fields exist", async () => {
    configureLogin();
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    process.env.EMAIL_TRANSPORT = "log";
    const result = await GET().json();
    assert.equal(result.checks.email, false);
    assert.equal(result.readyForLogin, false);
  });

  it("requires an explicitly selected SMTP transport", async () => {
    configureLogin();
    delete process.env.EMAIL_TRANSPORT;
    assert.equal((await GET().json()).checks.email, false);
  });

  for (const key of ["SMTP_HOST", "EMAIL_FROM"] as const) {
    it(`does not report SMTP configured without ${key}`, async () => {
      configureLogin();
      delete process.env[key];
      const result = await GET().json();
      assert.equal(result.checks.email, false);
      assert.equal(result.readyForLogin, false);
    });
  }

  for (const key of ["SESSION_SECRET", "OTP_PEPPER", "PLATFORM_ADMIN_EMAIL", "DATABASE_URL"] as const) {
    it(`does not report login prerequisites complete without ${key}`, async () => {
      configureLogin();
      delete process.env[key];
      assert.equal((await GET().json()).readyForLogin, false);
    });
  }

  it("reports complete explicit prerequisites without claiming runtime verification", async () => {
    configureLogin();
    const result = await GET().json();
    assert.equal(result.readyForLogin, true);
    assert.equal(result.verification, "configuration-only");
    assert.equal(result.runtimeVerified, false);
  });

  it("accepts the existing POSTGRES_URL configuration alias", async () => {
    process.env.POSTGRES_URL = "postgres://synthetic.invalid/example";
    const result = await GET().json();
    assert.equal(result.checks.database, true);
    assert.equal(result.readyForMigrations, true);
    assert.equal(result.readyForLogin, false);
  });

  it("requires an explicit storage credential in every environment", async () => {
    process.env.VERCEL_ENV = "preview";
    assert.equal((await GET().json()).checks.storage, false);
    process.env.BLOB_READ_WRITE_TOKEN = "synthetic-blob-token";
    assert.equal((await GET().json()).checks.storage, true);
    assert.equal((await GET().json()).runtimeVerified, false);
  });

  it("does not count whitespace as configuration", async () => {
    configureLogin();
    process.env.SESSION_SECRET = "   ";
    process.env.SMTP_HOST = "   ";
    process.env.BLOB_READ_WRITE_TOKEN = "   ";
    const result = await GET().json();
    assert.equal(result.checks.serverSecrets, false);
    assert.equal(result.checks.email, false);
    assert.equal(result.checks.storage, false);
    assert.equal(result.readyForLogin, false);
  });

  it("returns only readiness metadata, never credential values, and disables caching", async () => {
    configureLogin();
    process.env.BLOB_READ_WRITE_TOKEN = "synthetic-blob-token";
    const response = GET();
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    const body = await response.text();
    for (const key of ["DATABASE_URL", "SESSION_SECRET", "OTP_PEPPER", "PLATFORM_ADMIN_EMAIL", "SMTP_HOST", "EMAIL_FROM", "BLOB_READ_WRITE_TOKEN"]) {
      assert.equal(body.includes(process.env[key]!), false, `Must not expose ${key}`);
    }
  });

  it("reports the execution environment without changing the verification level", async () => {
    assert.equal((await GET().json()).environment, "local");
    process.env.APP_ENV = "test";
    assert.equal((await GET().json()).environment, "test");
    process.env.VERCEL_ENV = "production";
    const result = await GET().json();
    assert.equal(result.environment, "production");
    assert.equal(result.runtimeVerified, false);
  });
});
