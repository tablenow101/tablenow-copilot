import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDirectory = fileURLToPath(new URL("../migrations/", import.meta.url));
const tenantTablesWithoutRls = new Set([
  "tenants",
  "memberships",
  "invitations",
  "otp_challenges",
  "sessions",
  "jobs",
  "node_credentials",
  "sync_inbox",
]);

let database: PGlite;
let migrationSql = "";

describe("PostgreSQL schema migrations", () => {
  beforeAll(async () => {
    database = await PGlite.create({ extensions: { pgcrypto } });
    const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
    for (const file of files) {
      const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
      migrationSql += `\n${sql}`;
      await database.exec(sql);
    }
  }, 60_000);

  afterAll(async () => {
    await database?.close();
  });

  it("applies all migrations and creates the complete operating schema", async () => {
    const expectedTables = [...migrationSql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([a-z_]+)/g)].map((match) => match[1]);
    const result = await database.query<{ tablename: string }>(`
      select tablename from pg_tables
      where schemaname = 'public'
      order by tablename
    `);

    expect(expectedTables).toHaveLength(66);
    expect(new Set(expectedTables).size).toBe(expectedTables.length);
    expect(result.rows.map((row) => row.tablename).sort()).toEqual(expectedTables.sort());
  });

  it("forces row-level isolation on every tenant-owned business table", async () => {
    const result = await database.query<{ tablename: string; rowsecurity: boolean; forcerowsecurity: boolean }>(`
      select c.relname as tablename, c.relrowsecurity as rowsecurity,
        c.relforcerowsecurity as forcerowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    const tenantOwned = result.rows.filter((row) => !tenantTablesWithoutRls.has(row.tablename) && row.tablename !== "users");
    const unprotected = tenantOwned.filter((row) => !row.rowsecurity || !row.forcerowsecurity);

    expect(tenantOwned.length).toBeGreaterThan(50);
    expect(unprotected).toEqual([]);
  });

  it("rejects a dining table that references another restaurant's area", async () => {
    await database.exec(`
      insert into tenants (id, name, slug) values
        ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'schema-tenant-a'),
        ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'schema-tenant-b');
      insert into restaurants (id, tenant_id, name, slug) values
        ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Restaurant A', 'restaurant-a'),
        ('22000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Restaurant B', 'restaurant-b');
      insert into dining_areas (id, tenant_id, restaurant_id, name) values
        ('23000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'Salle B');
    `);

    await expect(database.exec(`
      insert into dining_tables (tenant_id, restaurant_id, area_id, name, maximum_party_size)
      values (
        '10000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        '23000000-0000-0000-0000-000000000002',
        'Table impossible',
        4
      );
    `)).rejects.toThrow();
  });

  it("keeps imported records idempotent per external system", async () => {
    await database.exec(`
      insert into restaurant_systems (
        id, tenant_id, restaurant_id, category, provider, display_name, access_method, status
      ) values (
        '14000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        'reservations', 'generic', 'Système test', 'api', 'ready'
      );
      insert into external_record_links (
        tenant_id, restaurant_id, system_id, resource_type, resource_id, external_id
      ) values (
        '10000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000001',
        'reservation',
        '15000000-0000-0000-0000-000000000001',
        'external-reservation-42'
      );
    `);

    await expect(database.exec(`
      insert into external_record_links (
        tenant_id, restaurant_id, system_id, resource_type, resource_id, external_id
      ) values (
        '10000000-0000-0000-0000-000000000001',
        '11000000-0000-0000-0000-000000000001',
        '14000000-0000-0000-0000-000000000001',
        'reservation',
        '15000000-0000-0000-0000-000000000009',
        'external-reservation-42'
      );
    `)).rejects.toThrow();
  });
});
