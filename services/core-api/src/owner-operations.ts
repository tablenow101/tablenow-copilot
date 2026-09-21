import { registerGovernedCopilot } from "./governed-copilot.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  withTenant,
  type Database,
  type EmailSender,
  type Transaction,
  type ModelProvider,
} from "@tablenow/provider-adapters";
import { authGuard } from "./auth.js";
import { getConfig } from "./environment.js";
import type { AuthActor } from "./types.js";
import { googlePlaces } from "./google-places.js";
import { searchBusinesses } from "./business-search.js";

const idParams = z.object({ id: z.uuid() });
const tableSchema = z.object({
  restaurantId: z.uuid(),
  name: z.string().trim().min(1).max(40),
  area: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(100),
  status: z.enum(["available", "occupied", "reserved", "blocked"]),
});
const tableUpdateSchema = tableSchema.extend({
  expectedRevision: z.number().int().positive(),
});
const shiftUpdateSchema = z
  .object({
    restaurantId: z.uuid(),
    teamMemberName: z.string().trim().min(2).max(120),
    roleTitle: z.string().trim().min(2).max(120),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    status: z.enum(["planned", "confirmed", "absent", "completed"]),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    path: ["endsAt"],
    message: "La fin doit suivre le début du poste.",
  });
const draftSchema = z
  .object({
    restaurantId: z.uuid(),
    recipient: z.email().max(254),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .refine((v) => !/[\r\n]/.test(v)),
    body: z.string().trim().min(1).max(4000),
    idempotencyKey: z.uuid(),
  })
  .strict();
async function assertRestaurant(tx: Transaction, actor: AuthActor, id: string) {
  const [restaurant] = await tx<
    { id: string; name: string; timezone: string; is_demo: boolean }[]
  >`select id, name, timezone, is_demo from restaurants where tenant_id = ${actor.tenantId} and id = ${id}`;
  if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
  return restaurant;
}
async function audit(
  tx: Transaction,
  actor: AuthActor,
  verb: string,
  entity: string,
  id: string,
) {
  await tx`insert into audit_events (tenant_id, actor_type, actor_id, action, resource_type, resource_id) values (${actor.tenantId}, ${actor.actorType}, ${actor.userId}, ${verb}, ${entity}, ${id})`;
}
export function escapeEmailHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

