import crypto from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant, type Database } from "@tablenow/provider-adapters";

const adminUrl = process.env.INTEGRATION_DATABASE_URL;
const suite = adminUrl ? describe : describe.skip;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const restaurantA = crypto.randomUUID();
const restaurantB = crypto.randomUUID();
const systemA = crypto.randomUUID();
const systemB = crypto.randomUUID();
const appPassword = crypto.randomBytes(24).toString("hex");
let admin: ReturnType<typeof postgres>;
let application: Database;

suite("PostgreSQL tenant isolation", () => {
  beforeAll(async () => {
    admin = postgres(adminUrl!, { max: 1 });
    await admin.unsafe("drop role if exists tablenow_test_app");
    await admin.unsafe(`create role tablenow_test_app login password '${appPassword}' nosuperuser nocreatedb nocreaterole`);
    await admin.unsafe("grant usage on schema public to tablenow_test_app");
    await admin.unsafe("grant select, insert, update, delete on all tables in schema public to tablenow_test_app");
    await admin.unsafe("grant usage, select on all sequences in schema public to tablenow_test_app");
    await admin.unsafe("grant execute on all functions in schema public to tablenow_test_app");
    await admin`insert into tenants (id, name, slug) values (${tenantA}, 'Isolation A', ${`isolation-a-${tenantA.slice(0, 8)}`}), (${tenantB}, 'Isolation B', ${`isolation-b-${tenantB.slice(0, 8)}`})`;
    await admin`insert into restaurants (id, tenant_id, name, slug) values (${restaurantA}, ${tenantA}, 'Restaurant A', 'restaurant-a'), (${restaurantB}, ${tenantB}, 'Restaurant B', 'restaurant-b')`;
    await admin`
      insert into restaurant_systems (id, tenant_id, restaurant_id, category, provider, display_name, access_method, status)
      values
        (${systemA}, ${tenantA}, ${restaurantA}, 'reservations', 'tablenow', 'TableNow A', 'native', 'ready'),
        (${systemB}, ${tenantB}, ${restaurantB}, 'reservations', 'tablenow', 'TableNow B', 'native', 'ready')
    `;

    const url = new URL(adminUrl!);
    url.username = "tablenow_test_app";
    url.password = appPassword;
    application = postgres(url.toString(), { max: 1 }) as Database;
  });

  afterAll(async () => {
    await application?.end();
    if (admin) {
      await admin`delete from tenants where id in (${tenantA}, ${tenantB})`;
      await admin.unsafe("drop owned by tablenow_test_app");
      await admin.unsafe("drop role if exists tablenow_test_app");
      await admin.end();
    }
  });

  it("returns only rows belonging to the configured tenant", async () => {
    const rows = await withTenant(application, tenantA, (transaction) => transaction<{ tenant_id: string; name: string }[]>`
      select tenant_id, name from restaurants order by name
    `);
    expect(rows).toEqual([{ tenant_id: tenantA, name: "Restaurant A" }]);
  });

  it("rejects a cross-tenant write even when the query supplies another tenant id", async () => {
    await expect(withTenant(application, tenantA, (transaction) => transaction`
      insert into restaurants (tenant_id, name, slug) values (${tenantB}, 'Intrusion', 'intrusion')
    `)).rejects.toThrow();
  });

  it("prevents a tenant row from referencing another tenant's restaurant", async () => {
    await expect(withTenant(application, tenantA, (transaction) => transaction`
      insert into reservations (tenant_id, restaurant_id, guest_name, starts_at, party_size)
      values (${tenantA}, ${restaurantB}, 'Cross tenant guest', now() + interval '1 day', 2)
    `)).rejects.toThrow();
  });

  it("isolates new system rows and rejects a cross-tenant system reference", async () => {
    const systems = await withTenant(application, tenantA, (transaction) => transaction<{ id: string }[]>`
      select id from restaurant_systems order by display_name
    `);
    expect(systems).toEqual([{ id: systemA }]);

    await expect(withTenant(application, tenantA, (transaction) => transaction`
      insert into computer_connections (
        tenant_id, restaurant_id, system_id, provider, display_name, surface,
        base_url, allowed_hosts, mode, status, credential_ref
      ) values (
        ${tenantA}, ${restaurantA}, ${systemB}, 'generic', 'Invalid cross-tenant connection', 'browser',
        'https://example.test', array['example.test'], 'assist', 'setup', 'local://invalid'
      )
    `)).rejects.toThrow();
  });
});
