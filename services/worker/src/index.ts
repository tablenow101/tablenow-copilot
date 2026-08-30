import crypto from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import {
  createDatabase,
  FileExportStore,
  loadRuntimeConfig,
  type Transaction,
  withPlatformAccess,
  withTenant,
} from "@tablenow/provider-adapters";

for (const candidate of [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) { dotenv.config({ path: candidate, quiet: true }); break; }
}

const config = loadRuntimeConfig();
const database = createDatabase(config.DATABASE_URL, 4);
const exportStore = new FileExportStore(config.EXPORTS_DIR, config.STORAGE_ENCRYPTION_KEY);
const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`;
const pollMilliseconds = Math.max(250, Number(process.env.WORKER_POLL_MS || 2000));
let stopping = false;
let nextMaintenanceAt = 0;

interface Job {
  id: string;
  tenant_id: string | null;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

async function claimJob(): Promise<Job | null> {
  return database.begin(async (transaction) => {
    const [job] = await transaction<Job[]>`
      select id, tenant_id, job_type, payload, attempts, max_attempts
      from jobs
      where status = 'pending' and run_after <= now()
      order by run_after, created_at
      limit 1 for update skip locked
    `;
    if (!job) return null;
    await transaction`
      update jobs set status = 'processing', locked_at = now(), locked_by = ${workerId}, attempts = attempts + 1
      where id = ${job.id}
    `;
    return job;
  }) as Promise<Job | null>;
}

async function handle(job: Job): Promise<void> {
  if (job.job_type === "privacy.export") return handlePrivacyExport(job);
  if (job.job_type === "privacy.delete") return handlePrivacyDeletion(job);
  if (job.job_type === "agent.execute") return handleAgentExecution(job);
  if (job.job_type === "retention.sweep") return handleRetentionSweep(job);
  throw new Error(`UNKNOWN_JOB_TYPE:${job.job_type}`);
}

async function handlePrivacyDeletion(job: Job): Promise<void> {
  if (!job.tenant_id) throw new Error("TENANT_REQUIRED");
  const requestId = String(job.payload.requestId || "");
  const userId = String(job.payload.userId || "");
  await withTenant(database, job.tenant_id, async (transaction) => {
    const [request] = await transaction<{ status: string }[]>`
      select status from privacy_requests
      where id = ${requestId} and tenant_id = ${job.tenant_id} and requested_by = ${userId}
      for update
    `;
    if (!request || request.status !== "processing") throw new Error("DELETION_NOT_APPROVED");
    const [membership] = await transaction<{ role: string }[]>`
      select role from memberships where tenant_id = ${job.tenant_id} and user_id = ${userId}
    `;
    if (membership?.role === "platform_admin") throw new Error("PROTECTED_ADMIN_ACCOUNT");

    await transaction`delete from sessions where tenant_id = ${job.tenant_id} and user_id = ${userId}`;
    await transaction`delete from memberships where tenant_id = ${job.tenant_id} and user_id = ${userId}`;
    await transaction`delete from privacy_preferences where tenant_id = ${job.tenant_id} and user_id = ${userId}`;
    await transaction`
      update users set email = ${`deleted+${userId}@anonymous.invalid`}, display_name = null,
        status = 'deleted', updated_at = now()
      where id = ${userId}
    `;
    await transaction`
      update privacy_requests set status = 'completed', completed_at = now(), updated_at = now(),
        details = 'Compte anonymisé à la demande de la personne.'
      where id = ${requestId}
    `;
    await workerAudit(transaction, job.tenant_id!, "privacy.deletion_completed", "privacy_request", requestId);
  });
}

async function handlePrivacyExport(job: Job): Promise<void> {
  if (!job.tenant_id) throw new Error("TENANT_REQUIRED");
  const requestId = String(job.payload.requestId || "");
  const userId = String(job.payload.userId || "");
  const payload = await withTenant(database, job.tenant_id, async (transaction) => {
    const [tenant] = await transaction`select id, name, slug, created_at as "createdAt" from tenants where id = ${job.tenant_id}`;
    const [user] = await transaction`select id, email, display_name as "displayName", created_at as "createdAt" from users where id = ${userId}`;
    const memberships = await transaction`select tenant_id as "tenantId", role, created_at as "createdAt" from memberships where user_id = ${userId}`;
    const restaurants = await transaction`select id, name, address, phone, timezone from restaurants where tenant_id = ${job.tenant_id}`;
    const reservations = await transaction`
      select id, guest_name as "guestName", guest_email as "guestEmail", guest_phone as "guestPhone",
        starts_at as "startsAt", party_size as "partySize", status, source, notes
      from reservations where tenant_id = ${job.tenant_id}
    `;
    const actions = await transaction`
      select id, tool, title, rationale, risk, status, created_at as "createdAt"
      from agent_actions where tenant_id = ${job.tenant_id} and actor_id = ${userId}
    `;
    const audit = await transaction`
      select action, resource_type as "resourceType", resource_id as "resourceId", occurred_at as "occurredAt"
      from audit_events where tenant_id = ${job.tenant_id} and actor_id = ${userId}
      order by occurred_at desc
    `;
    return {
      generatedAt: new Date().toISOString(),
      format: "TableNow GDPR portable export v1",
      tenant,
      user,
      memberships,
      restaurants,
      reservations,
      copilotActions: actions,
      auditEvents: audit,
    };
  });
  const storageKey = await exportStore.put(job.tenant_id, requestId, payload);
  await withTenant(database, job.tenant_id, async (transaction) => {
    await transaction`
      update privacy_requests set status = 'ready', storage_key = ${storageKey},
        export_expires_at = now() + interval '7 days', completed_at = now()
      where id = ${requestId} and tenant_id = ${job.tenant_id}
    `;
    await workerAudit(transaction, job.tenant_id!, "privacy.export_ready", "privacy_request", requestId);
  });
}

async function handleAgentExecution(job: Job): Promise<void> {
  if (!job.tenant_id) throw new Error("TENANT_REQUIRED");
  const actionId = String(job.payload.actionId || "");
  await withTenant(database, job.tenant_id, async (transaction) => {
    const [action] = await transaction<{ id: string; tool: string; arguments: Record<string, unknown>; restaurant_id: string | null }[]>`
      update agent_actions set status = 'executing'
      where id = ${actionId} and tenant_id = ${job.tenant_id} and status = 'approved'
      returning id, tool, arguments, restaurant_id
    `;
    if (!action) throw new Error("ACTION_NOT_APPROVED");

    if (action.tool === "inventory.create_alert") {
      await transaction`
        insert into decisions (tenant_id, restaurant_id, kind, title, description, priority, suggested_action)
        values (${job.tenant_id}, ${action.restaurant_id}, 'inventory', 'Alerte stock créée par le copilote',
          'Le niveau doit être contrôlé avant le prochain service.', 'medium', 'Vérifier le stock physique et préparer une commande si nécessaire.')
      `;
    } else if (action.tool === "service.open_slot") {
      await transaction`
        insert into operational_tasks (tenant_id, restaurant_id, title, category, status, assignee_name, due_at)
        values (${job.tenant_id}, ${action.restaurant_id}, 'Valider l’ouverture du créneau supplémentaire', 'capacity', 'open', 'Responsable de salle', now() + interval '30 minutes')
      `;
    } else if (action.tool === "reservation.follow_up") {
      await transaction`
        insert into communications (tenant_id, restaurant_id, channel, direction, subject, summary, status)
        values (${job.tenant_id}, ${action.restaurant_id}, 'sms', 'outbound', 'Relance préparée',
          'TableNow a préparé la relance des réservations à risque. Aucun envoi externe n’a été effectué en mode pilote.', 'handled')
      `;
    } else {
      throw new Error(`TOOL_NOT_EXECUTABLE:${action.tool}`);
    }

    await transaction`update agent_actions set status = 'executed', executed_at = now() where id = ${actionId}`;
    await transaction`
      insert into outbox_events (tenant_id, aggregate_type, aggregate_id, event_type, payload)
      values (${job.tenant_id}, 'agent_action', ${actionId}, 'agent_action.executed', ${transaction.json({ tool: action.tool })})
    `;
    await workerAudit(transaction, job.tenant_id!, "copilot.action_executed", "agent_action", actionId);
  });
}

async function handleRetentionSweep(job: Job): Promise<void> {
  if (!job.tenant_id) throw new Error("TENANT_REQUIRED");
  await withTenant(database, job.tenant_id, async (transaction) => {
    await transaction`
      update reservations set guest_email = null, guest_phone = null,
        guest_name = 'Client anonymisé', notes = null
      where tenant_id = ${job.tenant_id}
        and starts_at < now() - (${config.DATA_RETENTION_MONTHS}::text || ' months')::interval
        and (guest_email is not null or guest_phone is not null or guest_name <> 'Client anonymisé')
    `;
    await workerAudit(transaction, job.tenant_id!, "retention.sweep_completed", "tenant", job.tenant_id!);
  });
}

async function workerAudit(transaction: Transaction, tenantId: string, action: string, resourceType: string, resourceId: string): Promise<void> {
  await transaction`
    insert into audit_events (tenant_id, actor_type, action, resource_type, resource_id)
    values (${tenantId}, 'worker', ${action}, ${resourceType}, ${resourceId})
  `;
}

async function complete(jobId: string): Promise<void> {
  await database`
    update jobs set status = 'completed', completed_at = now(), locked_at = null, locked_by = null where id = ${jobId}
  `;
}

async function fail(job: Job, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts + 1 >= job.max_attempts;
  const retryDelaySeconds = Math.min(300, 2 ** (job.attempts + 1));
  await database`
    update jobs set status = ${exhausted ? "failed" : "pending"}, last_error = ${message.slice(0, 1000)},
      run_after = now() + (${retryDelaySeconds}::text || ' seconds')::interval,
      locked_at = null, locked_by = null
    where id = ${job.id}
  `;
  process.stderr.write(`${JSON.stringify({ event: "job.failed", jobId: job.id, type: job.job_type, exhausted, error: message })}\n`);
}

async function loop(): Promise<void> {
  while (!stopping) {
    if (Date.now() >= nextMaintenanceAt) {
      await runMaintenance().catch((error) => {
        process.stderr.write(`${JSON.stringify({ event: "maintenance.failed", error: String(error) })}\n`);
      });
      nextMaintenanceAt = Date.now() + 15 * 60 * 1000;
    }
    const job = await claimJob().catch((error) => {
      process.stderr.write(`${JSON.stringify({ event: "worker.claim_failed", error: String(error) })}\n`);
      return null;
    });
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, pollMilliseconds));
      continue;
    }
    try {
      await handle(job);
      await complete(job.id);
    } catch (error) {
      await fail(job, error);
    }
  }
}

async function runMaintenance(): Promise<void> {
  const expiredExports = await withPlatformAccess(database, async (transaction) => {
    await transaction`delete from otp_challenges where expires_at < now() - interval '24 hours' or consumed_at < now() - interval '24 hours'`;
    await transaction`delete from sessions where expires_at < now()`;
    await transaction`update invitations set status = 'expired' where status = 'pending' and expires_at < now()`;
    await transaction`
      update invitations set email = concat('expired+', substr(md5(id::text), 1, 16), '@anonymous.invalid')
      where status in ('expired', 'revoked') and created_at < now() - interval '90 days'
        and email not like 'expired+%@anonymous.invalid'
    `;
    await transaction`delete from audit_events where occurred_at < now() - interval '12 months'`;
    await transaction`
      insert into jobs (tenant_id, job_type, payload)
      select t.id, 'retention.sweep', '{}'::jsonb from tenants t
      where t.status in ('pilot', 'active') and not exists (
        select 1 from jobs j where j.tenant_id = t.id and j.job_type = 'retention.sweep'
          and (j.status in ('pending', 'processing') or j.created_at > now() - interval '23 hours')
      )
    `;
    return transaction<{ id: string; storage_key: string }[]>`
      select id, storage_key from privacy_requests
      where status = 'ready' and storage_key is not null and export_expires_at < now()
    `;
  });

  for (const item of expiredExports) await exportStore.delete(item.storage_key);
  if (expiredExports.length) {
    await withPlatformAccess(database, async (transaction) => {
      const ids = expiredExports.map((item) => item.id);
      await transaction`
        update privacy_requests set status = 'completed', storage_key = null, updated_at = now()
        where id in ${transaction(ids)}
      `;
    });
  }
  process.stdout.write(`${JSON.stringify({ event: "maintenance.completed", expiredExports: expiredExports.length })}\n`);
}

async function shutdown(): Promise<void> {
  stopping = true;
  await database.end();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
process.stdout.write(`${JSON.stringify({ event: "worker.started", workerId })}\n`);
await loop();
