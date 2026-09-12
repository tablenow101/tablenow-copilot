// Explicit local-only browser recipe: disposable embedded PostgreSQL,
// synthetic owner, no real email transport or external AI calls.
import { createTestDatabase } from "./pglite.js";
import { seedOwnerFixture, ownerEmail } from "./owner-fixture.js";
import { randomBytes } from "node:crypto";
if (process.env.VERCEL || process.env.APP_ENV === "production")
  throw new Error("Local recipe is forbidden in deployed environments");
Object.assign(process.env, {
  NODE_ENV: "test",
  APP_ENV: "test",
  DATABASE_URL: "postgres://test:test@localhost/local_recipe",
  PUBLIC_ORIGIN: "http://localhost:3000",
  SESSION_SECRET: randomBytes(32).toString("hex"),
  OTP_PEPPER: randomBytes(32).toString("hex"),
  PLATFORM_ADMIN_EMAIL: "admin@tablenow.test",
  EMAIL_TRANSPORT: "log",
  AUTH_FIXED_OTP: "424242",
  AI_PROVIDER: "deterministic",
  LOG_LEVEL: "warn",
});
const { sql } = await createTestDatabase();
await seedOwnerFixture(sql, process.env.OWNER_ONBOARDING !== "true");
const { buildApp } = await import("../app.js");
const app = await buildApp({
  database: sql,
  email: { send: async () => undefined },
});
await app.listen({
  port: 4000,
  host: "127.0.0.1",
  listenTextResolver: () => "Local synthetic API ready",
});
process.stdout.write(
  `Local synthetic recipe ready. Account ${ownerEmail}. Test-only code: 424242. External effects disabled.\n`,
);
process.on("SIGINT", () => {
  void app.close().then(() => sql.end());
});
