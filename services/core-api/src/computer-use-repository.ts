import crypto from "node:crypto";
import type {
  ComputerConnectionCreateInput,
  ComputerConnectionUpdateInput,
  ComputerNodeCompleteInput,
  ComputerNodeEventInput,
  ComputerNodeHeartbeatInput,
  ComputerRunCreateInput,
  ComputerWorkflowDefinition,
} from "@tablenow/contracts";
import { computerWorkflowDefinitionSchema } from "@tablenow/contracts";
import { canApproveComputerRun, computerExecutionPolicy, normalizeAllowedHosts, type ComputerRisk } from "@tablenow/domain";
import {
  constantTimeEqual,
  hashSecret,
  idempotencyKey,
  randomToken,
  withTenant,
  type Database,
  type Transaction,
} from "@tablenow/provider-adapters";
import type { JSONValue } from "postgres";
import type { AuthActor } from "./types.js";

interface RunnableWorkflow {
  workflow_id: string;
  connection_id: string;
  workflow_key: string;
  workflow_name: string;
  definition: ComputerWorkflowDefinition;
  risk: ComputerRisk;
  approval_required: boolean;
  connection_name: string;
  provider: string;
  surface: string;
  base_url: string;
  allowed_hosts: string[];
  mode: "observe" | "assist" | "autonomous" | "paused";
  connection_status: string;
  credential_ref: string;
}

interface ClaimedRunRow {
  id: string;
  workflow_id: string;
  objective: string;
  inputs: Record<string, string | number | boolean | null>;
  risk: ComputerRisk;
  approvalRequired: boolean;
  approved: boolean;
  attempts: number;
  maxAttempts: number;
}

export class ComputerUseRepository {
  public constructor(private readonly database: Database, private readonly secret: string) {}

