import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Database, EmailSender } from "@tablenow/provider-adapters";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgres://tablenow:test@localhost:5432/tablenow_test");
  vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:8080");
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("OTP_PEPPER", "p".repeat(48));
  vi.stubEnv("PLATFORM_ADMIN_EMAIL", "founder@tablenow.local");
  vi.stubEnv("EMAIL_TRANSPORT", "log");

  const database = Object.assign(
    () => Promise.resolve([{ ok: 1 }]),
    {
      begin: async <T>(callback: (transaction: Database) => Promise<T>) => callback(database as unknown as Database),
      end: async () => undefined,
    },
  ) as unknown as Database;
  const email: EmailSender = { send: async () => undefined };
  const { buildApp } = await import("./app.js");
  app = await buildApp({ database, email });
});

describe("core API perimeter", () => {
  it("exposes an operational health check", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", service: "core-api" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("does not disclose whether an unknown account exists when input is malformed", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/auth/request-code", payload: { email: "invalid" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_INPUT" } });
  });

  it("protects authenticated endpoints", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/auth/session" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});
