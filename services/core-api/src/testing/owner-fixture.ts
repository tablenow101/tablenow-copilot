import type { Database } from "@tablenow/provider-adapters";
import { withTenant } from "@tablenow/provider-adapters";
import { ensureDemoWorkspace } from "../demo.js";

export const ownerEmail = "owner@maison-rivage.test";
export async function seedOwnerFixture(
  database: Database,
  onboardingComplete = true,
) {
  const [tenant] = await database<
    { id: string }[]
  >`insert into tenants (name, slug, status, onboarding_complete) values ('Maison Rivage — recette', 'maison-rivage-recette', 'pilot', ${onboardingComplete}) returning id`;
  const [user] = await database<
    { id: string }[]
  >`insert into users (email, display_name) values (${ownerEmail}, 'Alex Rivage') returning id`;
  await database`insert into memberships (tenant_id, user_id, role) values (${tenant!.id}, ${user!.id}, 'owner')`;
  const restaurant = await withTenant(database, tenant!.id, async (tx) => {
    const [row] = await tx<
      { id: string }[]
    >`insert into restaurants (tenant_id, name, slug, timezone, capacity, is_demo) values (${tenant!.id}, 'Maison Rivage', 'maison-rivage', 'Europe/Paris', 65, true) returning id`;
    await ensureDemoWorkspace(tx, tenant!.id, row!.id);
    const [area] = await tx<
      { id: string }[]
    >`insert into dining_areas (tenant_id, restaurant_id, name) values (${tenant!.id}, ${row!.id}, 'Salle principale') returning id`;
    for (let index = 1; index <= 12; index += 1)
      await tx`insert into dining_tables (tenant_id, restaurant_id, area_id, name, maximum_party_size, service_status) values (${tenant!.id}, ${row!.id}, ${area!.id}, ${`T${String(index).padStart(2, "0")}`}, ${index > 8 ? 4 : 2}, ${index < 5 ? "occupied" : index < 8 ? "reserved" : "available"})`;
    return row!;
  });
  return {
    tenantId: tenant!.id,
    userId: user!.id,
    restaurantId: restaurant.id,
  };
}
