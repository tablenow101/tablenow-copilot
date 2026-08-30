import { createDatabase, hashSecret, withTenant } from "@tablenow/provider-adapters";
import { tenantSlug } from "@tablenow/domain";
import { getConfig } from "./environment.js";
import { ensureDemoWorkspace } from "./demo.js";
import { ensureComputerUseDemo } from "./computer-use-demo.js";

export async function seed(): Promise<void> {
  const config = getConfig();
  const database = createDatabase(config.DATABASE_URL, 1);
  try {
    const slug = tenantSlug("TableNow Lab");
    const deploymentMode = process.env.VERCEL === "1" ? "cloud" : "local";
    const [tenant] = await database<{ id: string }[]>`
      insert into tenants (name, slug, status, deployment_mode, onboarding_complete)
      values ('TableNow Lab', ${slug}, 'pilot', ${deploymentMode}, true)
      on conflict (slug) do update set deployment_mode = excluded.deployment_mode, updated_at = now()
      returning id
    `;
    if (!tenant) throw new Error("Failed to seed tenant");
    const [user] = await database<{ id: string }[]>`
      insert into users (email, display_name)
      values (${config.PLATFORM_ADMIN_EMAIL}, 'TableNow Founder')
      on conflict (email) do update set display_name = excluded.display_name
      returning id
    `;
    if (!user) throw new Error("Failed to seed user");
    await database`
      insert into memberships (tenant_id, user_id, role)
      values (${tenant.id}, ${user.id}, 'platform_admin')
      on conflict (tenant_id, user_id) do update set role = 'platform_admin'
    `;
    await withTenant(database, tenant.id, async (transaction) => {
      const [restaurant] = await transaction<{ id: string }[]>`
        insert into restaurants (tenant_id, name, slug, address, phone, timezone, capacity, is_demo)
        values (${tenant.id}, 'Maison TableNow', 'maison-tablenow', '12 rue du Service, Paris', '+33100000000', 'Europe/Paris', 62, true)
        on conflict (tenant_id, slug) do update set name = excluded.name
        returning id
      `;
      if (!restaurant) throw new Error("Failed to seed restaurant");
      await transaction`
        insert into onboarding_profiles (tenant_id, restaurant_id, owner_name, role_title, phone, address, timezone, service_goals, completed_at)
        values (${tenant.id}, ${restaurant.id}, 'TableNow Founder', 'Direction', '+33100000000', '12 rue du Service, Paris', 'Europe/Paris', '["capture_demand","improve_service","group_visibility"]'::jsonb, now())
        on conflict (tenant_id) do update set completed_at = excluded.completed_at
      `;
      await transaction`
        insert into privacy_preferences (tenant_id, user_id)
        values (${tenant.id}, ${user.id})
        on conflict (tenant_id, user_id) do nothing
      `;
      await ensureDemoWorkspace(transaction, tenant.id, restaurant.id);
      await ensureComputerUseDemo(transaction, tenant.id, restaurant.id, config.COMPUTER_SIMULATOR_URL, user.id);
    });
    if (config.TABLENOW_NODE_TOKEN) {
      await database`
        insert into node_credentials (tenant_id, name, token_hash)
        values (${tenant.id}, 'Local demo node', ${hashSecret(config.TABLENOW_NODE_TOKEN, config.SESSION_SECRET)})
        on conflict (token_hash) do update set status = 'active'
      `;
    }
    if (config.TABLENOW_COMPUTER_NODE_TOKEN) {
      await database`
        insert into node_credentials (tenant_id, name, token_hash)
        values (${tenant.id}, 'Computer use runner', ${hashSecret(config.TABLENOW_COMPUTER_NODE_TOKEN, config.SESSION_SECRET)})
        on conflict (token_hash) do update set status = 'active'
      `;
    }
    process.stdout.write(`Seeded private pilot admin: ${config.PLATFORM_ADMIN_EMAIL}\n`);
  } finally {
    await database.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
