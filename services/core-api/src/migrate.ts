import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createDatabase } from "@tablenow/provider-adapters";

export async function migrate(databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL): Promise<void> {
  if (!databaseUrl) throw new Error("DATABASE_URL or POSTGRES_URL is required for migrations");
  const database = createDatabase(databaseUrl, 1);
  const migrationsDirectory = path.resolve(process.cwd(), "migrations");
  try {
    await database`select pg_advisory_lock(hashtext('tablenow-v2-schema-migrations'))`;
    await database`
      create table if not exists schema_migrations (
        name text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;
    const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      const checksum = await sha256(sql);
      const [existing] = await database<{ checksum: string }[]>`
        select checksum from schema_migrations where name = ${file}
      `;
      if (existing) {
        if (existing.checksum !== checksum) throw new Error(`Migration ${file} changed after it was applied`);
        continue;
      }
      await database.begin(async (transaction) => {
        await transaction.unsafe(sql);
        await transaction`insert into schema_migrations (name, checksum) values (${file}, ${checksum})`;
      });
      process.stdout.write(`Applied ${file}\n`);
    }
  } finally {
    await database`select pg_advisory_unlock(hashtext('tablenow-v2-schema-migrations'))`.catch(() => undefined);
    await database.end();
  }
}

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
