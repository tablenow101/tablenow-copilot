import { beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyRequest } from "fastify";

let assertAllowedOrigin: (request: FastifyRequest) => boolean;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgres://tablenow:test@localhost:5432/tablenow_test");
  vi.stubEnv("PUBLIC_ORIGIN", "https://preview-immutable.vercel.app");
  vi.stubEnv("SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("OTP_PEPPER", "p".repeat(48));
  vi.stubEnv("PLATFORM_ADMIN_EMAIL", "founder@tablenow.local");
  vi.stubEnv("EMAIL_TRANSPORT", "log");
  ({ assertAllowedOrigin } = await import("./auth.js"));
});

function request(origin: string, host: string, protocol = "https"): FastifyRequest {
  return {
    method: "POST",
    cookies: { tn_session: "session" },
    headers: {
      origin,
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": protocol,
    },
  } as unknown as FastifyRequest;
}

describe("mutation origin protection", () => {
  it("accepts a same-host Vercel alias", () => {
    expect(assertAllowedOrigin(request("https://preview-alias.vercel.app", "preview-alias.vercel.app"))).toBe(true);
  });

  it("rejects a foreign origin", () => {
    expect(assertAllowedOrigin(request("https://malicious.example", "preview-alias.vercel.app"))).toBe(false);
  });

  it("rejects a forwarded protocol mismatch", () => {
    expect(assertAllowedOrigin(request("http://preview-alias.vercel.app", "preview-alias.vercel.app", "https"))).toBe(false);
  });
});
