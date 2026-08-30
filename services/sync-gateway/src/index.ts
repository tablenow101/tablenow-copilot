import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import type { JSONValue } from "postgres";
import { syncPushSchema } from "@tablenow/contracts";
import { createDatabase, hashSecret, loadRuntimeConfig, withTenant } from "@tablenow/provider-adapters";

for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) { dotenv.config({ path: candidate, quiet: true }); break; }
}
const config = loadRuntimeConfig();
const enabled = process.env.SYNC_ENABLED === "true";
const port = Number(process.env.SYNC_PORT || 4100);
const database = createDatabase(config.DATABASE_URL, 5);
const app = Fastify({ logger: { level: config.LOG_LEVEL }, bodyLimit: 5_242_880, trustProxy: true });
await app.register(helmet);
await app.register(rateLimit, { global: true, max: 120, timeWindow: "1 minute" });

app.get("/health", async () => ({ status: "ok", service: "sync-gateway", syncEnabled: enabled }));

app.addHook("preHandler", async (request, reply) => {
  if (request.url === "/health") return;
  if (!enabled) return reply.code(503).send({ error: { code: "SYNC_DISABLED", message: "Cloud sync is disabled for this node." } });
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return reply.code(401).send({ error: { code: "UNAUTHENTICATED" } });
  const tokenHash = hashSecret(token, config.SESSION_SECRET);
  const [node] = await database<{ id: string; tenant_id: string }[]>`
    select id, tenant_id from node_credentials where token_hash = ${tokenHash} and status = 'active'
  `;
  if (!node) return reply.code(401).send({ error: { code: "UNAUTHENTICATED" } });
  (request as typeof request & { syncNode: typeof node }).syncNode = node;
});

app.post("/v1/sync/push", async (request, reply) => {
  const input = syncPushSchema.parse(request.body);
  const node = (request as typeof request & { syncNode: { id: string; tenant_id: string } }).syncNode;
  if (input.nodeId !== node.id) return reply.code(403).send({ error: { code: "NODE_MISMATCH" } });
  const accepted = await withTenant(database, node.tenant_id, async (transaction) => {
    let count = 0;
    for (const event of input.events) {
      const rows = await transaction`
        insert into sync_inbox (event_id, tenant_id, node_id, event_type, aggregate_type, aggregate_id, payload, occurred_at)
        values (${event.id}, ${node.tenant_id}, ${node.id}, ${event.type}, ${event.aggregateType}, ${event.aggregateId}, ${transaction.json(event.payload as JSONValue)}, ${event.occurredAt})
        on conflict (event_id) do nothing returning event_id
      `;
      count += rows.length;
    }
    return count;
  });
  return reply.code(202).send({ accepted, duplicates: input.events.length - accepted });
});

app.get("/v1/sync/pull", async (request) => {
  const query = z.object({ cursor: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(250).default(100) }).parse(request.query);
  const node = (request as typeof request & { syncNode: { id: string; tenant_id: string } }).syncNode;
  return withTenant(database, node.tenant_id, async (transaction) => {
    const events = await transaction`
      select id, aggregate_type as "aggregateType", aggregate_id as "aggregateId",
        event_type as type, payload, occurred_at as "occurredAt"
      from outbox_events
      where tenant_id = ${node.tenant_id}
        and (${query.cursor || null}::timestamptz is null or occurred_at > ${query.cursor || null})
      order by occurred_at, id limit ${query.limit}
    `;
    const last = events.at(-1) as { occurredAt?: Date } | undefined;
    return { events, nextCursor: last?.occurredAt?.toISOString() || query.cursor || null };
  });
});

app.setErrorHandler((error, request, reply) => {
  request.log.warn({ err: error }, "sync request failed");
  return reply.code(400).send({ error: { code: "SYNC_REQUEST_INVALID", message: "Invalid sync request." } });
});

app.addHook("onClose", async () => database.end());
await app.listen({ host: "0.0.0.0", port });
