export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  const database = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  const serverSecrets = Boolean(process.env.SESSION_SECRET && process.env.OTP_PEPPER);
  const administrator = Boolean(process.env.PLATFORM_ADMIN_EMAIL);
  const email = process.env.EMAIL_TRANSPORT === "smtp"
    ? Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM)
    : process.env.VERCEL_ENV === "preview" && process.env.EMAIL_TRANSPORT === "log";
  const storage = process.env.VERCEL_ENV === "preview" || Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  return Response.json({
    service: "tablenow-copilot",
    environment: process.env.VERCEL_ENV || process.env.APP_ENV || "local",
    checks: { database, serverSecrets, administrator, email, storage },
    readyForMigrations: database,
    readyForLogin: database && serverSecrets && administrator && email,
  }, {
    headers: { "cache-control": "no-store, max-age=0" },
  });
}