export async function registerOwnerOperations(
  app: FastifyInstance,
  database: Database,
  email: EmailSender,
  model?: ModelProvider,
) {
  const config = getConfig();
  for (const kind of ["search", "details"] as const) {
    app.get(`/v1/onboarding/places/${kind}`, {
      preHandler: authGuard(database, "tenant.manage"),
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    }, async (request, reply) => {
      const input = z.object({ value: z.string().trim().min(2).max(240), session: z.uuid(), locale: z.enum(["fr", "en"]).default("fr") }).strict().parse(request.query);
      reply.header("Cache-Control", "no-store");
      try { return await googlePlaces(kind, input.value, input.session, input.locale); }
      catch { return reply.code(503).send({ error: { code: "GOOGLE_PLACES_UNAVAILABLE", message: input.locale === "en" ? "Google search is unavailable. You can enter your restaurant manually." : "La recherche Google est indisponible. Vous pouvez renseigner votre établissement manuellement." } }); }
    });
  }
  app.get(
    "/v1/onboarding/search",
    {
      preHandler: authGuard(database, "tenant.manage"),
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const { q } = z
        .object({ q: z.string().trim().min(3).max(240) })
        .strict()
        .parse(request.query);
      try {
        return { results: await searchBusinesses(q), scope: "France" };
      } catch {
        return reply
          .code(503)
          .send({
            error: {
              code: "BUSINESS_SEARCH_UNAVAILABLE",
              message:
                "La recherche publique est momentanément indisponible. Vous pouvez renseigner votre établissement manuellement.",
            },
          });
      }
    },
  );
  app.get(
    "/v1/operating",
    { preHandler: authGuard(database) },
    async (request) => {
      const actor = request.actor!;
      return withTenant(database, actor.tenantId, async (tx) => {
        const tables =
          await tx`select t.id, t.restaurant_id as "restaurantId", t.name, a.name as area, t.maximum_party_size as capacity, t.service_status as status, t.revision from dining_tables t join dining_areas a on a.id = t.area_id and a.tenant_id = t.tenant_id where t.tenant_id = ${actor.tenantId} and t.active order by a.sort_order, a.name, t.name`;
        const outgoing =
          await tx`select m.id, m.restaurant_id as "restaurantId", m.recipient_label as recipient, t.subject, m.body, m.delivery_status as status, m.created_at as "createdAt" from communication_messages m join communication_threads t on t.id = m.thread_id and t.tenant_id = m.tenant_id where m.tenant_id = ${actor.tenantId} and m.direction = 'outbound' and t.channel = 'email' order by m.created_at desc limit 100`;
        const chat =
          await tx`select * from (select id, restaurant_id as "restaurantId", role, body, mode, created_at as "createdAt" from copilot_messages where tenant_id = ${actor.tenantId} and user_id = ${actor.userId} and data_origin = 'business' order by created_at desc, id desc limit 100) history order by "createdAt", id`;
        const paused = await tx<
          { id: string }[]
        >`select id from team_shifts where tenant_id = ${actor.tenantId} and paused_at is not null`;
        return {
          tables,
          outgoing,
          chat,
          pausedShiftIds: paused.map((row) => row.id),
          capabilities: {
            email: config.EMAIL_TRANSPORT === "smtp",
            ai: Boolean(model),
            sms: false,
            phone: false,
            whatsapp: false,
          },
        };
      });
    },
  );

  app.post(
    "/v1/dining/tables",
    { preHandler: authGuard(database, "reservation.write") },
    async (request, reply) => {
      const input = tableSchema.parse(request.body),
        actor = request.actor!;
      const result = await withTenant(database, actor.tenantId, async (tx) => {
        await assertRestaurant(tx, actor, input.restaurantId);
        const [area] = await tx<
          { id: string }[]
        >`insert into dining_areas (tenant_id, restaurant_id, name) values (${actor.tenantId}, ${input.restaurantId}, ${input.area}) on conflict (restaurant_id, name) do update set active = true returning id`;
        const [table] = await tx<
          { id: string }[]
        >`insert into dining_tables (tenant_id, restaurant_id, area_id, name, maximum_party_size, service_status) values (${actor.tenantId}, ${input.restaurantId}, ${area!.id}, ${input.name}, ${input.capacity}, ${input.status}) returning id`;
        await audit(
          tx,
          actor,
          "dining.table.created",
          "dining_table",
          table!.id,
        );
        return table;
      });
      return reply.code(201).send(result);
    },
  );
  app.patch(
    "/v1/dining/tables/:id",
    { preHandler: authGuard(database, "reservation.write") },
    async (request) => {
      const input = tableUpdateSchema.parse(request.body),
        { id } = idParams.parse(request.params),
        actor = request.actor!;
      return withTenant(database, actor.tenantId, async (tx) => {
        await assertRestaurant(tx, actor, input.restaurantId);
        const [area] = await tx<
          { id: string }[]
        >`insert into dining_areas (tenant_id, restaurant_id, name) values (${actor.tenantId}, ${input.restaurantId}, ${input.area}) on conflict (restaurant_id, name) do update set active = true returning id`;
        const [table] =
          await tx`update dining_tables set name = ${input.name}, area_id = ${area!.id}, maximum_party_size = ${input.capacity}, service_status = ${input.status}, revision = revision + 1 where id = ${id} and tenant_id = ${actor.tenantId} and restaurant_id = ${input.restaurantId} and revision = ${input.expectedRevision} returning id, revision`;
        if (!table) throw new Error("OWNER_CONFLICT");
        await audit(tx, actor, "dining.table.updated", "dining_table", id);
        return table;
      });
    },
  );
  app.patch(
    "/v1/team/shifts/:id",
    { preHandler: authGuard(database, "team.write") },
    async (request) => {
      const input = shiftUpdateSchema.parse(request.body),
        { id } = idParams.parse(request.params),
        actor = request.actor!;
      return withTenant(database, actor.tenantId, async (tx) => {
        const [shift] =
          await tx`update team_shifts set team_member_name = ${input.teamMemberName}, role_title = ${input.roleTitle}, starts_at = ${input.startsAt}, ends_at = ${input.endsAt}, status = ${input.status}, paused_at = case when ${input.status} in ('absent','completed') then null else paused_at end where id = ${id} and tenant_id = ${actor.tenantId} and restaurant_id = ${input.restaurantId} returning id`;
        if (!shift) throw new Error("NOT_FOUND");
        await audit(tx, actor, "team.shift.updated", "team_shift", id);
        return shift;
      });
    },
  );
  app.patch(
    "/v1/team/shifts/:id/pause",
    { preHandler: authGuard(database, "team.write") },
    async (request) => {
      const { paused } = z
          .object({ paused: z.boolean() })
          .strict()
          .parse(request.body),
        { id } = idParams.parse(request.params),
        actor = request.actor!;
      return withTenant(database, actor.tenantId, async (tx) => {
        const [shift] =
          await tx`update team_shifts set paused_at = case when ${paused} then coalesce(paused_at, now()) else null end where id = ${id} and tenant_id = ${actor.tenantId} and status not in ('absent','completed') returning id`;
        if (!shift) throw new Error("NOT_FOUND");
        await audit(
          tx,
          actor,
          paused ? "team.pause.started" : "team.pause.ended",
          "team_shift",
          id,
        );
        return shift;
      });
    },
  );

  app.post(
    "/v1/communications/drafts",
    { preHandler: authGuard(database, "operations.write") },
    async (request, reply) => {
      const input = draftSchema.parse(request.body),
        actor = request.actor!;
      const result = await withTenant(database, actor.tenantId, async (tx) => {
        await assertRestaurant(tx, actor, input.restaurantId);
        await tx`select pg_advisory_xact_lock(hashtext(${`${actor.tenantId}:${input.idempotencyKey}`}))`;
        const [existing] = await tx<
          {
            id: string;
            restaurant_id: string;
            body: string;
            recipient_label: string;
            subject: string;
          }[]
        >`select m.id, m.restaurant_id, m.body, m.recipient_label, t.subject from communication_messages m join communication_threads t on t.id = m.thread_id and t.tenant_id = m.tenant_id where m.tenant_id = ${actor.tenantId} and m.idempotency_key = ${input.idempotencyKey}`;
        if (existing) {
          if (
            existing.restaurant_id !== input.restaurantId ||
            existing.body !== input.body ||
            existing.recipient_label !== input.recipient ||
            existing.subject !== input.subject
          )
            throw new Error("OWNER_CONFLICT");
          return { id: existing.id };
        }
        const [thread] = await tx<
          { id: string }[]
        >`insert into communication_threads (tenant_id, restaurant_id, channel, subject, status, last_message_at) values (${actor.tenantId}, ${input.restaurantId}, 'email', ${input.subject}, 'waiting_team', now()) returning id`;
        const [draft] = await tx<
          { id: string }[]
        >`insert into communication_messages (tenant_id, restaurant_id, thread_id, direction, sender_label, recipient_label, body, delivery_status, created_by, idempotency_key) values (${actor.tenantId}, ${input.restaurantId}, ${thread!.id}, 'outbound', ${actor.displayName || "Direction"}, ${input.recipient}, ${input.body}, 'draft', ${actor.userId}, ${input.idempotencyKey}) returning id`;
        await audit(
          tx,
          actor,
          "communication.draft.created",
          "communication_message",
          draft!.id,
        );
        return draft;
      });
      return reply.code(201).send(result);
    },
  );
  app.post(
    "/v1/communications/drafts/:id/send",
    {
      preHandler: authGuard(database, "operations.write"),
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    },
    async (request) => {
      const { id } = idParams.parse(request.params),
        actor = request.actor!;
      z.object({}).strict().parse(request.body);
      // Log/simulation transports may never claim a real-world send.
      if (config.EMAIL_TRANSPORT !== "smtp")
        throw new Error("EMAIL_NOT_CONFIGURED");
      const message = await withTenant(database, actor.tenantId, async (tx) => {
        const [row] = await tx<
          {
            id: string;
            recipient: string;
            subject: string;
            body: string;
            status: string;
            thread_id: string;
          }[]
        >`select m.id, m.recipient_label as recipient, t.subject, m.body, m.delivery_status as status, m.thread_id from communication_messages m join communication_threads t on t.id = m.thread_id and t.tenant_id = m.tenant_id where m.id = ${id} and m.tenant_id = ${actor.tenantId} and m.direction = 'outbound' and t.channel = 'email' for update of m`;
        if (!row) throw new Error("NOT_FOUND");
        if (row.status === "sent") return { ...row, alreadySent: true };
        if (row.status !== "draft") throw new Error("EMAIL_SEND_UNCERTAIN");
        z.email().parse(row.recipient);
        await tx`update communication_messages set delivery_status = 'queued' where id = ${id} and tenant_id = ${actor.tenantId}`;
        await audit(
          tx,
          actor,
          "communication.send.approved",
          "communication_message",
          id,
        );
        return { ...row, alreadySent: false };
      });
      if (message.alreadySent) return { id, status: "sent", delivered: false };
      try {
        await email.send({
          to: message.recipient,
          subject: message.subject,
          text: message.body,
          html: `<html lang="fr"><body style="font-family:Arial,sans-serif;line-height:1.7"><p>${escapeEmailHtml(message.body).replace(/\n/g, "<br>")}</p></body></html>`,
        });
        await withTenant(database, actor.tenantId, async (tx) => {
          await tx`update communication_messages set delivery_status = 'sent', sent_at = now() where id = ${id} and tenant_id = ${actor.tenantId}`;
          await tx`update communication_threads set status = 'waiting_guest', last_message_at = now() where id = ${message.thread_id} and tenant_id = ${actor.tenantId}`;
          await audit(
            tx,
            actor,
            "communication.smtp.accepted",
            "communication_message",
            id,
          );
        });
      } catch {
        // An ambiguous timeout must not be retried automatically: SMTP may have
        // accepted the message. Keep queued until provider reconciliation.
        throw new Error("EMAIL_SEND_UNCERTAIN");
      }
      return { id, status: "sent", delivered: false };
    },
  );

  registerGovernedCopilot(app, database, model);
}