  public async overview(actor: AuthActor) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const systems = await transaction`
        select id, restaurant_id as "restaurantId", category, provider, display_name as "displayName",
          access_method as "accessMethod", status, capabilities, is_source_of_truth as "isSourceOfTruth",
          priority, updated_at as "updatedAt"
        from restaurant_systems where tenant_id = ${actor.tenantId}
        order by restaurant_id, category, priority, display_name
      `;
      const routes = await transaction`
        select ar.id, ar.restaurant_id as "restaurantId", ar.capability,
          ar.primary_system_id as "primarySystemId", primary_system.display_name as "primarySystemName",
          primary_system.access_method as "primaryAccessMethod",
          ar.fallback_system_id as "fallbackSystemId", fallback_system.display_name as "fallbackSystemName",
          fallback_system.access_method as "fallbackAccessMethod", ar.execution_mode as "executionMode",
          ar.maximum_risk as "maximumRisk", ar.active
        from action_routes ar
        join restaurant_systems primary_system on primary_system.id = ar.primary_system_id
        left join restaurant_systems fallback_system on fallback_system.id = ar.fallback_system_id
        where ar.tenant_id = ${actor.tenantId}
        order by ar.capability
      `;
      const connections = await transaction`
        select id, restaurant_id as "restaurantId", provider, display_name as "displayName", surface,
          base_url as "baseUrl", allowed_hosts as "allowedHosts", mode, status, capabilities,
          health_message as "healthMessage", last_verified_at as "lastVerifiedAt", updated_at as "updatedAt"
        from computer_connections where tenant_id = ${actor.tenantId}
        order by created_at
      `;
      const workflows = await transaction`
        select id, connection_id as "connectionId", workflow_key as "key", version, name, description,
          risk, approval_required as "approvalRequired", status, success_count as "successCount",
          failure_count as "failureCount", last_succeeded_at as "lastSucceededAt", last_failed_at as "lastFailedAt"
        from computer_workflows where tenant_id = ${actor.tenantId} and status <> 'retired'
        order by connection_id, risk, name
      `;
      const runs = await transaction`
        select r.id, r.connection_id as "connectionId", r.workflow_id as "workflowId", r.objective,
          r.risk, r.approval_required as "approvalRequired", r.status, r.summary,
          r.error_code as "errorCode", r.attempts, r.max_attempts as "maxAttempts",
          r.cancellation_requested_at is not null as "cancellationRequested",
          r.started_at as "startedAt", r.completed_at as "completedAt", r.created_at as "createdAt",
          w.name as "workflowName", c.display_name as "connectionName", u.display_name as "requestedBy"
        from computer_runs r
        join computer_workflows w on w.id = r.workflow_id
        join computer_connections c on c.id = r.connection_id
        left join users u on u.id = r.requested_by
        where r.tenant_id = ${actor.tenantId}
        order by r.created_at desc limit 60
      `;
      const runIds = runs.map((run) => String(run.id));
      const events = runIds.length ? await transaction`
        select id, run_id as "runId", sequence, kind, status, message, metadata,
          evidence_key is not null as "hasEvidence", occurred_at as "occurredAt"
        from computer_run_events
        where tenant_id = ${actor.tenantId} and run_id in ${transaction(runIds)}
        order by run_id, sequence
      ` : [];
      const nodes = await transaction`
        select id, name, status, version, platform, capabilities, browser_version as "browserVersion",
          health_status as "healthStatus", last_heartbeat_at as "lastHeartbeatAt", last_seen_at as "lastSeenAt"
        from node_credentials where tenant_id = ${actor.tenantId} order by created_at
      `;
      return { systems, routes, connections, workflows, runs, events, nodes, generatedAt: new Date().toISOString() };
    });
  }

  public async createConnection(actor: AuthActor, input: ComputerConnectionCreateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [restaurant] = await transaction<{ id: string }[]>`
        select id from restaurants where id = ${input.restaurantId} and tenant_id = ${actor.tenantId}
      `;
      if (!restaurant) throw new Error("RESTAURANT_NOT_FOUND");
      const id = crypto.randomUUID();
      const allowedHosts = normalizeAllowedHosts(input.baseUrl, input.allowedHosts);
      const credentialRef = `browser-${id}`;
      let [system] = await transaction<{ id: string }[]>`
        select id from restaurant_systems
        where tenant_id = ${actor.tenantId} and restaurant_id = ${input.restaurantId}
          and category = 'reservations' and provider = ${input.provider} and access_method = ${input.surface}
        order by is_source_of_truth desc, priority, created_at limit 1
      `;
      if (system) {
        [system] = await transaction<{ id: string }[]>`
          update restaurant_systems set status = 'setup', capabilities = ${transaction.json(defaultCapabilities(input.provider))},
            configuration = configuration || ${transaction.json({ baseUrl: input.baseUrl } as JSONValue)}
          where id = ${system.id} and tenant_id = ${actor.tenantId}
          returning id
        `;
      } else {
        [system] = await transaction<{ id: string }[]>`
          insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
            status, capabilities, is_source_of_truth, priority, configuration)
          values (${actor.tenantId}, ${input.restaurantId}, 'reservations', ${input.provider}, ${input.displayName},
            ${input.surface}, 'setup', ${transaction.json(defaultCapabilities(input.provider))}, true, 20,
            ${transaction.json({ baseUrl: input.baseUrl } as JSONValue)})
          returning id
        `;
      }
      if (!system) throw new Error("CREATE_FAILED");
      const [connection] = await transaction`
        insert into computer_connections (id, tenant_id, restaurant_id, system_id, provider, display_name, surface, base_url,
          allowed_hosts, mode, status, capabilities, credential_ref, created_by)
        values (${id}, ${actor.tenantId}, ${input.restaurantId}, ${system.id}, ${input.provider}, ${input.displayName}, ${input.surface},
          ${input.baseUrl}, ${allowedHosts}, ${input.mode}, 'setup', ${transaction.json(defaultCapabilities(input.provider))},
          ${credentialRef}, ${actor.userId})
        returning id, restaurant_id as "restaurantId", provider, display_name as "displayName", surface,
          base_url as "baseUrl", allowed_hosts as "allowedHosts", mode, status, capabilities
      `;
      await this.insertHealthWorkflow(transaction, actor, id, input.baseUrl);
      const [native] = await transaction<{ id: string }[]>`
        select id from restaurant_systems where tenant_id = ${actor.tenantId} and restaurant_id = ${input.restaurantId}
          and provider = 'tablenow' and access_method = 'native' order by created_at limit 1
      `;
      for (const capability of defaultCapabilities(input.provider)) {
        if (capability === "connection.health") continue;
        await transaction`
          insert into action_routes (tenant_id, restaurant_id, capability, primary_system_id, fallback_system_id,
            execution_mode, maximum_risk)
          values (${actor.tenantId}, ${input.restaurantId}, ${capability}, ${system.id}, ${native?.id || null}, 'approval', 'high')
          on conflict (tenant_id, restaurant_id, capability) do update set primary_system_id = excluded.primary_system_id,
            fallback_system_id = excluded.fallback_system_id, updated_at = now()
        `;
      }
      await this.audit(transaction, actor, "computer.connection_created", "computer_connection", id, { provider: input.provider, allowedHosts });
      return connection;
    });
  }

  public async updateConnection(actor: AuthActor, connectionId: string, input: ComputerConnectionUpdateInput) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [current] = await transaction<{ base_url: string; allowed_hosts: string[] }[]>`
        select base_url, allowed_hosts from computer_connections where id = ${connectionId} and tenant_id = ${actor.tenantId}
      `;
      if (!current) throw new Error("NOT_FOUND");
      const baseUrl = input.baseUrl || current.base_url;
      const allowedHosts = normalizeAllowedHosts(baseUrl, input.allowedHosts || current.allowed_hosts);
      const [connection] = await transaction`
        update computer_connections set
          display_name = coalesce(${input.displayName || null}, display_name),
          base_url = ${baseUrl}, allowed_hosts = ${allowedHosts},
          mode = coalesce(${input.mode || null}, mode), status = coalesce(${input.status || null}, status)
        where id = ${connectionId} and tenant_id = ${actor.tenantId}
        returning id, restaurant_id as "restaurantId", provider, display_name as "displayName", surface,
          base_url as "baseUrl", allowed_hosts as "allowedHosts", mode, status, capabilities,
          health_message as "healthMessage", last_verified_at as "lastVerifiedAt"
      `;
      await transaction`
        update restaurant_systems set display_name = coalesce(${input.displayName || null}, display_name),
          status = case when ${input.status || null} = 'ready' then 'ready'
            when ${input.status || null} in ('offline', 'paused') then ${input.status || null}
            else status end,
          configuration = jsonb_set(configuration, '{baseUrl}', to_jsonb(${baseUrl}::text))
        where id = (select system_id from computer_connections where id = ${connectionId} and tenant_id = ${actor.tenantId})
      `;
      await transaction`
        update computer_workflows
        set definition = jsonb_set(definition, '{startUrl}', to_jsonb(${baseUrl}::text))
        where tenant_id = ${actor.tenantId} and connection_id = ${connectionId} and workflow_key = 'connection.health_check'
      `;
      await this.audit(transaction, actor, "computer.connection_updated", "computer_connection", connectionId, { mode: input.mode || null });
      return connection;
    });
  }

  public async createConnectionTest(actor: AuthActor, connectionId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [workflow] = await transaction<{ id: string }[]>`
        select id from computer_workflows
        where tenant_id = ${actor.tenantId} and connection_id = ${connectionId}
          and workflow_key = 'connection.health_check' and status = 'active'
      `;
      if (!workflow) throw new Error("HEALTH_WORKFLOW_NOT_FOUND");
      return this.createRunInTransaction(transaction, actor, {
        workflowId: workflow.id,
        objective: "Vérifier que TableNow peut ouvrir cette interface et produire une preuve visuelle.",
        inputs: {},
        idempotencyKey: `health-${connectionId}-${Math.floor(Date.now() / 30_000)}`,
      });
    });
  }

  public async createRun(actor: AuthActor, input: ComputerRunCreateInput) {
    return withTenant(this.database, actor.tenantId, (transaction) => this.createRunInTransaction(transaction, actor, input));
  }

  private async createRunInTransaction(transaction: Transaction, actor: AuthActor, input: ComputerRunCreateInput) {
    const workflow = await this.runnableWorkflow(transaction, actor.tenantId, input.workflowId);
    if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
    const parsedDefinition = computerWorkflowDefinitionSchema.parse(workflow.definition);
    const policy = computerExecutionPolicy({ risk: workflow.risk, mode: workflow.mode, readOnly: parsedDefinition.readOnly });
    if (!policy.executable) throw new Error(workflow.risk === "critical" ? "COMPUTER_CRITICAL_FORBIDDEN" : "COMPUTER_MODE_FORBIDS_ACTION");
    if (["setup", "offline", "paused"].includes(workflow.connection_status) && workflow.workflow_key !== "connection.health_check") {
      throw new Error("COMPUTER_CONNECTION_NOT_READY");
    }
    const key = idempotencyKey([actor.tenantId, input.idempotencyKey || crypto.randomUUID(), input.workflowId]);
    const status = policy.approvalRequired || workflow.approval_required ? "awaiting_approval" : "queued";
    const [run] = await transaction`
      insert into computer_runs (tenant_id, connection_id, workflow_id, requested_by, objective, inputs, risk,
        approval_required, status, idempotency_key)
      values (${actor.tenantId}, ${workflow.connection_id}, ${workflow.workflow_id}, ${actor.userId}, ${input.objective},
        ${transaction.json(input.inputs as JSONValue)}, ${workflow.risk}, ${policy.approvalRequired || workflow.approval_required},
        ${status}, ${key})
      on conflict (tenant_id, idempotency_key) do update set objective = computer_runs.objective
      returning id, connection_id as "connectionId", workflow_id as "workflowId", objective, risk,
        approval_required as "approvalRequired", status, created_at as "createdAt"
    `;
    if (!run) throw new Error("CREATE_FAILED");
    await this.audit(transaction, actor, "computer.run_requested", "computer_run", String(run.id), { workflowKey: workflow.workflow_key, status });
    return run;
  }

  public async decideRun(actor: AuthActor, runId: string, approved: boolean, note: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [current] = await transaction<{ risk: ComputerRisk }[]>`
        select risk from computer_runs where id = ${runId} and tenant_id = ${actor.tenantId} and status = 'awaiting_approval' for update
      `;
      if (!current) throw new Error("COMPUTER_RUN_NOT_AWAITING_APPROVAL");
      if (!canApproveComputerRun(actor.role, current.risk)) throw new Error("COMPUTER_APPROVAL_FORBIDDEN");
      const status = approved ? "queued" : "cancelled";
      const [run] = await transaction<ClaimedRunRow[]>`
        update computer_runs set status = ${status}, approved_by = ${actor.userId}, approval_note = ${note},
          completed_at = case when ${approved} then null else now() end
        where id = ${runId} and tenant_id = ${actor.tenantId} and status = 'awaiting_approval'
        returning id, status, approved_by as "approvedBy"
      `;
      await this.audit(transaction, actor, approved ? "computer.run_approved" : "computer.run_rejected", "computer_run", runId, { note });
      return run;
    });
  }

  public async cancelRun(actor: AuthActor, runId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [run] = await transaction`
        update computer_runs set
          status = case when status in ('awaiting_approval', 'queued') then 'cancelled' else status end,
          cancellation_requested_at = case when status in ('claimed', 'running') then now() else cancellation_requested_at end,
          completed_at = case when status in ('awaiting_approval', 'queued') then now() else completed_at end,
          claim_token_hash = case when status in ('awaiting_approval', 'queued') then null else claim_token_hash end,
          lease_expires_at = case when status in ('awaiting_approval', 'queued') then null else lease_expires_at end
        where id = ${runId} and tenant_id = ${actor.tenantId}
          and status in ('awaiting_approval', 'queued', 'claimed', 'running')
        returning id, status, cancellation_requested_at is not null as "cancellationRequested"
      `;
      if (!run) throw new Error("COMPUTER_RUN_NOT_CANCELLABLE");
      await this.audit(transaction, actor, "computer.run_cancelled", "computer_run", runId);
      return run;
    });
  }

  public async retryRun(actor: AuthActor, runId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [run] = await transaction`
        update computer_runs set status = 'queued', claim_token_hash = null, claimed_by = null,
          lease_expires_at = null, error_code = null, summary = null, completed_at = null,
          cancellation_requested_at = null
        where id = ${runId} and tenant_id = ${actor.tenantId} and status in ('failed', 'blocked') and attempts < max_attempts
        returning id, status, attempts, max_attempts as "maxAttempts"
      `;
      if (!run) throw new Error("COMPUTER_RUN_NOT_RETRYABLE");
      await this.audit(transaction, actor, "computer.run_retried", "computer_run", runId);
      return run;
    });
  }

  public async heartbeat(actor: AuthActor, input: ComputerNodeHeartbeatInput) {
    this.assertNode(actor);
    const [node] = await this.database`
      update node_credentials set version = ${input.version}, platform = ${input.platform},
        capabilities = ${this.database.json(input.capabilities)}, browser_version = ${input.browserVersion || null},
        health_status = 'healthy', last_heartbeat_at = now(), last_seen_at = now()
      where id = ${actor.actorId} and tenant_id = ${actor.tenantId} and status = 'active'
      returning id, name, health_status as "healthStatus", last_heartbeat_at as "lastHeartbeatAt"
    `;
    if (!node) throw new Error("NODE_NOT_FOUND");
    return node;
  }

  public async claim(actor: AuthActor) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      await transaction`
        update computer_runs set status = 'cancelled', claimed_by = null, claim_token_hash = null,
          lease_expires_at = null, completed_at = now(), error_code = 'CANCELLED_AFTER_LEASE_EXPIRY'
        where tenant_id = ${actor.tenantId} and status in ('claimed', 'running') and lease_expires_at < now()
          and cancellation_requested_at is not null
      `;
      await transaction`
        update computer_runs set status = 'queued', claimed_by = null, claim_token_hash = null, lease_expires_at = null,
          error_code = 'LEASE_EXPIRED'
        where tenant_id = ${actor.tenantId} and status in ('claimed', 'running') and lease_expires_at < now()
          and cancellation_requested_at is null and attempts < max_attempts
      `;
      await transaction`
        update computer_runs set status = 'failed', completed_at = now(), error_code = 'MAX_ATTEMPTS_EXCEEDED'
        where tenant_id = ${actor.tenantId} and status in ('claimed', 'running') and lease_expires_at < now()
          and cancellation_requested_at is null and attempts >= max_attempts
      `;
      const [candidate] = await transaction<{ id: string }[]>`
        select r.id from computer_runs r
        join computer_connections c on c.id = r.connection_id
        join computer_workflows w on w.id = r.workflow_id
        where r.tenant_id = ${actor.tenantId} and r.status = 'queued'
          and r.cancellation_requested_at is null
          and c.status not in ('paused', 'offline') and c.mode <> 'paused' and w.status = 'active'
        order by r.created_at limit 1 for update of r skip locked
      `;
      if (!candidate) return null;
      const claimToken = randomToken(36);
      const claimHash = hashSecret(claimToken, this.secret);
      const [run] = await transaction`
        update computer_runs set status = 'claimed', claimed_by = ${actor.actorId}, claim_token_hash = ${claimHash},
          lease_expires_at = now() + interval '2 minutes', attempts = attempts + 1
        where id = ${candidate.id} and tenant_id = ${actor.tenantId} and status = 'queued'
        returning id, workflow_id, objective, inputs, risk, approval_required as "approvalRequired", approved_by is not null as "approved",
          attempts, max_attempts as "maxAttempts"
      `;
      if (!run) return null;
      const [workflow] = await transaction<RunnableWorkflow[]>`
        select w.id as workflow_id, w.connection_id, w.workflow_key, w.name as workflow_name, w.definition,
          w.risk, w.approval_required, c.display_name as connection_name, c.provider, c.surface,
          c.base_url, c.allowed_hosts, c.mode, c.status as connection_status, c.credential_ref
        from computer_workflows w join computer_connections c on c.id = w.connection_id
        where w.id = ${run.workflow_id}
      `;
      if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
      const [sequence] = await transaction<{ nextSequence: number }[]>`
        select coalesce(max(sequence), 0)::int + 1 as "nextSequence"
        from computer_run_events where run_id = ${run.id} and tenant_id = ${actor.tenantId}
      `;
      return {
        ...run,
        nextSequence: sequence?.nextSequence || 1,
        claimToken,
        connection: {
          id: workflow.connection_id,
          name: workflow.connection_name,
          provider: workflow.provider,
          surface: workflow.surface,
          baseUrl: workflow.base_url,
          allowedHosts: workflow.allowed_hosts,
          credentialRef: workflow.credential_ref,
        },
        workflow: {
          id: workflow.workflow_id,
          key: workflow.workflow_key,
          name: workflow.workflow_name,
          definition: computerWorkflowDefinitionSchema.parse(workflow.definition),
        },
      };
    });
  }

  public async recordEvent(actor: AuthActor, runId: string, input: ComputerNodeEventInput) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      await this.assertClaim(transaction, actor, runId, input.claimToken);
      if (input.kind === "run_started") {
        await transaction`
          update computer_runs set status = 'running', started_at = coalesce(started_at, now()), lease_expires_at = now() + interval '2 minutes'
          where id = ${runId} and tenant_id = ${actor.tenantId} and status in ('claimed', 'running')
        `;
      } else {
        await transaction`update computer_runs set lease_expires_at = now() + interval '2 minutes' where id = ${runId} and tenant_id = ${actor.tenantId}`;
      }
      const [event] = await transaction`
        insert into computer_run_events (tenant_id, run_id, sequence, kind, status, message, metadata)
        values (${actor.tenantId}, ${runId}, ${input.sequence}, ${input.kind}, ${input.status}, ${input.message},
          ${transaction.json(input.metadata as JSONValue)})
        on conflict (run_id, sequence) do update set message = excluded.message
        returning id, sequence, kind, status, occurred_at as "occurredAt"
      `;
      return event;
    });
  }

  public async authorizeEvidence(actor: AuthActor, runId: string, claimToken: string) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => this.assertClaim(transaction, actor, runId, claimToken));
  }

  public async control(actor: AuthActor, runId: string, claimToken: string) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      await this.assertClaim(transaction, actor, runId, claimToken);
      const [run] = await transaction<{ cancelled: boolean }[]>`
        select cancellation_requested_at is not null as cancelled
        from computer_runs where id = ${runId} and tenant_id = ${actor.tenantId}
      `;
      return { cancelled: run?.cancelled || false };
    });
  }

  public async recordEvidence(actor: AuthActor, runId: string, input: { sequence: number; label: string; storageKey: string; sha256: string }) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [event] = await transaction`
        insert into computer_run_events (tenant_id, run_id, sequence, kind, status, message, evidence_key, evidence_sha256)
        values (${actor.tenantId}, ${runId}, ${input.sequence}, 'evidence', 'succeeded', ${input.label}, ${input.storageKey}, ${input.sha256})
        on conflict (run_id, sequence) do update set evidence_key = excluded.evidence_key, evidence_sha256 = excluded.evidence_sha256
        returning id, sequence, kind, status, occurred_at as "occurredAt"
      `;
      return event;
    });
  }

  public async complete(actor: AuthActor, runId: string, input: ComputerNodeCompleteInput) {
    this.assertNode(actor);
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      await this.assertClaim(transaction, actor, runId, input.claimToken);
      const [run] = await transaction<{ workflow_id: string; connection_id: string }[]>`
        update computer_runs set status = ${input.status}, output = ${transaction.json(input.output as JSONValue)},
          summary = ${input.summary}, error_code = ${input.errorCode || null}, completed_at = now(),
          lease_expires_at = null, claim_token_hash = null, claimed_by = null
        where id = ${runId} and tenant_id = ${actor.tenantId} and status in ('claimed', 'running')
        returning workflow_id, connection_id
      `;
      if (!run) throw new Error("COMPUTER_RUN_NOT_ACTIVE");
      if (input.status === "succeeded") {
        await transaction`update computer_workflows set success_count = success_count + 1, last_succeeded_at = now() where id = ${run.workflow_id}`;
      } else if (input.status !== "cancelled") {
        await transaction`update computer_workflows set failure_count = failure_count + 1, last_failed_at = now() where id = ${run.workflow_id}`;
      }
      const [workflow] = await transaction<{ workflow_key: string }[]>`select workflow_key from computer_workflows where id = ${run.workflow_id}`;
      if (workflow?.workflow_key === "connection.health_check" && input.status !== "cancelled") {
        await transaction`
          update computer_connections set status = ${input.status === "succeeded" ? "ready" : "degraded"},
            health_message = ${input.summary}, last_verified_at = case when ${input.status === "succeeded"} then now() else last_verified_at end
          where id = ${run.connection_id} and tenant_id = ${actor.tenantId}
        `;
        await transaction`
          update restaurant_systems set status = ${input.status === "succeeded" ? "ready" : "limited"}
          where id = (select system_id from computer_connections where id = ${run.connection_id})
            and tenant_id = ${actor.tenantId}
        `;
      }
      await this.nodeAudit(transaction, actor, `computer.run_${input.status}`, "computer_run", runId, { errorCode: input.errorCode || null });
      return { id: runId, status: input.status, completedAt: new Date().toISOString() };
    });
  }

  public async evidenceKey(actor: AuthActor, eventId: string) {
    return withTenant(this.database, actor.tenantId, async (transaction) => {
      const [event] = await transaction<{ evidence_key: string | null }[]>`
        select evidence_key from computer_run_events
        where id = ${eventId}::bigint and tenant_id = ${actor.tenantId} and evidence_key is not null
      `;
      if (!event?.evidence_key) throw new Error("EVIDENCE_NOT_FOUND");
      return event.evidence_key;
    });
  }

  private async runnableWorkflow(transaction: Transaction, tenantId: string, workflowId: string): Promise<RunnableWorkflow | null> {
    const [workflow] = await transaction<RunnableWorkflow[]>`
      select w.id as workflow_id, w.connection_id, w.workflow_key, w.name as workflow_name, w.definition,
        w.risk, w.approval_required, c.display_name as connection_name, c.provider, c.surface,
        c.base_url, c.allowed_hosts, c.mode, c.status as connection_status, c.credential_ref
      from computer_workflows w join computer_connections c on c.id = w.connection_id
      where w.id = ${workflowId} and w.tenant_id = ${tenantId} and w.status = 'active'
    `;
    return workflow || null;
  }

  private async assertClaim(transaction: Transaction, actor: AuthActor, runId: string, claimToken: string) {
    const [run] = await transaction<{ claim_token_hash: string | null; lease_expires_at: Date | null }[]>`
      select claim_token_hash, lease_expires_at from computer_runs
      where id = ${runId} and tenant_id = ${actor.tenantId} and claimed_by = ${actor.actorId}
        and status in ('claimed', 'running')
    `;
    if (!run?.claim_token_hash || !run.lease_expires_at || run.lease_expires_at <= new Date()) throw new Error("COMPUTER_CLAIM_EXPIRED");
    const suppliedHash = hashSecret(claimToken, this.secret);
    if (!constantTimeEqual(suppliedHash, run.claim_token_hash)) throw new Error("COMPUTER_CLAIM_INVALID");
    return run;
  }

  private async insertHealthWorkflow(transaction: Transaction, actor: AuthActor, connectionId: string, baseUrl: string) {
    const definition: ComputerWorkflowDefinition = {
      engine: "playwright",
      startUrl: baseUrl,
      steps: [
        { id: "open", action: "goto", url: baseUrl },
        { id: "proof", action: "screenshot", label: "Interface accessible" },
      ],
      expectedOutcome: "L'interface répond et une capture locale vérifiable est enregistrée.",
      maxSteps: 6,
      readOnly: true,
    };
    await transaction`
      insert into computer_workflows (tenant_id, connection_id, workflow_key, name, description, risk,
        approval_required, status, definition, created_by)
      values (${actor.tenantId}, ${connectionId}, 'connection.health_check', 'Vérifier la connexion',
        'Ouvre l’interface autorisée, contrôle sa disponibilité et conserve une preuve.', 'low', false, 'active',
        ${transaction.json(definition as unknown as JSONValue)}, ${actor.userId})
    `;
  }

  private assertNode(actor: AuthActor) {
    if (actor.actorType !== "node") throw new Error("NODE_ONLY");
  }

  private async audit(transaction: Transaction, actor: AuthActor, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
    await transaction`
      insert into audit_events (tenant_id, actor_id, actor_type, action, resource_type, resource_id, metadata)
      values (${actor.tenantId}, ${actor.userId}, 'user', ${action}, ${resourceType}, ${resourceId}, ${transaction.json(metadata as JSONValue)})
    `;
  }

  private async nodeAudit(transaction: Transaction, actor: AuthActor, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown> = {}) {
    await transaction`
      insert into audit_events (tenant_id, actor_type, action, resource_type, resource_id, metadata)
      values (${actor.tenantId}, 'node', ${action}, ${resourceType}, ${resourceId}, ${transaction.json({ ...metadata, nodeId: actor.actorId } as JSONValue)})
    `;
  }
}

function defaultCapabilities(provider: string): string[] {
  if (provider === "tablenow-simulator") return ["connection.health", "reservation.read", "reservation.create"];
  if (["zenchef", "sevenrooms", "thefork"].includes(provider)) return ["connection.health", "reservation.read", "reservation.create", "reservation.update", "reservation.cancel"];
  return ["connection.health"];
}
