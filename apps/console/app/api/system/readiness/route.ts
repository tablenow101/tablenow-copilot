export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Configuration prerequisites only; this endpoint performs no live service probes. */
export function GET(): Response {
  const configured = (name: string): boolean => Boolean(process.env[name]?.trim());
  const database = configured("DATABASE_URL") || configured("POSTGRES_URL");
  const serverSecrets = configured("SESSION_SECRET") && configured("OTP_PEPPER");
  const administrator = configured("PLATFORM_ADMIN_EMAIL");
  const email = process.env.EMAIL_TRANSPORT === "smtp"
    && configured("SMTP_HOST")
    && configured("SMTP_USER")
    && configured("SMTP_PASSWORD")
    && configured("EMAIL_FROM");
  const googleOAuth = configured("GOOGLE_OAUTH_CLIENT_ID") && configured("GOOGLE_OAUTH_CLIENT_SECRET");
  const googlePlaces = configured("GOOGLE_PLACES_API_KEY");
  const storage = configured("BLOB_READ_WRITE_TOKEN");

  // Presence checks are intentionally not aggregated into a readiness verdict.
  // External services and user journeys must be verified separately.
  return Response.json({
    service: "tablenow-copilot",
    environment: process.env.VERCEL_ENV || process.env.APP_ENV || "local",
    verification: "configuration-only",
    runtimeVerified: false,
    checks: { database, serverSecrets, administrator, email, googleOAuth, googlePlaces, storage },
    readyForMigrations: database,
    readyForLogin: database && serverSecrets && administrator && email,
  }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
