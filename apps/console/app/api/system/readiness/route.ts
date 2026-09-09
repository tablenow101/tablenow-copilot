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
    && configured("EMAIL_FROM");
  const storage = configured("BLOB_READ_WRITE_TOKEN");

  // A Preview label or a log transport never proves a usable external service.
  // The readyFor* flags describe explicit prerequisites, not successful delivery,
  // a live database connection, or end-to-end product certification.
  return Response.json({
    service: "tablenow-copilot",
    environment: process.env.VERCEL_ENV || process.env.APP_ENV || "local",
    verification: "configuration-only",
    runtimeVerified: false,
    checks: { database, serverSecrets, administrator, email, storage },
    readyForMigrations: database,
    readyForLogin: database && serverSecrets && administrator && email,
  }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
