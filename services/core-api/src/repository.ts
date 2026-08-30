import crypto from "node:crypto";
import type {
  InvitePilotInput,
  InventoryCreateInput,
  OnboardingInput,
  PrivacyRequestInput,
  ReservationCreateInput,
  ReservationUpdateInput,
  RestaurantCreateInput,
  Role,
  ShiftCreateInput,
  TaskCreateInput,
} from "@tablenow/contracts";
import { idempotencyKey, type Database, type Transaction, withPlatformAccess, withTenant } from "@tablenow/provider-adapters";
import { tenantSlug } from "@tablenow/domain";
import type { JSONValue } from "postgres";
import type { AuthActor } from "./types.js";
import { ensureDemoWorkspace } from "./demo.js";

export class PlatformRepository {
  public constructor(public readonly database: Database) {}

  public async sessionView(actor: AuthActor, csrfToken: string | undefined) {
    return {
      user: { id: actor.userId, email: actor.email, displayName: actor.displayName },
      tenant: {
        id: actor.tenantId,
        name: actor.tenantName,
        slug: actor.tenantSlug,
        onboardingComplete: actor.onboardingComplete,
      },
      membership: { role: actor.role },
      csrfToken: csrfToken || null,
    };
  }

  public async getWorkspace(tenantId: string) {
    return withTenant(this.database, tenantId, async (transaction) => {
      const restaurants = await transaction<Array<{ id: string; name: string; slug: string; address: string | null; phone: string | null; timezone: string; capacity: number; isDemo: boolean }>>`
        select id, name, slug, address, phone, timezone, capacity, is_demo as "isDemo"
        from restaurants where tenant_id = ${tenantId} order by created_at
      `;
      const reservations = await transaction`
        select id, restaurant_id as "restaurantId", guest_name as "guestName",
          guest_email as "guestEmail", guest_phone as "guestPhone", starts_at as "startsAt",
          party_size as "partySize", status, source, notes
        from reservations where tenant_id = ${tenantId}
        order by starts_at asc limit 100
      `;
      const communications = await transaction`
        select id, restaurant_id as "restaurantId", channel, direction, contact_name as "contactName",
          subject, summary, status, occurred_at as "occurredAt"
        from communications where tenant_id = ${tenantId}
        order by occurred_at desc limit 100
      `;
      const decisions = await transaction`
        select id, restaurant_id as "restaurantId", kind, title, description, priority, status,
          suggested_action as "suggestedAction", due_at as "dueAt", resolution_note as "resolutionNote",
          created_at as "createdAt"
        from decisions where tenant_id = ${tenantId}
        order by case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end, created_at desc
        limit 100
      `;
      const tasks = await transaction`
        select id, restaurant_id as "restaurantId", title, category, status,
          assignee_name as "assigneeName", due_at as "dueAt"
        from operational_tasks where tenant_id = ${tenantId}
        order by status, due_at nulls last limit 100
      `;
      const shifts = await transaction`
        select id, restaurant_id as "restaurantId", team_member_name as "teamMemberName",
          role_title as "roleTitle", starts_at as "startsAt", ends_at as "endsAt", status
        from team_shifts where tenant_id = ${tenantId}
        order by starts_at limit 100
      `;
      const inventory = await transaction`
        select id, restaurant_id as "restaurantId", name, unit, quantity::float8 as quantity,
          reorder_threshold::float8 as "reorderThreshold", status, updated_at as "updatedAt"
        from inventory_items where tenant_id = ${tenantId}
        order by status desc, name limit 100
      `;
      const metrics = await transaction`
        select restaurant_id as "restaurantId", metric_date as date,
          revenue_captured::float8 as "revenueCaptured", covers, calls_handled as "callsHandled",
          conversion_rate::float8 as "conversionRate", time_saved_minutes as "timeSavedMinutes"
        from metrics_daily where tenant_id = ${tenantId}
        order by metric_date asc limit 90
      `;
      const restaurantSummaries = await transaction<Array<{
        restaurantId: string;
        occupancyPercent: number;
        openDecisions: number;
        availableTables: number;
        inventoryAlerts: number;
        revenueCapturedToday: number;
        timeSavedMinutes: number;
        coversToday: number;
      }>>`
        with per_restaurant as (
          select r.id as restaurant_id, r.capacity,
            coalesce((select sum(party_size) from reservations
              where tenant_id = ${tenantId} and restaurant_id = r.id
                and (starts_at at time zone r.timezone)::date = (now() at time zone r.timezone)::date
                and status not in ('cancelled','no_show')), 0)::int as covers,
            coalesce((select count(*) from decisions
              where tenant_id = ${tenantId} and restaurant_id = r.id and status = 'open'), 0)::int as open_decisions,
            coalesce((select count(*) from inventory_items
              where tenant_id = ${tenantId} and restaurant_id = r.id and status = 'alert'), 0)::int as inventory_alerts,
            coalesce((select sum(revenue_captured) from metrics_daily
              where tenant_id = ${tenantId} and restaurant_id = r.id
                and metric_date = (now() at time zone r.timezone)::date), 0)::float8 as revenue,
            coalesce((select sum(time_saved_minutes) from metrics_daily
              where tenant_id = ${tenantId} and restaurant_id = r.id
                and metric_date = (now() at time zone r.timezone)::date), 0)::int as time_saved
          from restaurants r where r.tenant_id = ${tenantId}
        )
        select restaurant_id as "restaurantId",
          case when capacity = 0 then 0 else least(100, round(covers::numeric / capacity * 100))::int end as "occupancyPercent",
          open_decisions as "openDecisions", greatest(0, floor((capacity - covers) / 2.0))::int as "availableTables",
          inventory_alerts as "inventoryAlerts", revenue as "revenueCapturedToday",
          time_saved as "timeSavedMinutes", covers as "coversToday"
        from per_restaurant order by restaurant_id
      `;
      const totalCapacity = restaurants.reduce((sum, restaurant) => sum + restaurant.capacity, 0);
      const totals = restaurantSummaries.reduce((aggregate, restaurant) => ({
        coversToday: aggregate.coversToday + restaurant.coversToday,
        openDecisions: aggregate.openDecisions + restaurant.openDecisions,
        inventoryAlerts: aggregate.inventoryAlerts + restaurant.inventoryAlerts,
        revenueCapturedToday: aggregate.revenueCapturedToday + restaurant.revenueCapturedToday,
        timeSavedMinutes: aggregate.timeSavedMinutes + restaurant.timeSavedMinutes,
      }), { coversToday: 0, openDecisions: 0, inventoryAlerts: 0, revenueCapturedToday: 0, timeSavedMinutes: 0 });
      const summary = {
        ...totals,
        occupancyPercent: totalCapacity ? Math.min(100, Math.round(totals.coversToday / totalCapacity * 100)) : 0,
        availableTables: Math.max(0, Math.floor((totalCapacity - totals.coversToday) / 2)),
      };
      const actions = await transaction`
        select id, restaurant_id as "restaurantId", conversation_id as "conversationId", tool, title, rationale, risk,
          approval_required as "approvalRequired", status, created_at as "createdAt"
        from agent_actions where tenant_id = ${tenantId}
        order by created_at desc limit 30
      `;
      return { summary, restaurantSummaries, restaurants, reservations, communications, decisions, tasks, shifts, inventory, metrics, actions };
    });
  }

