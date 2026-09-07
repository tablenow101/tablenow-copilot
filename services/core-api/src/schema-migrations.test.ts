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

    expect(expectedTables).toHaveLength(69);
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

  it("isolates onboarding rows and keeps one profile per restaurant", async () => {
    await database.exec(`
      insert into tenants (id, name, slug) values
        ('30000000-0000-0000-0000-000000000003', 'Tenant onboarding A', 'onboarding-tenant-a'),
        ('40000000-0000-0000-0000-000000000004', 'Tenant onboarding B', 'onboarding-tenant-b');
      insert into restaurants (id, tenant_id, name, slug) values
        ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Onboarding A1', 'onboarding-a1'),
        ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Onboarding A2', 'onboarding-a2'),
        ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 'Onboarding B1', 'onboarding-b1');
      insert into onboarding_profiles (tenant_id, restaurant_id) values
        ('30000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001'),
        ('30000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002');
      insert into onboarding_drafts (id, tenant_id, restaurant_id) values
        ('33000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001');
      insert into onboarding_first_results (
        id, tenant_id, restaurant_id, profile_revision, kind, status, title
      ) values (
        '34000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000003',
        '31000000-0000-0000-0000-000000000001',
        1, 'service', 'ready_for_review', 'Résultat isolé'
      );
      insert into onboarding_completion_keys (
        tenant_id, restaurant_id, idempotency_key, draft_revision, first_result_id
      ) values (
        '30000000-0000-0000-0000-000000000003',
        '31000000-0000-0000-0000-000000000001',
        'onboarding-test-key-1', 1,
        '34000000-0000-0000-0000-000000000001'
      );
    `);

    const profiles = await database.query<{ count: number }>(`
      select count(*)::int as count from onboarding_profiles
      where tenant_id = '30000000-0000-0000-0000-000000000003'
    `);
    expect(profiles.rows[0]?.count).toBe(2);

    await expect(database.exec(`
      insert into onboarding_profiles (tenant_id, restaurant_id)
      values ('30000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001');
    `)).rejects.toThrow();

    await expect(database.exec(`
      insert into onboarding_drafts (tenant_id, restaurant_id)
      values ('30000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000001');
    `)).rejects.toThrow();

    await expect(database.exec(`
      insert into onboarding_first_results (tenant_id, restaurant_id, profile_revision, kind, status, title)
      values ('30000000-0000-0000-0000-000000000003', '42000000-0000-0000-0000-000000000001', 2, 'service', 'draft', 'Interdit');
    `)).rejects.toThrow();

    await expect(database.exec(`
      insert into onboarding_completion_keys (tenant_id, restaurant_id, idempotency_key, draft_revision, first_result_id)
      values (
        '30000000-0000-0000-0000-000000000003',
        '31000000-0000-0000-0000-000000000002',
        'onboarding-test-key-2', 1,
        '34000000-0000-0000-0000-000000000001'
      );
    `)).rejects.toThrow();

    await expect(database.exec(`
      insert into onboarding_completion_keys (tenant_id, restaurant_id, idempotency_key, draft_revision, first_result_id)
      values (
        '30000000-0000-0000-0000-000000000003',
        '31000000-0000-0000-0000-000000000001',
        'onboarding-test-key-1', 1,
        '34000000-0000-0000-0000-000000000001'
      );
    `)).rejects.toThrow();
  });

  it("upgrades the preserved 005 onboarding journey draft to the final restaurant model", async () => {
    const legacyDatabase = await PGlite.create({ extensions: { pgcrypto } });
    try {
      const files = (await readdir(migrationsDirectory)).filter((file) => /^00[1-4]_.+\.sql$/.test(file)).sort();
      for (const file of files) {
        await legacyDatabase.exec(await readFile(path.join(migrationsDirectory, file), "utf8"));
      }
      await legacyDatabase.exec(`
        create table onboarding_drafts (
          tenant_id uuid primary key references tenants(id) on delete cascade,
          revision integer not null default 1 check (revision > 0),
          step integer not null check (step between 1 and 6),
          data jsonb not null check (jsonb_typeof(data) = 'object'),
          updated_by uuid references users(id) on delete set null,
          updated_at timestamptz not null default now()
        );
        alter table onboarding_drafts enable row level security;
        alter table onboarding_drafts force row level security;
        create policy tenant_isolation on onboarding_drafts
          using (tenant_id = app_current_tenant() or app_platform_access())
          with check (tenant_id = app_current_tenant() or app_platform_access());

        insert into tenants (id, name, slug) values
          ('50000000-0000-0000-0000-000000000005', 'Tenant legacy', 'tenant-legacy');
        insert into restaurants (id, tenant_id, name, slug) values
          ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000005', 'Legacy first', 'legacy-first'),
          ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000005', 'Legacy second', 'legacy-second');
        insert into onboarding_drafts (tenant_id, revision, step, data)
        values ('50000000-0000-0000-0000-000000000005', 3, 4, '{"note":"preserved"}'::jsonb);
      `);

      await legacyDatabase.exec(await readFile(path.join(migrationsDirectory, "006_onboarding_final.sql"), "utf8"));
      const migrated = await legacyDatabase.query<{
        revision: number;
        restaurantId: string;
        data: { note: string };
        currentSection: string;
      }>(`
        select revision, restaurant_id as "restaurantId", data, current_section as "currentSection"
        from onboarding_drafts
        where tenant_id = '50000000-0000-0000-0000-000000000005'
      `);
      expect(migrated.rows).toEqual([{
        revision: 3,
        restaurantId: "51000000-0000-0000-0000-000000000001",
        data: { note: "preserved" },
        currentSection: "establishment",
      }]);

      await legacyDatabase.exec(`
        insert into onboarding_drafts (tenant_id, restaurant_id)
        values ('50000000-0000-0000-0000-000000000005', '51000000-0000-0000-0000-000000000002')
      `);
      const policies = await legacyDatabase.query<{ count: number }>(`
        select count(*)::int as count from pg_policies
        where schemaname = 'public' and tablename = 'onboarding_drafts' and policyname = 'tenant_isolation'
      `);
      expect(policies.rows[0]?.count).toBe(1);
    } finally {
      await legacyDatabase.close();
    }
  }, 60_000);
});
