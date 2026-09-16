import { resolveVercelDeployment } from "@tablenow/contracts";
import { assertVercelDatabaseBoundary } from "./deployment-database-boundary.js";
import { migrate } from "./migrate.js";

if (process.env.VERCEL !== "1") {
  process.stdout.write("Vercel migration skipped outside Vercel.\n");
} else {
  const deployment = resolveVercelDeployment(process.env);
  if (!deployment) throw new Error("Vercel database migration blocked before connection: project, branch or origin is not approved.");
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error(`Neon is not connected to the Vercel ${deployment.environment} environment`);
  assertVercelDatabaseBoundary(databaseUrl, process.env);
  await migrate(databaseUrl);
  process.stdout.write(`Vercel ${deployment.environment} database migrations are current.\n`);
}