  public async updateOnboarding(
    actor: AuthActor,
    input: OnboardingInput,
    context: { ipHash: string; userAgent: string | undefined },
  ) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [restaurant] = await transaction<{ id: string }[]>`
        select id from restaurants where tenant_id = ${actor.tenantId} order by created_at limit 1
      `;
      if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
      await transaction`
        update tenants set name = ${input.organizationName}, updated_at = now() where id = ${actor.tenantId}
      `;
      await transaction`
        update restaurants set name = ${input.restaurantName}, phone = ${input.phone}, address = ${input.address},
          timezone = ${input.timezone}, is_demo = ${input.demoMode}
        where id = ${restaurant.id} and tenant_id = ${actor.tenantId}
      `;
      await transaction`
        insert into onboarding_profiles (tenant_id, restaurant_id, owner_name, role_title, phone, address, timezone, service_goals, operating_setup)
        values (${actor.tenantId}, ${restaurant.id}, ${input.ownerName}, ${input.roleTitle}, ${input.phone}, ${input.address}, ${input.timezone},
          ${transaction.json(input.serviceGoals)}, ${transaction.json(input.operatingSetup)})
        on conflict (tenant_id) do update set
          restaurant_id = excluded.restaurant_id, owner_name = excluded.owner_name, role_title = excluded.role_title,
          phone = excluded.phone, address = excluded.address, timezone = excluded.timezone,
          service_goals = excluded.service_goals, operating_setup = excluded.operating_setup, updated_at = now()
      `;
      await configureReservationSystems(transaction, actor.tenantId, restaurant.id, input.operatingSetup);
      if (actor.userId) await transaction`update users set display_name = ${input.ownerName} where id = ${actor.userId}`;
      if (!actor.userId) throw new Error("USER_REQUIRED");
      await transaction`
        insert into legal_acceptances (tenant_id, user_id, document_type, document_version, ip_hash, user_agent)
        values
          (${actor.tenantId}, ${actor.userId}, 'terms', 'pilot-2026-08-23', ${context.ipHash}, ${context.userAgent || null}),
          (${actor.tenantId}, ${actor.userId}, 'dpa', 'pilot-2026-08-23', ${context.ipHash}, ${context.userAgent || null})
        on conflict (tenant_id, user_id, document_type, document_version) do nothing
      `;
      await this.audit(transaction, actor, "onboarding.updated", "tenant", actor.tenantId);
      return { saved: true };
    });
  }

  public async completeOnboarding(actor: AuthActor) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [profile] = await transaction<{ restaurant_id: string | null; owner_name: string | null; phone: string | null; address: string | null }[]>`
        select restaurant_id, owner_name, phone, address from onboarding_profiles where tenant_id = ${actor.tenantId}
      `;
      if (!profile?.restaurant_id || !profile.owner_name || !profile.phone || !profile.address) {
        throw new Error("ONBOARDING_INCOMPLETE");
      }
      const [acceptance] = await transaction<{ count: number }[]>`
        select count(distinct document_type)::int as count from legal_acceptances
        where tenant_id = ${actor.tenantId} and user_id = ${actor.userId}
          and document_version = 'pilot-2026-08-23' and document_type in ('terms', 'dpa')
      `;
      if (acceptance?.count !== 2) throw new Error("LEGAL_ACCEPTANCE_REQUIRED");
      await transaction`update onboarding_profiles set completed_at = now() where tenant_id = ${actor.tenantId}`;
      await transaction`update tenants set onboarding_complete = true, status = 'active' where id = ${actor.tenantId}`;
      await ensureDemoWorkspace(transaction, actor.tenantId, profile.restaurant_id);
      await this.audit(transaction, actor, "onboarding.completed", "tenant", actor.tenantId);
      return { completed: true };
    });
  }

  public async createRestaurant(actor: AuthActor, input: RestaurantCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const baseSlug = tenantSlug(input.name);
      let [restaurant] = await transaction<{ id: string; name: string; slug: string; address: string; phone: string | null; timezone: string; capacity: number; isDemo: boolean }[]>`
        insert into restaurants (tenant_id, name, slug, address, phone, timezone, capacity, is_demo)
        values (${actor.tenantId}, ${input.name}, ${baseSlug}, ${input.address}, ${input.phone || null}, ${input.timezone}, ${input.capacity}, ${input.isDemo})
        on conflict (tenant_id, slug) do nothing
        returning id, name, slug, address, phone, timezone, capacity, is_demo as "isDemo"
      `;
      if (!restaurant) {
        const uniqueSlug = `${baseSlug.slice(0, 48)}-${crypto.randomBytes(3).toString("hex")}`;
        [restaurant] = await transaction<{ id: string; name: string; slug: string; address: string; phone: string | null; timezone: string; capacity: number; isDemo: boolean }[]>`
          insert into restaurants (tenant_id, name, slug, address, phone, timezone, capacity, is_demo)
          values (${actor.tenantId}, ${input.name}, ${uniqueSlug}, ${input.address}, ${input.phone || null}, ${input.timezone}, ${input.capacity}, ${input.isDemo})
          returning id, name, slug, address, phone, timezone, capacity, is_demo as "isDemo"
        `;
      }
      if (!restaurant) throw new Error("CREATE_FAILED");
      await configureReservationSystems(transaction, actor.tenantId, restaurant.id, input.operatingSetup);
      if (input.isDemo) await ensureDemoWorkspace(transaction, actor.tenantId, restaurant.id);
      await this.outbox(transaction, actor.tenantId, "restaurant", restaurant.id, "restaurant.created", restaurant);
      await this.audit(transaction, actor, "restaurant.created", "restaurant", restaurant.id, { isDemo: input.isDemo });
      return restaurant;
    });
  }

  public async createReservation(actor: AuthActor, input: ReservationCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [restaurant] = input.restaurantId
        ? await transaction<{ id: string }[]>`
            select id from restaurants where tenant_id = ${actor.tenantId} and id = ${input.restaurantId}
          `
        : await transaction<{ id: string }[]>`
            select id from restaurants where tenant_id = ${actor.tenantId} order by created_at limit 1
          `;
      if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
      const [reservation] = await transaction`
        insert into reservations (tenant_id, restaurant_id, guest_name, guest_email, guest_phone, starts_at, party_size, notes, source)
        values (${actor.tenantId}, ${restaurant.id}, ${input.guestName}, ${input.guestEmail || null}, ${input.guestPhone || null}, ${input.startsAt}, ${input.partySize}, ${input.notes || null}, ${input.source})
        returning id, restaurant_id as "restaurantId", guest_name as "guestName", starts_at as "startsAt", party_size as "partySize", status, source, notes
      `;
      if (!reservation) throw new Error("CREATE_FAILED");
      await this.outbox(transaction, actor.tenantId, "reservation", String(reservation.id), "reservation.created", reservation);
      await this.audit(transaction, actor, "reservation.created", "reservation", String(reservation.id));
      return reservation;
    });
  }

  public async updateReservation(actor: AuthActor, id: string, input: ReservationUpdateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [reservation] = await transaction`
        update reservations set
          status = coalesce(${input.status || null}, status),
          starts_at = coalesce(${input.startsAt || null}, starts_at),
          party_size = coalesce(${input.partySize || null}, party_size),
          notes = coalesce(${input.notes ?? null}, notes)
        where id = ${id} and tenant_id = ${actor.tenantId}
        returning id, guest_name as "guestName", starts_at as "startsAt", party_size as "partySize", status, notes
      `;
      if (!reservation) throw new Error("NOT_FOUND");
      await this.outbox(transaction, actor.tenantId, "reservation", id, "reservation.updated", reservation);
      await this.audit(transaction, actor, "reservation.updated", "reservation", id);
      return reservation;
    });
  }

  public async updateDecision(actor: AuthActor, id: string, status: string, note?: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [decision] = await transaction`
        update decisions set status = ${status}, resolution_note = ${note || null},
          resolved_by = ${actor.userId}, resolved_at = now()
        where id = ${id} and tenant_id = ${actor.tenantId} and status = 'open'
        returning id, title, status, resolution_note as "resolutionNote"
      `;
      if (!decision) throw new Error("NOT_FOUND_OR_ALREADY_RESOLVED");
      await this.outbox(transaction, actor.tenantId, "decision", id, "decision.resolved", decision);
      await this.audit(transaction, actor, `decision.${status}`, "decision", id);
      return decision;
    });
  }

  public async updateCommunication(actor: AuthActor, id: string, status: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [communication] = await transaction`
        update communications set status = ${status}
        where id = ${id} and tenant_id = ${actor.tenantId}
        returning id, status
      `;
      if (!communication) throw new Error("NOT_FOUND");
      await this.audit(transaction, actor, "communication.updated", "communication", id);
      return communication;
    });
  }

  public async updateTask(actor: AuthActor, id: string, status: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [task] = await transaction`
        update operational_tasks set status = ${status}
        where id = ${id} and tenant_id = ${actor.tenantId}
        returning id, status
      `;
      if (!task) throw new Error("NOT_FOUND");
      await this.audit(transaction, actor, "operation.updated", "operational_task", id);
      return task;
    });
  }

  public async createTask(actor: AuthActor, input: TaskCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [task] = await transaction`
        insert into operational_tasks (tenant_id, restaurant_id, title, category, assignee_name, due_at)
        select ${actor.tenantId}, r.id, ${input.title}, ${input.category}, ${input.assigneeName || null}, ${input.dueAt || null}
        from restaurants r where r.tenant_id = ${actor.tenantId} and r.id = ${input.restaurantId}
        returning id, restaurant_id as "restaurantId", title, category, status, assignee_name as "assigneeName", due_at as "dueAt"
      `;
      if (!task) throw new Error("RESTAURANT_NOT_FOUND");
      await this.outbox(transaction, actor.tenantId, "operational_task", String(task.id), "operation.created", task);
      await this.audit(transaction, actor, "operation.created", "operational_task", String(task.id));
      return task;
    });
  }

  public async createShift(actor: AuthActor, input: ShiftCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [shift] = await transaction`
        insert into team_shifts (tenant_id, restaurant_id, team_member_name, role_title, starts_at, ends_at, status)
        select ${actor.tenantId}, r.id, ${input.teamMemberName}, ${input.roleTitle}, ${input.startsAt}, ${input.endsAt}, ${input.status}
        from restaurants r where r.tenant_id = ${actor.tenantId} and r.id = ${input.restaurantId}
        returning id, restaurant_id as "restaurantId", team_member_name as "teamMemberName", role_title as "roleTitle",
          starts_at as "startsAt", ends_at as "endsAt", status
      `;
      if (!shift) throw new Error("RESTAURANT_NOT_FOUND");
      await this.outbox(transaction, actor.tenantId, "team_shift", String(shift.id), "team.shift_created", shift);
      await this.audit(transaction, actor, "team.shift_created", "team_shift", String(shift.id));
      return shift;
    });
  }

  public async createInventoryItem(actor: AuthActor, input: InventoryCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [item] = await transaction`
        insert into inventory_items (tenant_id, restaurant_id, name, unit, quantity, reorder_threshold)
        select ${actor.tenantId}, r.id, ${input.name}, ${input.unit}, ${input.quantity}, ${input.reorderThreshold}
        from restaurants r where r.tenant_id = ${actor.tenantId} and r.id = ${input.restaurantId}
        on conflict (restaurant_id, name) do update set unit = excluded.unit, quantity = excluded.quantity,
          reorder_threshold = excluded.reorder_threshold, updated_at = now()
        returning id, restaurant_id as "restaurantId", name, unit, quantity::float8 as quantity,
          reorder_threshold::float8 as "reorderThreshold", status, updated_at as "updatedAt"
      `;
      if (!item) throw new Error("RESTAURANT_NOT_FOUND");
      await this.outbox(transaction, actor.tenantId, "inventory_item", String(item.id), "inventory.item_saved", item);
      await this.audit(transaction, actor, "inventory.item_saved", "inventory_item", String(item.id));
      return item;
    });
  }

  public async updateInventory(actor: AuthActor, id: string, quantity: number, note?: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [item] = await transaction`
        update inventory_items set quantity = ${quantity}, updated_at = now()
        where id = ${id} and tenant_id = ${actor.tenantId}
        returning id, name, unit, quantity::float8 as quantity, status
      `;
      if (!item) throw new Error("NOT_FOUND");
      await this.audit(transaction, actor, "inventory.adjusted", "inventory_item", id, { note: note || null, quantity });
      return item;
    });
  }

  public async createPilot(actor: AuthActor, input: InvitePilotInput) {
    const slug = `${tenantSlug(input.organizationName)}-${crypto.randomBytes(3).toString("hex")}`;
    const result = await this.database.begin(async (transaction) => {
      const [tenant] = await transaction<{ id: string }[]>`
        insert into tenants (name, slug, locale, status, deployment_mode)
        values (${input.organizationName}, ${slug}, ${input.locale}, 'pilot', 'cloud') returning id
      `;
      if (!tenant) throw new Error("TENANT_CREATE_FAILED");
      await transaction`select set_config('app.tenant_id', ${tenant.id}, true)`;
      const [restaurant] = await transaction<{ id: string }[]>`
        insert into restaurants (tenant_id, name, slug, is_demo)
        values (${tenant.id}, ${input.restaurantName || input.organizationName}, 'espace-demo', true) returning id
      `;
      if (!restaurant) throw new Error("RESTAURANT_CREATE_FAILED");
      const [invitation] = await transaction<{ id: string }[]>`
        insert into invitations (tenant_id, email, role, locale, invited_by)
        values (${tenant.id}, ${input.email}, ${input.role}, ${input.locale}, ${actor.userId}) returning id
      `;
      if (!invitation) throw new Error("INVITATION_CREATE_FAILED");
      await ensureDemoWorkspace(transaction, tenant.id, restaurant.id);
      await this.audit(transaction, actor, "pilot.invited", "invitation", invitation.id, { email: input.email, tenantId: tenant.id });
      return { invitationId: invitation.id, tenantId: tenant.id, tenantSlug: slug };
    });
    return result;
  }

  public async listPilots() {
    return this.database`
      select i.id, i.email, i.role, i.status, i.expires_at as "expiresAt", i.created_at as "createdAt",
        t.id as "tenantId", t.name as "organizationName", t.slug as "tenantSlug", t.onboarding_complete as "onboardingComplete"
      from invitations i join tenants t on t.id = i.tenant_id
      order by i.created_at desc limit 250
    `;
  }

  public async getInvitation(invitationId: string) {
    const [invitation] = await this.database`
      select i.id, i.email, i.status, i.tenant_id as "tenantId", t.name as "organizationName"
      from invitations i join tenants t on t.id = i.tenant_id
      where i.id = ${invitationId}
    `;
    return invitation || null;
  }

  public async revokeInvitation(actor: AuthActor, invitationId: string) {
    const [row] = await this.database`
      update invitations set status = 'revoked'
      where id = ${invitationId} and status = 'pending'
      returning id, tenant_id as "tenantId", email, status
    `;
    if (!row) throw new Error("NOT_FOUND_OR_ALREADY_USED");
    await this.database`
      insert into audit_events (tenant_id, actor_id, actor_type, action, resource_type, resource_id)
      values (${String(row.tenantId)}, ${actor.userId}, 'user', 'pilot.invitation_revoked', 'invitation', ${invitationId})
    `;
    return row;
  }

  public async getPrivacy(actor: AuthActor) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [preferences] = await transaction`
        select product_emails as "productEmails", usage_analytics as "usageAnalytics",
          model_improvement as "modelImprovement", updated_at as "updatedAt"
        from privacy_preferences where tenant_id = ${actor.tenantId} and user_id = ${actor.userId}
      `;
      const requests = await transaction`
        select id, request_type as type, details, status, export_expires_at as "exportExpiresAt",
          scheduled_for as "scheduledFor", completed_at as "completedAt", created_at as "createdAt"
        from privacy_requests where tenant_id = ${actor.tenantId} and requested_by = ${actor.userId}
        order by created_at desc
      `;
      return { preferences: preferences || { productEmails: false, usageAnalytics: false, modelImprovement: false }, requests };
    });
  }

  public async updatePrivacyPreferences(actor: AuthActor, input: { productEmails: boolean; usageAnalytics: boolean; modelImprovement: boolean }) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [preferences] = await transaction`
        insert into privacy_preferences (tenant_id, user_id, product_emails, usage_analytics, model_improvement)
        values (${actor.tenantId}, ${actor.userId}, ${input.productEmails}, ${input.usageAnalytics}, ${input.modelImprovement})
        on conflict (tenant_id, user_id) do update set product_emails = excluded.product_emails,
          usage_analytics = excluded.usage_analytics, model_improvement = excluded.model_improvement, updated_at = now()
        returning product_emails as "productEmails", usage_analytics as "usageAnalytics", model_improvement as "modelImprovement"
      `;
      await this.audit(transaction, actor, "privacy.preferences_updated", "privacy_preferences", actor.userId || "node");
      return preferences;
    });
  }

  public async createPrivacyRequest(actor: AuthActor, input: PrivacyRequestInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const scheduledFor = input.type === "deletion" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null;
      const automated = ["access", "export"].includes(input.type);
      const [request] = await transaction`
        insert into privacy_requests (tenant_id, requested_by, request_type, details, status, scheduled_for)
        values (${actor.tenantId}, ${actor.userId}, ${input.type}, ${input.details || null},
          ${automated ? "received" : "requires_review"}, ${scheduledFor})
        returning id, request_type as type, status, scheduled_for as "scheduledFor", created_at as "createdAt"
      `;
      if (!request) throw new Error("CREATE_FAILED");
      if (automated) {
        await transaction`
          insert into jobs (tenant_id, job_type, payload)
          values (${actor.tenantId}, 'privacy.export', ${transaction.json({ requestId: request.id, userId: actor.userId })})
        `;
      }
      await this.audit(transaction, actor, "privacy.requested", "privacy_request", String(request.id), { type: input.type });
      return request;
    });
  }

  public async cancelPrivacyRequest(actor: AuthActor, requestId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [request] = await transaction`
        update privacy_requests set status = 'cancelled'
        where id = ${requestId} and tenant_id = ${actor.tenantId} and requested_by = ${actor.userId}
          and status in ('received', 'requires_review', 'processing')
        returning id, status
      `;
      if (!request) throw new Error("NOT_CANCELLABLE");
      await transaction`
        update jobs set status = 'cancelled', completed_at = now()
        where tenant_id = ${actor.tenantId} and job_type = 'privacy.delete'
          and status = 'pending' and payload ->> 'requestId' = ${requestId}
      `;
      await this.audit(transaction, actor, "privacy.cancelled", "privacy_request", requestId);
      return request;
    });
  }

  public async listPrivacyRequestsForAdmin() {
    return withPlatformAccess(this.database, async (transaction) => transaction`
      select pr.id, pr.tenant_id as "tenantId", t.name as "organizationName",
        pr.request_type as type, pr.status, pr.details, pr.scheduled_for as "scheduledFor",
        pr.created_at as "createdAt", u.email, u.display_name as "displayName"
      from privacy_requests pr
      join tenants t on t.id = pr.tenant_id
      join users u on u.id = pr.requested_by
      where pr.status in ('requires_review', 'processing', 'ready', 'failed')
      order by pr.created_at desc
      limit 250
    `);
  }

  public async decidePrivacyRequest(actor: AuthActor, requestId: string, approved: boolean, note: string) {
    return withPlatformAccess(this.database, async (transaction) => {
      const [request] = await transaction<{ tenant_id: string; requested_by: string; request_type: string; scheduled_for: Date | null }[]>`
        select tenant_id, requested_by, request_type, scheduled_for
        from privacy_requests where id = ${requestId} and status = 'requires_review' for update
      `;
      if (!request) throw new Error("PRIVACY_REQUEST_NOT_REVIEWABLE");
      if (request.request_type === "deletion") {
        const [membership] = await transaction<{ role: Role }[]>`
          select role from memberships where tenant_id = ${request.tenant_id} and user_id = ${request.requested_by}
        `;
        if (membership?.role === "platform_admin") throw new Error("PROTECTED_ADMIN_ACCOUNT");
      }

      const status = approved ? (request.request_type === "deletion" ? "processing" : "completed") : "cancelled";
      const [updated] = await transaction`
        update privacy_requests set status = ${status}, updated_at = now(),
          completed_at = case when ${status} = 'completed' then now() else completed_at end
        where id = ${requestId}
        returning id, tenant_id as "tenantId", status, scheduled_for as "scheduledFor"
      `;
      if (approved && request.request_type === "deletion") {
        await transaction`
          insert into jobs (tenant_id, job_type, payload, run_after)
          values (${request.tenant_id}, 'privacy.delete', ${transaction.json({ requestId, userId: request.requested_by })},
            ${request.scheduled_for || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)})
        `;
      }
      await transaction`
        insert into audit_events (tenant_id, actor_id, actor_type, action, resource_type, resource_id, metadata)
        values (${request.tenant_id}, ${actor.userId}, 'user', ${approved ? "privacy.request_approved" : "privacy.request_rejected"},
          'privacy_request', ${requestId}, ${transaction.json({ note })})
      `;
      return updated;
    });
  }

  public async privacyExport(actor: AuthActor, requestId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [request] = await transaction<{ storage_key: string | null; export_expires_at: Date | null }[]>`
        select storage_key, export_expires_at from privacy_requests
        where id = ${requestId} and tenant_id = ${actor.tenantId} and requested_by = ${actor.userId}
          and status = 'ready'
      `;
      if (!request?.storage_key || !request.export_expires_at || request.export_expires_at <= new Date()) {
        throw new Error("EXPORT_NOT_AVAILABLE");
      }
      await this.audit(transaction, actor, "privacy.export_downloaded", "privacy_request", requestId);
      return request.storage_key;
    });
  }

  public async copilotSnapshot(tenantId: string, restaurantId?: string) {
    const workspace = await this.getWorkspace(tenantId);
    if (!restaurantId) return workspace.summary as {
      occupancyPercent: number;
      openDecisions: number;
      availableTables: number;
      revenueCapturedToday: number;
      inventoryAlerts: number;
    };
    const summary = workspace.restaurantSummaries.find((item) => item.restaurantId === restaurantId);
    if (!summary) throw new Error("RESTAURANT_NOT_FOUND");
    return {
      occupancyPercent: summary.occupancyPercent,
      openDecisions: summary.openDecisions,
      availableTables: summary.availableTables,
      revenueCapturedToday: summary.revenueCapturedToday,
      inventoryAlerts: summary.inventoryAlerts,
    };
  }

  public async saveAgentPlan(actor: AuthActor, plan: {
    conversationId: string;
    proposedAction: NonNullable<import("@tablenow/contracts").CopilotReply["proposedAction"]>;
    arguments: Record<string, unknown>;
    usage: { estimatedCostEur: number; inputTokens: number; outputTokens: number };
  }, restaurantId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [restaurant] = await transaction<{ id: string }[]>`
        select id from restaurants where tenant_id = ${actor.tenantId} and id = ${restaurantId}
      `;
      if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
      const key = idempotencyKey([actor.tenantId, plan.conversationId, plan.proposedAction.tool, JSON.stringify(plan.arguments)]);
      const [action] = await transaction`
        insert into agent_actions (id, tenant_id, restaurant_id, conversation_id, actor_id, tool, title, rationale, risk, arguments, approval_required, idempotency_key)
        values (${plan.proposedAction.id}, ${actor.tenantId}, ${restaurant?.id || null}, ${plan.conversationId}, ${actor.userId},
          ${plan.proposedAction.tool}, ${plan.proposedAction.title}, ${plan.proposedAction.rationale}, ${plan.proposedAction.risk},
          ${transaction.json(plan.arguments as JSONValue)}, ${plan.proposedAction.approvalRequired}, ${key})
        on conflict (tenant_id, idempotency_key) do update set rationale = excluded.rationale
        returning id, status
      `;
      await transaction`
        insert into agent_usage_daily (tenant_id, estimated_cost_eur, input_tokens, output_tokens)
        values (${actor.tenantId}, ${plan.usage.estimatedCostEur}, ${plan.usage.inputTokens}, ${plan.usage.outputTokens})
        on conflict (tenant_id, usage_date) do update set
          estimated_cost_eur = agent_usage_daily.estimated_cost_eur + excluded.estimated_cost_eur,
          input_tokens = agent_usage_daily.input_tokens + excluded.input_tokens,
          output_tokens = agent_usage_daily.output_tokens + excluded.output_tokens
      `;
      await this.audit(transaction, actor, "copilot.action_proposed", "agent_action", String(action?.id || plan.proposedAction.id));
      return action;
    });
  }

  public async decideAgentAction(actor: AuthActor, actionId: string, approved: boolean, note?: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const status = approved ? "approved" : "rejected";
      const [action] = await transaction`
        update agent_actions set status = ${status}, approved_by = ${actor.userId}, approved_at = now()
        where id = ${actionId} and tenant_id = ${actor.tenantId} and status = 'proposed'
        returning id, tool, title, risk, arguments, status
      `;
      if (!action) throw new Error("NOT_FOUND_OR_ALREADY_DECIDED");
      if (approved) {
        await transaction`
          insert into jobs (tenant_id, job_type, payload)
          values (${actor.tenantId}, 'agent.execute', ${transaction.json({ actionId, note: note || null })})
        `;
      }
      await this.audit(transaction, actor, `copilot.action_${status}`, "agent_action", actionId, { note: note || null });
      return action;
    });
  }

  public async agentActionRisk(tenantId: string, actionId: string): Promise<string | null> {
    return withTenant(this.database, tenantId, async (transaction) => {
      const [action] = await transaction<{ risk: string }[]>`
        select risk from agent_actions where id = ${actionId} and tenant_id = ${tenantId}
      `;
      return action?.risk || null;
    });
  }

  public async assertAgentBudget(tenantId: string, estimatedCostEur: number, dailyLimitEur: number): Promise<void> {
    const usage = await withTenant(this.database, tenantId, async (transaction) => {
      const [dailyUsage] = await transaction<{ cost: number }[]>`
        select coalesce(estimated_cost_eur, 0)::float8 as cost
        from agent_usage_daily where tenant_id = ${tenantId} and usage_date = current_date
      `;
      return dailyUsage;
    });
    if ((usage?.cost ?? 0) + estimatedCostEur > dailyLimitEur) throw new Error("AI_DAILY_BUDGET_EXCEEDED");
  }

  private async audit(
    transaction: Transaction,
    actor: AuthActor,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await transaction`
      insert into audit_events (tenant_id, actor_id, actor_type, action, resource_type, resource_id, metadata)
      values (${actor.tenantId}, ${actor.userId}, ${actor.actorType}, ${action}, ${resourceType}, ${resourceId}, ${transaction.json(metadata as JSONValue)})
    `;
  }

  private async outbox(
    transaction: Transaction,
    tenantId: string,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    await transaction`
      insert into outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
      values (${tenantId}, ${aggregateType}, ${aggregateId}, ${eventType}, ${transaction.json(payload as JSONValue)})
    `;
  }
}

