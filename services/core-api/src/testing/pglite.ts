// Test-only adapter. Production continues to use the existing postgres driver.
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { Database } from "@tablenow/provider-adapters";

type Executor = {
  query<T>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
};
function tagged(executor: Executor) {
  const query = (parts: TemplateStringsArray, ...parameters: unknown[]) => {
    const sql = parts.reduce(
      (text, part, index) => `${text}${index ? `$${index}` : ""}${part}`,
      "",
    );
    return executor
      .query(
        sql,
        parameters.map((value) =>
          value === undefined
            ? null
            : value instanceof Date
              ? value.toISOString()
              : value,
        ),
      )
      .then((result) => result.rows);
  };
  return Object.assign(query, {
    json: (value: unknown) => JSON.stringify(value),
    array: (value: unknown[]) => value,
    unsafe: (sql: string, parameters: unknown[] = []) =>
      executor.query(sql, parameters).then((result) => result.rows),
  });
}
export async function createTestDatabase() {
  const pglite = await PGlite.create({ extensions: { pgcrypto } });
  const directory = new URL("../../migrations/", import.meta.url);
  for (const name of (await readdir(directory))
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort())
    await pglite.exec(await readFile(new URL(name, directory), "utf8"));
  const sql = Object.assign(tagged(pglite), {
    begin: <T>(callback: (tx: Database) => Promise<T>) =>
      pglite.transaction((tx) => callback(tagged(tx) as unknown as Database)),
    end: () => pglite.close(),
  }) as unknown as Database;
  return { sql, pglite };
}
