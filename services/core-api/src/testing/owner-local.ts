// Explicit local-only browser recipe: disposable embedded PostgreSQL,
// synthetic owner, no real email transport or external AI calls.
import { createTestDatabase } from "./pglite.js";
import { seedOwnerFixture, ownerEmail } from "./owner-fixture.js";
import { randomBytes } from "node:crypto";
if (process.env.VERCEL || process.env.NODE_ENV === "production" || ["production", "preview"].includes(process.env.APP_ENV || ""))
  throw new Error("Local recipe is forbidden in deployed environments");
Object.assign(process.env, {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: "postgres://test:test@localhost/local_recipe",
  PUBLIC_ORIGIN: "http://localhost:3000",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  OTP_PEPPER: randomBytes(32).toString("hex"),
  PLATFORM_ADMIN_EMAIL: "admin@tablenow.test",
  // The normal account flow requires SMTP configuration. The injected sender
  // below captures synthetic mail instead; no SMTP transport is instantiated.
  EMAIL_TRANSPORT: "smtp",
  SMTP_HOST: "local.invalid",
  SMTP_USER: "local-test-user",
  SMTP_PASSWORD: "local-test-password",
  AUTH_FIXED_OTP: "424242",
  AI_PROVIDER: "deterministic",
  LOG_LEVEL: "warn",
});
const { sql } = await createTestDatabase();
await seedOwnerFixture(sql, process.env.OWNER_ONBOARDING !== "true");
const { buildApp } = await import("../app.js");
const app = await buildApp({
  database: sql,
  email: { send: async message => {
    if (!/^[^@\s]+@[^@\s]+\.test$/i.test(message.to)) {
      throw new Error("Local recipe accepts synthetic .test recipients only");
    }
    const code = message.subject === "Vérification de votre adresse TableNow"
      ? message.text.match(/\b\d{6}\b/)?.[0]
      : undefined;
    process.stdout.write(`LOCAL CAPTURE ONLY — ${message.to}${code ? ` — email verification code: ${code}` : " — synthetic message captured"}. Nothing sent externally.\n`);
  } },
});
await app.listen({
  port: 4000,
  host: "127.0.0.1",
  listenTextResolver: () => "Local synthetic API ready",
});
process.stdout.write(
  `Local synthetic recipe ready. Use a new @tablenow.test address for signup; email codes appear here. Legacy fixture ${ownerEmail}, test-only code 424242. External effects disabled; captured mail does not prove delivery.\n`,
);
process.on("SIGINT", () => {
  void app.close().then(() => sql.end());
});
