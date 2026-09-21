import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { hashSecret, randomToken, type Database } from "@tablenow/provider-adapters";
import { authGuard, cookieNames } from "./auth.js";
import { getConfig } from "./environment.js";
import { seal, unseal, validTotpStep } from "./account-crypto.js";

type Escrow = { userId: string; sessionHash: string; backupCodes?: string[]; acknowledged?: boolean };
type RecoveryRow = { payload: string; consumed_at: Date | string | null; expired: boolean; expires_at: Date | string; expires_in_seconds: number };
const operationSchema = z.object({ operationId: z.uuid() }).strict();
const replaceSchema = operationSchema.extend({ code: z.string().trim().regex(/^\d{6}$/) });

/** Escrow belongs to a proved operation and session, never to the public tn_auth flow. */
export async function registerAccountRecoveryRoutes(app: FastifyInstance, database: Database) {
  const secret = getConfig().SESSION_SECRET;
  const digest = (value: string) => hashSecret(value, secret);
  const protectedRoute = { preHandler: authGuard(database), config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
  const readRoute = { ...protectedRoute, config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } };

  async function handle(action: "replace" | "read" | "acknowledge", request: FastifyRequest, reply: FastifyReply) {
    const input = action === "replace" ? replaceSchema.parse(request.body) : operationSchema.parse(request.body);
    const actor = request.actor!;
    const sessionToken = request.cookies[cookieNames.sessionCookie];
    if (actor.actorType !== "user" || !actor.userId || !actor.email || !sessionToken) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Connexion requise." } });
    }
    const userId = actor.userId;
    const sessionHash = digest(sessionToken);
    const operationHash = `backup:${digest(`${sessionToken}:${input.operationId}`)}`;
    const result = await database.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${actor.email!}))`;
      const [session] = await tx`select user_id from sessions where token_hash=${sessionHash} and user_id=${userId} and expires_at>now() for update`;
      if (!session) return { error: "unauthenticated" as const };
      const [credential] = await tx<{ totp_secret: string; last_totp_step: number; locked: boolean }[]>`select totp_secret,last_totp_step,(locked_until>now()) as locked from account_credentials where user_id=${userId} for update`;
      if (!credential || credential.locked) return { error: "unavailable" as const };
      const [existing] = await tx<RecoveryRow[]>`select payload,consumed_at,expires_at,expires_at<=now() as expired,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds from account_challenges where token_hash=${operationHash} for update`;
      if (existing) {
        const escrow = unseal<Escrow>(existing.payload, secret);
        if (escrow.userId !== userId || escrow.sessionHash !== sessionHash) return { error: "unavailable" as const };
        if (existing.consumed_at) return escrow.acknowledged ? { state: "acknowledged" as const } : { error: "unavailable" as const };
        if (action === "acknowledge") {
          await tx`update account_challenges set consumed_at=now(),payload=${seal({ userId, sessionHash, acknowledged: true }, secret)} where token_hash=${operationHash}`;
          return { state: "acknowledged" as const };
        }
        if (existing.expired) {
          await tx`update account_challenges set payload=${seal({ userId, sessionHash }, secret)} where token_hash=${operationHash}`;
          return { error: "expired" as const };
        }
        if (!escrow.backupCodes) return { error: "unavailable" as const };
        return { state: "ready" as const, backupCodes: escrow.backupCodes, expiresAt: existing.expires_at, expiresInSeconds: Number(existing.expires_in_seconds) };
      }
      if (action !== "replace") return { state: "missing" as const };
      const code = "code" in input && typeof input.code === "string" ? input.code : "";
      const step = validTotpStep(unseal<string>(credential.totp_secret, secret), code, Number(credential.last_totp_step));
      if (step === null) {
        await tx`update account_credentials set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=10 then now()+interval '15 minutes' else locked_until end where user_id=${userId}`;
        return { error: "invalid" as const };
      }
      const backupCodes = Array.from({ length: 8 }, () => randomToken(12));
      // Invalidate previous batches atomically, including their encrypted recovery copies.
      await tx`update account_challenges set consumed_at=now(),payload=${seal({ userId, sessionHash }, secret)} where email=${actor.email!} and token_hash like 'backup:%' and consumed_at is null`;
      await tx`update account_credentials set backup_hashes=${tx.json(backupCodes.map(digest))},last_totp_step=${step},failed_attempts=0,locked_until=null where user_id=${userId}`;
      const [created] = await tx<{ expires_at: Date | string; expires_in_seconds: number }[]>`insert into account_challenges(token_hash,email,stage,payload,expires_at) values (${operationHash},${actor.email!},'mfa',${seal({ userId, sessionHash, backupCodes }, secret)},now()+interval '10 minutes') returning expires_at,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds`;
      await tx`select set_config('app.tenant_id',${actor.tenantId},true)`;
      await tx`insert into audit_events(tenant_id,actor_id,actor_type,action,resource_type,resource_id) values (${actor.tenantId},${userId},'user','auth.backup_codes_replaced','user',${userId})`;
      return { state: "ready" as const, backupCodes, expiresAt: created!.expires_at, expiresInSeconds: Number(created!.expires_in_seconds) };
    });
    if ("error" in result) {
      if (result.error === "unauthenticated") return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Connexion requise." } });
      if (result.error === "expired") return reply.code(410).send({ error: { code: "ACCOUNT_BACKUP_RECOVERY_EXPIRED", message: "La reprise de ces codes a expiré. Saisissez un nouveau code de votre application pour les remplacer." } });
      if (result.error === "invalid") return reply.code(400).send({ error: { code: "ACCOUNT_CODE_INVALID", message: "Code incorrect ou déjà utilisé. Attendez le prochain code de votre application d’authentification." } });
      return reply.code(400).send({ error: { code: "ACCOUNT_CHALLENGE_UNAVAILABLE", message: "Cette vérification n’est plus disponible. Patientez puis reconnectez-vous." } });
    }
    return result;
  }

  app.post("/v1/account/backup-codes/replace", protectedRoute, (request, reply) => handle("replace", request, reply));
  app.post("/v1/account/backup-codes/read", readRoute, (request, reply) => handle("read", request, reply));
  app.post("/v1/account/backup-codes/acknowledge", readRoute, (request, reply) => handle("acknowledge", request, reply));
}
