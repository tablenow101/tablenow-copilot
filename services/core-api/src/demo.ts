import type { Transaction } from "@tablenow/provider-adapters";

export async function ensureDemoWorkspace(
  transaction: Transaction,
  tenantId: string,
  restaurantId: string,
): Promise<void> {
  const [restaurant] = await transaction<{ timezone: string }[]>`
    select timezone from restaurants where tenant_id = ${tenantId} and id = ${restaurantId}
  `;
  if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
  const [existing] = await transaction<{ count: number }[]>`
    select count(*)::int as count from reservations where tenant_id = ${tenantId} and restaurant_id = ${restaurantId}
  `;
  if ((existing?.count ?? 0) > 0) return;

  await transaction`
    insert into reservations (tenant_id, restaurant_id, guest_name, guest_email, guest_phone, starts_at, party_size, status, source, notes)
    values
      (${tenantId}, ${restaurantId}, 'Camille Laurent', 'camille@example.test', '+33600000001', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '19 hours') at time zone ${restaurant.timezone}, 2, 'confirmed', 'phone', 'Anniversaire'),
      (${tenantId}, ${restaurantId}, 'Société Atlas', 'events@example.test', '+33600000002', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '20 hours') at time zone ${restaurant.timezone}, 10, 'pending', 'web', 'Menu groupe à valider'),
      (${tenantId}, ${restaurantId}, 'Nora Benali', 'nora@example.test', '+33600000003', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '20 hours 30 minutes') at time zone ${restaurant.timezone}, 4, 'confirmed', 'manual', 'Allergie aux fruits à coque'),
      (${tenantId}, ${restaurantId}, 'Marc Dubois', null, '+33600000004', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '21 hours 15 minutes') at time zone ${restaurant.timezone}, 3, 'confirmed', 'phone', null)
  `;

  await transaction`
    insert into communications (tenant_id, restaurant_id, channel, direction, contact_name, subject, summary, status, occurred_at)
    values
      (${tenantId}, ${restaurantId}, 'phone', 'inbound', 'Camille Laurent', 'Réservation créée', 'TableNow a confirmé une table de 2 personnes pour 19 h.', 'handled', now() - interval '18 minutes'),
      (${tenantId}, ${restaurantId}, 'email', 'inbound', 'Société Atlas', 'Demande de groupe', 'Demande pour 10 personnes avec menu unique et acompte.', 'escalated', now() - interval '42 minutes'),
      (${tenantId}, ${restaurantId}, 'phone', 'inbound', 'Client non identifié', 'Question allergènes', 'La demande nécessite la validation de la cuisine.', 'open', now() - interval '65 minutes')
  `;

  await transaction`
    insert into decisions (tenant_id, restaurant_id, kind, title, description, priority, status, suggested_action, due_at)
    values
      (${tenantId}, ${restaurantId}, 'group_request', 'Valider la demande Atlas', '10 couverts à 20 h. Le client accepte un menu unique et demande un devis.', 'high', 'open', 'Accepter sous réserve d’un acompte de 30 %.', now() + interval '90 minutes'),
      (${tenantId}, ${restaurantId}, 'allergen', 'Confirmer un allergène', 'Une cliente demande si le dessert signature contient des fruits à coque.', 'critical', 'open', 'Faire valider la fiche recette par la cuisine.', now() + interval '30 minutes')
  `;

  await transaction`
    insert into operational_tasks (tenant_id, restaurant_id, title, category, status, assignee_name, due_at)
    values
      (${tenantId}, ${restaurantId}, 'Brief équipe — allergies et VIP', 'service', 'open', 'Responsable de salle', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '18 hours') at time zone ${restaurant.timezone}),
      (${tenantId}, ${restaurantId}, 'Contrôler la mise en place terrasse', 'opening', 'in_progress', 'Équipe du soir', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '17 hours 30 minutes') at time zone ${restaurant.timezone}),
      (${tenantId}, ${restaurantId}, 'Réceptionner la livraison boissons', 'supplier', 'done', 'Maya', now() - interval '2 hours')
  `;

  await transaction`
    insert into team_shifts (tenant_id, restaurant_id, team_member_name, role_title, starts_at, ends_at, status)
    values
      (${tenantId}, ${restaurantId}, 'Maya', 'Responsable de salle', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '17 hours') at time zone ${restaurant.timezone}, (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '25 hours') at time zone ${restaurant.timezone}, 'confirmed'),
      (${tenantId}, ${restaurantId}, 'Léo', 'Chef de rang', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '18 hours') at time zone ${restaurant.timezone}, (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '25 hours') at time zone ${restaurant.timezone}, 'confirmed'),
      (${tenantId}, ${restaurantId}, 'Inès', 'Serveuse', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '18 hours') at time zone ${restaurant.timezone}, (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '24 hours') at time zone ${restaurant.timezone}, 'planned'),
      (${tenantId}, ${restaurantId}, 'Noah', 'Cuisine', (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '16 hours') at time zone ${restaurant.timezone}, (date_trunc('day', now() at time zone ${restaurant.timezone}) + interval '24 hours') at time zone ${restaurant.timezone}, 'confirmed')
  `;

  await transaction`
    insert into inventory_items (tenant_id, restaurant_id, name, unit, quantity, reorder_threshold)
    values
      (${tenantId}, ${restaurantId}, 'Saumon frais', 'kg', 3.2, 4),
      (${tenantId}, ${restaurantId}, 'Crémant', 'bouteilles', 18, 8),
      (${tenantId}, ${restaurantId}, 'Pain au levain', 'unités', 42, 20),
      (${tenantId}, ${restaurantId}, 'Citron jaune', 'unités', 27, 12)
  `;

  await transaction`
    insert into metrics_daily (tenant_id, restaurant_id, metric_date, revenue_captured, covers, calls_handled, conversion_rate, time_saved_minutes)
    select ${tenantId}, ${restaurantId}, (now() at time zone ${restaurant.timezone})::date - day_offset,
      1380 + (day_offset * 37), 54 + day_offset, 18 + day_offset, 68 + (day_offset % 5), 92 + (day_offset * 3)
    from generate_series(0, 13) as day_offset
  `;
}
