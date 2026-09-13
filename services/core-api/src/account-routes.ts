import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { constantTimeEqual, hashSecret, randomDigits, randomToken, type Database, type EmailSender, type Transaction } from "@tablenow/provider-adapters";
import { getConfig } from "./environment.js";
import { setSessionCookies } from "./auth.js";
import { newTotpSecret, passwordHash, passwordMatches, seal, unseal, validTotpStep } from "./account-crypto.js";
import { registerGoogleRoutes } from "./google-routes.js";
import type { GoogleExchange } from "./google-identity.js";

type Payload = { purpose: "signup" | "reset" | "login" | "google"; googleSubject?: string; passwordHash?: string; name?: string; userId?: string; tenantId?: string; secret?: string; rememberMe?: boolean };
type Challenge = { token_hash: string; email: string; stage: string; payload: string; proof_hash: string | null; attempts: number };
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(15).max(128);
const proofSchema = z.object({ code: z.string().trim().min(6).max(64) }).strict();

export async function registerAccountRoutes(app: FastifyInstance, database: Database, mail: EmailSender, googleExchange?: GoogleExchange) {
  const config = getConfig();
  const secret = config.SESSION_SECRET;
  const digest = (s: string) => hashSecret(s, secret);
  const cookieOptions = { httpOnly: true, secure: new URL(config.PUBLIC_ORIGIN).protocol === "https:", sameSite: "strict" as const, path: "/", maxAge: 600 };
  const rate = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
  const fail = (reply: FastifyReply) => reply.code(400).send({ error: { code: "ACCOUNT_AUTH_FAILED", message: "Vérifiez vos informations ou recommencez la connexion." } });
  async function challenge(reply: FastifyReply, email: string, stage: string, payload: Payload, proof?: string, writer: Database | Transaction = database) {
    const token = randomToken(32);
    await writer`insert into account_challenges(token_hash,email,stage,payload,proof_hash) values (${digest(token)},${email},${stage},${seal(payload,secret)},${proof ? digest(proof) : null})`;
    reply.setCookie("tn_auth", token, cookieOptions).header("Cache-Control", "no-store");
    return token;
  }
  // All public account endpoints reject cross-site browser requests even before a session exists.
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/account/")) return;
    reply.header("Cache-Control", "no-store");
    if (request.headers["sec-fetch-site"] === "cross-site") return reply.code(403).send({ error: { message: "Origine non autorisée." } });
    const origin = request.headers.origin;
    if (origin) {
      const host = String(request.headers["x-forwarded-host"] || request.headers.host).split(",")[0]!.trim();
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { /* Invalid origins are denied. */ }
      if (origin !== config.PUBLIC_ORIGIN && (!originHost || originHost !== host)) return reply.code(403).send({ error: { message: "Origine non autorisée." } });
    }
  });
  async function emailRequest(reply: FastifyReply, email: string, payload: Payload) {
    const code = randomDigits(6);
    // Persist the recipient budget: rotating IPs or serverless instances must not
    // bypass the mail limit. Consume the budget before contacting the provider.
    const token = await database.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${`account-mail:${email}`}))`;
      // proof_hash marks an email attempt independently of its current stage.
      // Password-only login challenges do not consume the recipient mail budget.
      const [budget] = await tx<{ count: number }[]>`select count(*)::int as count from account_challenges where email=${email} and created_at>now()-interval '15 minutes' and proof_hash is not null`;
      if (budget!.count >= 5) return null;
      return challenge(reply, email, "email", payload, code, tx);
    });
    if (!token) return reply.code(429).send({ error: { message: "Trop de demandes pour cette adresse. Réessayez dans 15 minutes." } });
    try {
      if (config.EMAIL_TRANSPORT !== "smtp") throw new Error("EMAIL_NOT_CONFIGURED");
      await mail.send({ to: email, subject: "Vérification de votre adresse TableNow", text: `Votre code de vérification TableNow : ${code}. Il expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.`, html: `<p>Votre code de vérification TableNow : <strong>${code}</strong>.</p><p>Il expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.</p>` });
    } catch {
      await database`update account_challenges set consumed_at=now() where token_hash=${digest(token)}`;
      reply.clearCookie("tn_auth", { path: "/" });
      return reply.code(503).send({ error: { message: "L’envoi du code est indisponible. Réessayez plus tard." } });
    }
    return reply.code(202).send({ stage: "email" });
  }
  app.post("/v1/account/signup", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: passwordSchema, name: z.string().trim().min(1).max(100), rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    return emailRequest(reply, input.email, { purpose: "signup", rememberMe: input.rememberMe, name: input.name, passwordHash: await passwordHash(input.password) });
  });
  app.post("/v1/account/reset", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: passwordSchema, rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    return emailRequest(reply, input.email, { purpose: "reset", rememberMe: input.rememberMe, passwordHash: await passwordHash(input.password) });
  });
  app.post("/v1/account/login", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: z.string().min(1).max(128), rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    const valid = await database.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${input.email}))`;
    const [row] = await tx<{ user_id: string; password_hash: string; locked: boolean }[]>`select c.user_id,c.password_hash,(c.locked_until>now()) as locked from account_credentials c join users u on u.id=c.user_id where u.email=${input.email} and u.status='active'`;
    const matches = await passwordMatches(input.password, row?.password_hash);
    if (!row || row.locked || !matches) {
      if (row && !row.locked) await tx`update account_credentials set failed_attempts=failed_attempts+1, locked_until=case when failed_attempts+1>=10 then now()+interval '15 minutes' else locked_until end where user_id=${row.user_id}`;
      return false;
    }
    await challenge(reply, input.email, "mfa", { purpose: "login", rememberMe: input.rememberMe, userId: row.user_id }, undefined, tx);
    return true;
    });
    return valid ? { stage: "mfa" } : fail(reply);
  });
  app.post("/v1/account/resend", rate, async (request, reply) => {
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const [row] = await database<Challenge[]>`update account_challenges set consumed_at=now() where token_hash=${digest(token)} and stage='email' and consumed_at is null and expires_at>now() and created_at<now()-interval '60 seconds' returning *`;
    if (!row) return fail(reply);
    return emailRequest(reply, row.email, unseal<Payload>(row.payload, secret));
  });
  await registerGoogleRoutes(app, database, async (identity, rememberMe, reply) => {
    await database.begin(async tx => {
      const [linked] = await tx<{ user_id: string; email: string }[]>`select g.user_id,u.email from google_identities g join users u on u.id=g.user_id where g.subject=${identity.sub}`;
      const email = linked?.email || identity.email;
      await tx`select pg_advisory_xact_lock(hashtext(${email}))`;
      const [user] = await tx<{ id: string; status: string }[]>`select id,status from users where email=${email}`;
      if (user && user.status !== "active") throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
      const [credential] = user ? await tx<{ locked: boolean }[]>`select (locked_until>now()) as locked from account_credentials where user_id=${user.id}` : [];
      // Existing accounts must prove their existing TOTP, never enroll a replacement.
      if (user && (!credential || credential.locked)) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
      const [other] = user ? await tx<{ subject: string }[]>`select subject from google_identities where user_id=${user.id}` : [];
      if (other && other.subject !== identity.sub) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
      await challenge(reply, email, user ? "mfa" : "enroll", { purpose: "google", googleSubject: identity.sub, rememberMe,
        ...(user ? { userId: user.id } : { name: identity.name, secret: newTotpSecret() }) }, undefined, tx);
    });
  }, googleExchange);
  app.get("/v1/account/google-continuation", rate, async (request, reply) => {
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const [row] = await database<Challenge[]>`select * from account_challenges where token_hash=${digest(token)} and stage in ('enroll','mfa') and consumed_at is null and expires_at>now() and attempts<5`;
    if (!row) return fail(reply);
    const payload = unseal<Payload>(row.payload, secret);
    if (payload.purpose !== "google") return fail(reply);
    return { stage: row.stage, email: row.email, ...(row.stage === "enroll" ? { secret: payload.secret } : {}) };
  });
  app.post("/v1/account/verify-email", rate, async (request, reply) => {
    const { code } = proofSchema.parse(request.body);
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const result = await database.begin(async tx => {
      const [row] = await tx<Challenge[]>`select * from account_challenges where token_hash=${digest(token)} and stage='email' and consumed_at is null and expires_at>now() and attempts<5 for update`;
      if (!row) return null;
      await tx`update account_challenges set attempts=attempts+1 where token_hash=${row.token_hash}`;
      if (!row.proof_hash || !constantTimeEqual(row.proof_hash, digest(code))) return null;
      const payload = unseal<Payload>(row.payload, secret);
      const [user] = await tx<{ id: string; status: string }[]>`select id,status from users where email=${row.email}`;
      if (user?.status && user.status !== "active") return null;
      const [credentials] = user ? await tx<{ user_id: string }[]>`select user_id from account_credentials where user_id=${user.id}` : [];
      if (payload.purpose === "signup" && user) {
        await tx`update account_challenges set consumed_at=now() where token_hash=${row.token_hash}`;
        return { existing: true };
      }
      if (payload.purpose === "reset" && !user) return null;
      if (user) payload.userId = user.id;
      const stage = credentials ? "mfa" : "enroll";
      if (stage === "enroll") payload.secret = newTotpSecret();
      // Retain the digest for the mail budget; only stage='email' accepts it.
      await tx`update account_challenges set stage=${stage},payload=${seal(payload,secret)},attempts=0,expires_at=now()+interval '10 minutes' where token_hash=${row.token_hash}`;
      return { stage, ...(payload.secret ? { secret: payload.secret } : {}) };
    });
    if (result && "existing" in result) return reply.code(409).send({ error: { code: "ACCOUNT_EXISTS", message: "Cette adresse possède déjà un compte. Connectez-vous, ou utilisez « Mot de passe oublié » pour définir votre mot de passe." } });
    return result || fail(reply);
  });
  app.post("/v1/account/verify-mfa", rate, async (request, reply) => {
    const { code } = proofSchema.parse(request.body);
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const result = await database.begin(async tx => {
      const [identity] = await tx<{ email: string }[]>`select email from account_challenges where token_hash=${digest(token)}`;
      if (!identity) return null;
      // Serialize enrollment, recovery and legacy authentication for one identity.
      await tx`select pg_advisory_xact_lock(hashtext(${identity.email}))`;
      const [row] = await tx<Challenge[]>`select * from account_challenges where token_hash=${digest(token)} and stage in ('enroll','mfa') and consumed_at is null and expires_at>now() and attempts<5 for update`;
      if (!row) return null;
      await tx`update account_challenges set attempts=attempts+1 where token_hash=${row.token_hash}`;
      const payload = unseal<Payload>(row.payload, secret);
      const [credential] = payload.userId ? await tx<{ totp_secret: string; last_totp_step: number; backup_hashes: string[]; locked: boolean }[]>`select totp_secret,last_totp_step,backup_hashes,(locked_until>now()) as locked from account_credentials where user_id=${payload.userId} for update` : [];
      if (payload.googleSubject) {
        await tx`select pg_advisory_xact_lock(hashtext(${`google:${payload.googleSubject}`}))`;
        const [linked] = await tx<{ user_id: string }[]>`select user_id from google_identities where subject=${payload.googleSubject}`;
        if (linked && linked.user_id !== payload.userId) return null;
      }
      if (credential?.locked) return null;
      if (row.stage === "mfa" && !credential) return null;
      if (row.stage === "enroll" && credential) return null;
      const totpSecret = credential ? unseal<string>(credential.totp_secret, secret) : payload.secret!;
      const step = validTotpStep(totpSecret, code, Number(credential?.last_totp_step ?? -1));
      const backupIndex = credential?.backup_hashes.indexOf(digest(code)) ?? -1;
      if (step === null && backupIndex < 0) {
        if (credential) await tx`update account_credentials set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=10 then now()+interval '15 minutes' else locked_until end where user_id=${payload.userId!}`;
        return null;
      }
      let userId = payload.userId;
      let tenantId: string | undefined;
      if (!userId) {
        const [existing] = await tx`select id from users where email=${row.email}`;
        if (existing) return null;
        const [user] = await tx<{ id: string }[]>`insert into users(email,display_name) values (${row.email},${payload.name!}) returning id`;
        userId = user!.id;
        const [tenant] = await tx<{ id: string }[]>`insert into tenants(name,slug) values ('Mon établissement',${`restaurant-${crypto.randomUUID()}`}) returning id`;
        tenantId = tenant!.id;
        await tx`insert into memberships(tenant_id,user_id,role) values (${tenantId},${userId},'owner')`;
        await tx`select set_config('app.tenant_id',${tenantId},true)`;
        await tx`insert into restaurants(tenant_id,name,slug,is_demo) values (${tenantId},'Mon établissement','principal',false)`;
      } else {
        const [membership] = await tx<{ tenant_id: string }[]>`select m.tenant_id from memberships m join tenants t on t.id=m.tenant_id and t.status in ('pilot','active') join users u on u.id=m.user_id and u.status='active' where m.user_id=${userId} order by m.created_at limit 1`;
        if (!membership) return null;
        tenantId = membership.tenant_id;
      }
      const backupCodes = credential ? [] : Array.from({ length: 8 }, () => randomToken(12));
      if (!credential) {
        await tx`insert into account_credentials(user_id,password_hash,totp_secret,last_totp_step,backup_hashes) values (${userId},${payload.passwordHash || null},${seal(totpSecret,secret)},${step!},${tx.json(backupCodes.map(digest))})`;
      } else {
        const hashes = credential.backup_hashes.filter((_, i) => i !== backupIndex);
        await tx`update account_credentials set last_totp_step=${step ?? Number(credential.last_totp_step)},backup_hashes=${tx.json(hashes)},password_hash=coalesce(${payload.passwordHash || null},password_hash),failed_attempts=0,locked_until=null where user_id=${userId}`;
      }
      if (payload.googleSubject) {
        const [other] = await tx<{ subject: string }[]>`select subject from google_identities where user_id=${userId}`;
        if (other && other.subject !== payload.googleSubject) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
        await tx`insert into google_identities(subject,user_id) values (${payload.googleSubject},${userId}) on conflict (subject) do nothing`;
      }
      if (payload.purpose === "reset" || !credential) {
        await tx`delete from sessions where user_id=${userId}`;
        await tx`update account_challenges set consumed_at=now() where email=${row.email} and token_hash<>${row.token_hash}`;
      }
      await tx`update account_challenges set consumed_at=now() where token_hash=${row.token_hash}`;
      await tx`update otp_challenges set consumed_at=now() where email=${row.email} and consumed_at is null`;
      const sessionToken = randomToken(32), csrfToken = randomToken(24);
      const maxAgeSeconds = config.SESSION_TTL_HOURS * 3600;
      await tx`insert into sessions(token_hash,user_id,tenant_id,csrf_hash,ip_hash,user_agent,expires_at) values (${digest(sessionToken)},${userId},${tenantId},${digest(csrfToken)},${digest(request.ip)},${request.headers['user-agent'] || null},${new Date(Date.now()+maxAgeSeconds*1000)})`;
      await tx`select set_config('app.tenant_id',${tenantId},true)`;
      await tx`insert into privacy_preferences(tenant_id,user_id) values (${tenantId},${userId}) on conflict do nothing`;
      await tx`insert into audit_events(tenant_id,actor_id,actor_type,action,resource_type,resource_id) values (${tenantId},${userId},'user',${payload.purpose === 'signup' ? 'auth.registered' : 'auth.mfa_verified'},'user',${userId})`;
      return { sessionToken,csrfToken,maxAgeSeconds,backupCodes,rememberMe: payload.rememberMe ?? true };
    });
    if (!result) return fail(reply);
    setSessionCookies(reply, result);
    reply.clearCookie("tn_auth", { path: "/" });
    return { authenticated: true, backupCodes: result.backupCodes };
  });
}
