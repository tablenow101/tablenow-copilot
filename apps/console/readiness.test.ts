import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./app/api/system/readiness/route";

afterEach(() => vi.unstubAllEnvs());

describe("configuration report", () => {
  it("checks complete SMTP credentials without claiming runtime success", async () => {
    for (const [key, value] of Object.entries({
      DATABASE_URL: "postgres://configured",
      SESSION_SECRET: "configured",
      OTP_PEPPER: "configured",
      PLATFORM_ADMIN_EMAIL: "configured@example.test",
      EMAIL_TRANSPORT: "smtp",
      SMTP_HOST: "smtp.example.test",
      SMTP_USER: "configured",
      SMTP_PASSWORD: "configured",
      EMAIL_FROM: "TableNow <info@tablenow.io>",
      GOOGLE_OAUTH_CLIENT_ID: "configured",
      GOOGLE_OAUTH_CLIENT_SECRET: "configured",
      GOOGLE_PLACES_API_KEY: "configured",
    })) vi.stubEnv(key, value);
    const report = await GET().json();
    expect(report.runtimeVerified).toBe(false);
    expect(report.checks).toMatchObject({ database: true, serverSecrets: true, administrator: true, email: true, googleOAuth: true, googlePlaces: true });
    expect(report.readyForLogin).toBe(true);
    expect(report.readyForMigrations).toBe(true);
  });

  it("reports incomplete SMTP authentication", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "smtp");
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("EMAIL_FROM", "TableNow <info@tablenow.io>");
    expect((await GET().json()).checks.email).toBe(false);
  });
});
