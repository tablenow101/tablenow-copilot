import { migrate } from "./migrate.js";

if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview") {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("Neon is not connected to the Vercel Preview environment");
  await migrate(databaseUrl);
  process.stdout.write("Preview database migrations are current.\n");
} else {
  process.stdout.write("Preview migration skipped outside Vercel Preview.\n");
}
