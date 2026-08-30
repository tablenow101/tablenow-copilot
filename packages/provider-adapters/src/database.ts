import postgres, { type Sql } from "postgres";

export type Database = Sql<Record<string, never>>;
export type Transaction = postgres.TransactionSql<Record<string, never>>;

export function createDatabase(databaseUrl: string, max = 10): Database {
  return postgres(databaseUrl, {
    max,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: true,
    transform: { undefined: null },
    onnotice: () => undefined,
  });
}

export async function withTenant<T>(
  database: Database,
  tenantId: string,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return database.begin(async (transaction) => {
    await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
    return callback(transaction);
  }) as Promise<T>;
}

export async function withPlatformAccess<T>(
  database: Database,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return database.begin(async (transaction) => {
    await transaction`select set_config('app.platform_admin', 'true', true)`;
    return callback(transaction);
  }) as Promise<T>;
}