async function configureReservationSystems(
  transaction: Transaction,
  tenantId: string,
  restaurantId: string,
  setup: OnboardingInput["operatingSetup"],
): Promise<void> {
  const capabilities = ["reservation.read", "reservation.create", "reservation.update", "reservation.cancel"];
  await transaction`update restaurant_systems set is_source_of_truth = false where tenant_id = ${tenantId} and restaurant_id = ${restaurantId} and category in ('reservations', 'calendar', 'manual')`;
  const [native] = await transaction<{ id: string }[]>`
    insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
      status, capabilities, is_source_of_truth, priority, configuration)
    values (${tenantId}, ${restaurantId}, 'reservations', 'tablenow', 'TableNow natif', 'native', 'ready',
      ${transaction.json(capabilities)}, ${setup.reservationMode === "tablenow"}, 10, '{"onboardingManaged":true}'::jsonb)
    on conflict (tenant_id, restaurant_id, category, provider, display_name) do update set
      status = 'ready', capabilities = excluded.capabilities, is_source_of_truth = excluded.is_source_of_truth
    returning id
  `;
  if (!native) throw new Error("CREATE_FAILED");

  const candidates: Array<{ provider: string; name: string; category: string; accessMethod: string; priority: number }> = [];
  for (const provider of setup.providers) {
    if (provider === "google_calendar") candidates.push({ provider, name: "Google Calendar", category: "calendar", accessMethod: "calendar", priority: 20 });
    else if (provider === "outlook_calendar") candidates.push({ provider, name: "Outlook Calendar", category: "calendar", accessMethod: "calendar", priority: 20 });
    else if (provider === "other") candidates.push({ provider: "other", name: setup.otherProvider || "Autre logiciel", category: "reservations", accessMethod: "browser", priority: 30 });
    else candidates.push({ provider, name: providerLabel(provider), category: "reservations", accessMethod: "browser", priority: 20 });
  }
  if (setup.reservationMode === "paper" || setup.reservationMode === "hybrid" || setup.keepPaperWorkflow) {
    candidates.push({ provider: "paper", name: "Registre papier ou saisie humaine", category: "manual", accessMethod: "manual", priority: 90 });
  }

  const systems: Array<{ id: string; provider: string; accessMethod: string }> = [];
  for (const candidate of candidates) {
    const [system] = await transaction<{ id: string }[]>`
      insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
        status, capabilities, is_source_of_truth, priority, configuration)
      values (${tenantId}, ${restaurantId}, ${candidate.category}, ${candidate.provider}, ${candidate.name},
        ${candidate.accessMethod}, ${candidate.accessMethod === "manual" ? "ready" : "setup"},
        ${transaction.json(capabilities)}, false, ${candidate.priority}, '{"onboardingManaged":true}'::jsonb)
      on conflict (tenant_id, restaurant_id, category, provider, display_name) do update set
        access_method = excluded.access_method, capabilities = excluded.capabilities, priority = excluded.priority
      returning id
    `;
    if (system) systems.push({ id: system.id, provider: candidate.provider, accessMethod: candidate.accessMethod });
  }

  const preferred = setup.reservationMode === "tablenow" ? { id: native.id, accessMethod: "native" } : systems[0] || { id: native.id, accessMethod: "native" };
  await transaction`update restaurant_systems set is_source_of_truth = true where id = ${preferred.id} and tenant_id = ${tenantId}`;
  for (const capability of capabilities) {
    const executionMode = preferred.accessMethod === "manual" ? "manual"
      : preferred.accessMethod === "native" || capability === "reservation.read" ? "automatic" : "approval";
    await transaction`
      insert into action_routes (tenant_id, restaurant_id, capability, primary_system_id, fallback_system_id,
        execution_mode, maximum_risk)
      values (${tenantId}, ${restaurantId}, ${capability}, ${preferred.id},
        ${preferred.id === native.id ? null : native.id}, ${executionMode},
        ${capability === "reservation.cancel" ? "high" : "medium"})
      on conflict (tenant_id, restaurant_id, capability) do update set primary_system_id = excluded.primary_system_id,
        fallback_system_id = excluded.fallback_system_id, execution_mode = excluded.execution_mode,
        maximum_risk = excluded.maximum_risk, updated_at = now()
    `;
  }
}

function providerLabel(provider: string): string {
  return ({ zenchef: "Zenchef", sevenrooms: "SevenRooms", thefork: "TheFork Manager" } as Record<string, string>)[provider] || provider;
}
