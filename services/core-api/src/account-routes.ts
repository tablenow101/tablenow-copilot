import crypto from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { constantTimeEqual, hashSecret, randomDigits, randomToken, type Database, type EmailSender, type Transaction } from "@tablenow/provider-adapters";
import { getConfig } from "./environment.js";
import { setSessionCookies } from "./auth.js";
import { newTotpSecret, passwordHash, passwordMatches, seal, unseal, validTotpStep } from "./account-crypto.js";
import { registerGoogleRoutes } from "./google-routes.js";
import { registerAccountRecoveryRoutes } from "./account-recovery-routes.js";
import type { GoogleExchange } from "./google-identity.js";

type Payload = { delivery?: "link" | undefined; purpose: "signup" | "reset" | "login" | "google" | "access"; googleSubject?: string; passwordHash?: string; passwordless?: boolean; name?: string | undefined; userId?: string; tenantId?: string; secret?: string; rememberMe?: boolean };
type Challenge = { token_hash: string; email: string; stage: string; payload: string; proof_hash: string | null; attempts: number; expires_at: Date | string; expires_in_seconds?: number };
type ChallengeState = Challenge & { expired: boolean; unavailable: boolean };
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const passwordSchema = z.string().min(15).max(128);
const proofSchema = z.object({ code: z.string().trim().min(6).max(64) }).strict();
const emailProofSchema = proofSchema.extend({ challenge: z.string().min(32).max(128).optional() });

export async function registerAccountRoutes(app: FastifyInstance, database: Database, mail: EmailSender, googleExchange?: GoogleExchange) {
  const config = getConfig();
  const secret = config.SESSION_SECRET;
  const digest = (s: string) => hashSecret(s, secret);
  const challengeMaxAgeSeconds = 600;
  const cookieOptions = { httpOnly: true, secure: new URL(config.PUBLIC_ORIGIN).protocol === "https:", sameSite: "strict" as const, path: "/", maxAge: challengeMaxAgeSeconds };
  const rate = { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } };
  const fail = (reply: FastifyReply) => reply.code(400).send({ error: { code: "ACCOUNT_AUTH_FAILED", message: "Vérifiez vos informations ou recommencez la connexion." } });
  const expired = (reply: FastifyReply) => reply.code(410).send({ error: { code: "ACCOUNT_CHALLENGE_EXPIRED", message: "Cette vérification a expiré. Relancez la connexion pour continuer." } });
  const unavailable = (reply: FastifyReply) => reply.code(400).send({ error: { code: "ACCOUNT_CHALLENGE_UNAVAILABLE", message: "Cette vérification n’est plus disponible. Recommencez la connexion." } });
  const invalidCode = (reply: FastifyReply) => reply.code(400).send({ error: { code: "ACCOUNT_CODE_INVALID", message: "Ce code est incorrect. Vérifiez-le et réessayez." } });
  async function challenge(reply: FastifyReply, email: string, stage: string, payload: Payload, proof?: string, writer: Database | Transaction = database) {
    const token = randomToken(32);
    const [created] = await writer<{ expires_at: Date | string; expires_in_seconds: number }[]>`insert into account_challenges(token_hash,email,stage,payload,proof_hash,expires_at) values (${digest(token)},${email},${stage},${seal(payload,secret)},${proof ? digest(proof) : null},now()+(${challengeMaxAgeSeconds} * interval '1 second')) returning expires_at,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds`;
    reply.setCookie("tn_auth", token, cookieOptions).header("Cache-Control", "no-store");
    return { token, expiresAt: created!.expires_at, expiresInSeconds: Number(created!.expires_in_seconds) };
  }
  async function issueSession(tx: Transaction, userId: string, request: FastifyRequest, rememberMe = true) {
    const [membership] = await tx<{ tenant_id: string }[]>`select m.tenant_id from memberships m join tenants t on t.id=m.tenant_id and t.status in ('pilot','active') join users u on u.id=m.user_id and u.status='active' where m.user_id=${userId} order by m.created_at limit 1`;
    if (!membership) return null;
    const sessionToken = randomToken(32), csrfToken = randomToken(24), maxAgeSeconds = config.SESSION_TTL_HOURS * 3600;
    await tx`insert into sessions(token_hash,user_id,tenant_id,csrf_hash,ip_hash,user_agent,expires_at) values (${digest(sessionToken)},${userId},${membership.tenant_id},${digest(csrfToken)},${digest(request.ip)},${request.headers['user-agent'] || null},${new Date(Date.now()+maxAgeSeconds*1000)})`;
    return { outcome: "authenticated" as const, sessionToken, csrfToken, maxAgeSeconds, rememberMe };
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
  async function emailRequest(reply: FastifyReply, email: string, payload: Payload, redirectTo?: string) {
    const code = payload.delivery === "link" ? randomToken(32) : randomDigits(6);
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
    if (!token) return redirectTo ? reply.redirect(`${config.PUBLIC_ORIGIN}/login?google=email-error`) : reply.code(429).send({ error: { message: "Trop de demandes pour cette adresse. Réessayez dans 15 minutes." } });
    try {
      if (config.EMAIL_TRANSPORT !== "smtp") throw new Error("EMAIL_NOT_CONFIGURED");
      const link = `${config.PUBLIC_ORIGIN}/verify-email#${new URLSearchParams({ challenge: token.token, code })}`;
      const label = payload.purpose === "reset" ? "Confirmer mon nouveau mot de passe" : "Confirmer mon adresse";
      await mail.send(payload.delivery === "link"
        ? { to: email, subject: label + " — TableNow", text: `${label} : ${link}\nCe lien est à usage unique et expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.`, html: `<p>${label} :</p><p><a href="${link.replaceAll("&", "&amp;")}">${label}</a></p><p>Ce lien est à usage unique et expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.</p>` }
        : { to: email, subject: "Votre code de connexion TableNow", text: `Votre code de connexion TableNow : ${code}. Il expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.`, html: `<p>Votre code de connexion TableNow : <strong>${code}</strong>.</p><p>Il expire dans 10 minutes. Si vous n’avez pas demandé cette opération, ignorez ce message.</p>` });
    } catch (caught) {
      const failure = caught && typeof caught === "object" ? caught as { code?: unknown; responseCode?: unknown; command?: unknown } : {};
      app.log.warn({
        event: "account.email_delivery_failed",
        code: typeof failure.code === "string" ? failure.code : "UNKNOWN",
        responseCode: typeof failure.responseCode === "number" ? failure.responseCode : undefined,
        command: typeof failure.command === "string" ? failure.command : undefined,
      }, "Account email delivery failed");
      await database`update account_challenges set consumed_at=now() where token_hash=${digest(token.token)}`;
      reply.clearCookie("tn_auth", { path: "/" });
      return redirectTo ? reply.redirect(`${config.PUBLIC_ORIGIN}/login?google=email-error`) : reply.code(503).send({ error: { code: "ACCOUNT_EMAIL_UNAVAILABLE", message: "L’envoi de l’e-mail est indisponible. Réessayez plus tard." } });
    }
    if (redirectTo) return reply.redirect(redirectTo);
    return reply.code(202).send({ stage: "email", delivery: payload.delivery ?? "code", expiresAt: token.expiresAt, expiresInSeconds: token.expiresInSeconds });
  }
  app.post("/v1/account/signup", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: passwordSchema.optional(), name: z.string().trim().min(1).max(100).optional(), delivery: z.literal("link").optional(), rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    if (input.delivery === "link" && !input.password) return fail(reply);
    return emailRequest(reply, input.email, { delivery: input.delivery, purpose: "signup", rememberMe: input.rememberMe, name: input.name,
      ...(input.password ? { passwordHash: await passwordHash(input.password) } : { passwordless: true }) });
  });
  app.post("/v1/account/access", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema }).strict().parse(request.body);
    return emailRequest(reply, input.email, { purpose: "login", rememberMe: true, passwordless: true });
  });
  app.post("/v1/account/reset", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: passwordSchema, delivery: z.literal("link").optional(), rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    return emailRequest(reply, input.email, { delivery: input.delivery, purpose: "reset", rememberMe: input.rememberMe, passwordHash: await passwordHash(input.password) });
  });
  app.post("/v1/account/login", rate, async (request, reply) => {
    const input = z.object({ email: emailSchema, password: z.string().min(1).max(128).optional(), rememberMe: z.boolean().default(true) }).strict().parse(request.body);
    const password = input.password;
    if (!password) return emailRequest(reply, input.email, { purpose: "login", rememberMe: input.rememberMe, passwordless: true });
    const challengeExpiry = await database.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext(${input.email}))`;
    const [row] = await tx<{ user_id: string; password_hash: string; totp_secret: string | null; locked: boolean }[]>`select c.user_id,c.password_hash,c.totp_secret,(c.locked_until>now()) as locked from account_credentials c join users u on u.id=c.user_id where u.email=${input.email} and u.status='active'`;
    const matches = await passwordMatches(password, row?.password_hash);
    if (!row || row.locked || !matches) {
      if (row && !row.locked) await tx`update account_credentials set failed_attempts=failed_attempts+1, locked_until=case when failed_attempts+1>=10 then now()+interval '15 minutes' else locked_until end where user_id=${row.user_id}`;
      return null;
    }
    if (!row.totp_secret) {
      await tx`update account_credentials set failed_attempts=0,locked_until=null where user_id=${row.user_id}`;
      return issueSession(tx, row.user_id, request, input.rememberMe);
    }
    return challenge(reply, input.email, "mfa", { purpose: "login", rememberMe: input.rememberMe, userId: row.user_id }, undefined, tx);
    });
    if (challengeExpiry && "sessionToken" in challengeExpiry) { setSessionCookies(reply, challengeExpiry); reply.clearCookie("tn_auth", { path: "/" }); return { authenticated: true }; }
    return challengeExpiry ? { stage: "mfa", expiresAt: challengeExpiry.expiresAt, expiresInSeconds: challengeExpiry.expiresInSeconds } : fail(reply);
  });
  app.post("/v1/account/resend", rate, async (request, reply) => {
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const [row] = await database<Challenge[]>`update account_challenges set consumed_at=now() where token_hash=${digest(token)} and stage='email' and consumed_at is null and expires_at>now() and created_at<now()-interval '60 seconds' returning *`;
    if (!row) return fail(reply);
    return emailRequest(reply, row.email, unseal<Payload>(row.payload, secret));
  });
  await registerGoogleRoutes(app, database, async (identity, rememberMe, request, reply, intent) => {
    const result = await database.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${`google:${identity.sub}`}))`;
      const [linked] = await tx<{ user_id: string; email: string }[]>`select g.user_id,u.email from google_identities g join users u on u.id=g.user_id where g.subject=${identity.sub}`;
      const email = linked?.email || identity.email;
      await tx`select pg_advisory_xact_lock(hashtext(${email}))`;
      const [user] = await tx<{ id: string; status: string }[]>`select id,status from users where email=${email}`;
      if (intent === "login" && !linked) return { destination: "/login?google=signup-required" as const };
      // Google is authoritative only for Gmail / verified Workspace. Other addresses
      // must prove mailbox ownership before account creation or linking.
      if (!linked && !identity.emailAuthoritative) return { verifyEmail: true as const };
      if (user && user.status !== "active") throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
      const [other] = user ? await tx<{ subject: string }[]>`select subject from google_identities where user_id=${user.id}` : [];
      if (other && other.subject !== identity.sub) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
      const [credential] = user ? await tx<{ totp_secret: string | null }[]>`select totp_secret from account_credentials where user_id=${user.id}` : [];
      if (credential?.totp_secret) {
        await challenge(reply, email, "mfa", { purpose: "google", userId: user!.id, googleSubject: identity.sub, rememberMe }, undefined, tx);
        return { destination: "/login?google=continue" as const };
      }
      let userId = user?.id;
      let tenantId: string | undefined;
      let onboardingComplete = false;
      if (!userId) {
        const [createdUser] = await tx<{ id: string }[]>`insert into users(email,display_name) values (${email},${identity.name}) returning id`;
        userId = createdUser!.id;
        const [tenant] = await tx<{ id: string }[]>`insert into tenants(name,slug) values ('Mon établissement',${`restaurant-${crypto.randomUUID()}`}) returning id`;
        tenantId = tenant!.id;
        await tx`insert into memberships(tenant_id,user_id,role) values (${tenantId},${userId},'owner')`;
        await tx`select set_config('app.tenant_id',${tenantId},true)`;
        await tx`insert into restaurants(tenant_id,name,slug,is_demo) values (${tenantId},'Mon établissement','principal',false)`;
      } else {
        const [membership] = await tx<{ tenant_id: string; onboarding_complete: boolean }[]>`select m.tenant_id,t.onboarding_complete from memberships m join tenants t on t.id=m.tenant_id and t.status in ('pilot','active') where m.user_id=${userId} order by m.created_at limit 1`;
        if (!membership) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
        tenantId = membership.tenant_id;
        onboardingComplete = membership.onboarding_complete;
      }
      await tx`insert into google_identities(subject,user_id) values (${identity.sub},${userId}) on conflict (subject) do nothing`;
      const sessionToken = randomToken(32), csrfToken = randomToken(24);
      const maxAgeSeconds = config.SESSION_TTL_HOURS * 3600;
      await tx`insert into sessions(token_hash,user_id,tenant_id,csrf_hash,ip_hash,user_agent,expires_at) values (${digest(sessionToken)},${userId},${tenantId},${digest(csrfToken)},${digest(request.ip)},${request.headers['user-agent'] || null},${new Date(Date.now()+maxAgeSeconds*1000)})`;
      await tx`select set_config('app.tenant_id',${tenantId},true)`;
      await tx`insert into privacy_preferences(tenant_id,user_id) values (${tenantId},${userId}) on conflict do nothing`;
      await tx`insert into audit_events(tenant_id,actor_id,actor_type,action,resource_type,resource_id) values (${tenantId},${userId},'user','auth.google_verified','user',${userId})`;
      return { created: !user, sessionToken, csrfToken, maxAgeSeconds, rememberMe, destination: onboardingComplete ? "/dashboard" as const : "/onboarding" as const };
    });
    if ("verifyEmail" in result) {
      await emailRequest(reply, identity.email, { purpose: "google", googleSubject: identity.sub, passwordless: true, rememberMe }, `${config.PUBLIC_ORIGIN}/login?google=continue`);
      return null;
    }
    if (!result.sessionToken) return result.destination;
    setSessionCookies(reply, result);
    reply.clearCookie("tn_auth", { path: "/" });
    if (result.created) {
      try {
        if (config.EMAIL_TRANSPORT !== "smtp") throw new Error("EMAIL_NOT_CONFIGURED");
        await mail.send({ to: identity.email, subject: "Bienvenue sur TableNow", text: `Votre compte TableNow a été créé avec Google. Retrouvez votre espace : ${config.PUBLIC_ORIGIN}/login`, html: `<p>Votre compte TableNow a été créé avec Google.</p><p><a href="${config.PUBLIC_ORIGIN}/login">Ouvrir TableNow</a></p>` });
      } catch { request.log.warn({ event: "auth.welcome_email_failed" }, "Welcome email could not be sent"); }
    }
    return result.destination;
  }, googleExchange);
  // Read-only resume has its own budget; code attempts keep the stricter unchanged limit.
  app.get("/v1/account/continuation", { config: { rateLimit: { max: 30, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const token = request.cookies.tn_auth;
    if (!token) return reply.code(204).send();
    const [row] = await database<ChallengeState[]>`select *,expires_at<=now() as expired,(consumed_at is not null or attempts>=5) as unavailable,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds from account_challenges where token_hash=${digest(token)}`;
    if (!row) return reply.code(204).send();
    if (row.unavailable || !["email", "profile", "enroll", "mfa"].includes(row.stage)) return unavailable(reply);
    if (row.expired) return expired(reply);
    const payload = unseal<Payload>(row.payload, secret);
    // Reading a challenge never rotates its token, enrollment key or expiration.
    return { stage: row.stage, email: row.email, purpose: payload.purpose, rememberMe: payload.rememberMe ?? true,
      expiresAt: row.expires_at, expiresInSeconds: Number(row.expires_in_seconds),
      ...(payload.delivery ? { delivery: payload.delivery } : {}), ...(row.stage === "enroll" ? { secret: payload.secret } : {}) };
  });
  app.get("/v1/account/google-continuation", rate, async (request, reply) => {
    const token = request.cookies.tn_auth;
    if (!token) return fail(reply);
    const [row] = await database<ChallengeState[]>`select *,expires_at<=now() as expired,(consumed_at is not null or attempts>=5) as unavailable,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds from account_challenges where token_hash=${digest(token)} and stage in ('enroll','mfa')`;
    if (!row) return fail(reply);
    if (row.unavailable) return fail(reply);
    if (row.expired) return expired(reply);
    const payload = unseal<Payload>(row.payload, secret);
    if (payload.purpose !== "google") return fail(reply);
    return { stage: row.stage, email: row.email, expiresAt: row.expires_at, expiresInSeconds: Number(row.expires_in_seconds), ...(row.stage === "enroll" ? { secret: payload.secret } : {}) };
  });
  app.post("/v1/account/verify-email", rate, async (request, reply) => {
    const { code, challenge: linkToken } = emailProofSchema.parse(request.body);
    const token = linkToken ?? request.cookies.tn_auth;
    if (!token) return unavailable(reply);
    const result = await database.begin(async tx => {
      const [row] = await tx<ChallengeState[]>`select *,expires_at<=now() as expired,(consumed_at is not null or attempts>=5) as unavailable from account_challenges where token_hash=${digest(token)} and stage='email' for update`;
      if (!row || row.unavailable) return null;
      if (row.expired) return { outcome: "expired" as const };
      await tx`update account_challenges set attempts=attempts+1 where token_hash=${row.token_hash}`;
      if (!row.proof_hash || !constantTimeEqual(row.proof_hash, digest(code))) return { outcome: "invalid" as const };
      const payload = unseal<Payload>(row.payload, secret);
      if (linkToken && payload.delivery !== "link") return null;
      if (payload.passwordless || payload.delivery === "link") {
        await tx`select pg_advisory_xact_lock(hashtext(${row.email}))`;
        const [existingUser] = await tx<{ id: string; status: string }[]>`select id,status from users where email=${row.email}`;
        if (existingUser?.status && existingUser.status !== "active") return null;
        if (payload.purpose === "signup" && existingUser) {
          await tx`update account_challenges set consumed_at=now() where token_hash=${row.token_hash}`;
          return { existing: true };
        }
        if ((payload.purpose === "login" || payload.purpose === "access" || payload.purpose === "reset") && !existingUser) {
          await tx`update account_challenges set consumed_at=now() where token_hash=${row.token_hash}`;
          // Only the proven mailbox owner may learn that signup is required.
          return { signupRequired: true };
        }

        const [credential] = existingUser ? await tx<{ totp_secret: string | null }[]>`select totp_secret from account_credentials where user_id=${existingUser.id}` : [];
        if (credential?.totp_secret) {
          const nextPayload = { ...payload, userId: existingUser!.id };
          const next = await challenge(reply, row.email, "mfa", nextPayload, undefined, tx);
          await tx`update account_challenges set consumed_at=now() where token_hash=${row.token_hash}`;
          return { stage: "mfa", rotatedToken: next.token, expiresAt: next.expiresAt, expiresInSeconds: next.expiresInSeconds };
        }
        if (payload.googleSubject && existingUser) {
          const [other] = await tx<{ subject: string }[]>`select subject from google_identities where user_id=${existingUser.id}`;
          if (other && other.subject !== payload.googleSubject) return null;
        }
        let userId = existingUser?.id;
        let tenantId: string | undefined;
        if (!userId) {
          const [createdUser] = await tx<{ id: string }[]>`insert into users(email,display_name) values (${row.email},${payload.name ?? null}) returning id`;
          userId = createdUser!.id;
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

        if (payload.googleSubject) {
          const [linked] = await tx<{ user_id: string }[]>`select user_id from google_identities where subject=${payload.googleSubject}`;
          if (linked && linked.user_id !== userId) throw new Error("GOOGLE_ACCOUNT_UNAVAILABLE");
          await tx`insert into google_identities(subject,user_id) values (${payload.googleSubject},${userId}) on conflict (subject) do nothing`;
        }
        if (payload.passwordHash) {
          await tx`insert into account_credentials(user_id,password_hash,totp_secret) values (${userId},${payload.passwordHash},null) on conflict (user_id) do update set password_hash=excluded.password_hash,failed_attempts=0,locked_until=null`;
          if (payload.purpose === "reset") await tx`delete from sessions where user_id=${userId}`;
        }
        await tx`update account_challenges set consumed_at=now() where email=${row.email} and consumed_at is null`;
        await tx`update otp_challenges set consumed_at=now() where email=${row.email} and consumed_at is null`;
        const sessionToken = randomToken(32), csrfToken = randomToken(24);
        const maxAgeSeconds = config.SESSION_TTL_HOURS * 3600;
        await tx`insert into sessions(token_hash,user_id,tenant_id,csrf_hash,ip_hash,user_agent,expires_at) values (${digest(sessionToken)},${userId},${tenantId},${digest(csrfToken)},${digest(request.ip)},${request.headers['user-agent'] || null},${new Date(Date.now()+maxAgeSeconds*1000)})`;
        await tx`select set_config('app.tenant_id',${tenantId},true)`;
        await tx`insert into privacy_preferences(tenant_id,user_id) values (${tenantId},${userId}) on conflict do nothing`;
        await tx`insert into audit_events(tenant_id,actor_id,actor_type,action,resource_type,resource_id) values (${tenantId},${userId},'user',${payload.purpose === 'signup' ? 'auth.registered' : 'auth.email_verified'},'user',${userId})`;
        return { outcome: "authenticated" as const, sessionToken, csrfToken, maxAgeSeconds, rememberMe: payload.rememberMe ?? true };
      }
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
      const [advanced] = await tx<{ expires_at: Date | string; expires_in_seconds: number }[]>`update account_challenges set stage=${stage},payload=${seal(payload,secret)},attempts=0,expires_at=now()+(${challengeMaxAgeSeconds} * interval '1 second') where token_hash=${row.token_hash} returning expires_at,greatest(0,ceil(extract(epoch from (expires_at-now()))))::int as expires_in_seconds`;
      return { stage, expiresAt: advanced!.expires_at, expiresInSeconds: Number(advanced!.expires_in_seconds), ...(payload.secret ? { secret: payload.secret } : {}) };
    });
    if (result && "signupRequired" in result) {
      reply.clearCookie("tn_auth", { path: "/" });
      return reply.code(409).send({ error: { code: "ACCOUNT_SIGNUP_REQUIRED", message: "Votre adresse e-mail est vérifiée, mais aucun compte TableNow n’y est associé. Inscrivez-vous pour créer votre compte." } });
    }
    if (result && "existing" in result) return reply.code(409).send({ error: { code: "ACCOUNT_EXISTS", message: "Cette adresse possède déjà un compte. Connectez-vous ou utilisez « Mot de passe oublié ? »." } });
    if (result?.outcome === "authenticated" && "sessionToken" in result) {
      setSessionCookies(reply, { sessionToken: result.sessionToken, csrfToken: result.csrfToken, maxAgeSeconds: result.maxAgeSeconds, rememberMe: result.rememberMe });
      reply.clearCookie("tn_auth", { path: "/" });
      return { authenticated: true };
    }
    if (result && "outcome" in result) return result.outcome === "expired" ? expired(reply) : invalidCode(reply);
    if (result && "rotatedToken" in result) {
      reply.setCookie("tn_auth", result.rotatedToken, { ...cookieOptions, maxAge: result.expiresInSeconds });
      return { stage: result.stage, expiresAt: result.expiresAt, expiresInSeconds: result.expiresInSeconds };
    }
    if (result) reply.setCookie("tn_auth", token, { ...cookieOptions, maxAge: "expiresInSeconds" in result ? result.expiresInSeconds : challengeMaxAgeSeconds }).header("Cache-Control", "no-store");
    return result || unavailable(reply);
  });
  app.post("/v1/account/complete-profile", rate, async (request, reply) => {
    // Compatibility for email proofs verified before this deployment; no new profile challenge is created.
    const { name } = z.object({ name: z.string().trim().min(1).max(100).optional() }).strict().parse(request.body);
    const token = request.cookies.tn_auth;
    if (!token) return unavailable(reply);
    const result = await database.begin(async tx => {
      const [row] = await tx<ChallengeState[]>`select *,expires_at<=now() as expired,(consumed_at is not null or attempts>=5) as unavailable from account_challenges where token_hash=${digest(token)} and stage='profile' for update`;
      if (!row || row.unavailable) return null;
      if (row.expired) return { outcome: "expired" as const };
      const payload = unseal<Payload>(row.payload, secret);
      if (payload.purpose !== "access") return null;
      await tx`select pg_advisory_xact_lock(hashtext(${row.email}))`;
      const [existingUser] = await tx<{ id: string; status: string }[]>`select id,status from users where email=${row.email}`;
      if (existingUser?.status && existingUser.status !== "active") return null;
      if (existingUser) {
        const [credential] = await tx<{ totp_secret: string | null }[]>`select totp_secret from account_credentials where user_id=${existingUser.id}`;
        if (credential?.totp_secret) return null;
      }
      let userId = existingUser?.id;
      let tenantId: string | undefined;
      let created = false;
      if (!userId) {
        const [user] = await tx<{ id: string }[]>`insert into users(email,display_name) values (${row.email},${name ?? null}) returning id`;
        userId = user!.id;
        const [tenant] = await tx<{ id: string }[]>`insert into tenants(name,slug) values ('Mon établissement',${`restaurant-${crypto.randomUUID()}`}) returning id`;
        tenantId = tenant!.id;
        await tx`insert into memberships(tenant_id,user_id,role) values (${tenantId},${userId},'owner')`;
        await tx`select set_config('app.tenant_id',${tenantId},true)`;
        await tx`insert into restaurants(tenant_id,name,slug,is_demo) values (${tenantId},'Mon établissement','principal',false)`;
        created = true;
      } else {
        const [membership] = await tx<{ tenant_id: string }[]>`select m.tenant_id from memberships m join tenants t on t.id=m.tenant_id and t.status in ('pilot','active') where m.user_id=${userId} order by m.created_at limit 1`;
        if (!membership) return null;
        tenantId = membership.tenant_id;
      }
      await tx`update account_challenges set consumed_at=now() where email=${row.email} and consumed_at is null`;
      await tx`update otp_challenges set consumed_at=now() where email=${row.email} and consumed_at is null`;
      const sessionToken = randomToken(32), csrfToken = randomToken(24);
      const maxAgeSeconds = config.SESSION_TTL_HOURS * 3600;
      await tx`insert into sessions(token_hash,user_id,tenant_id,csrf_hash,ip_hash,user_agent,expires_at) values (${digest(sessionToken)},${userId},${tenantId},${digest(csrfToken)},${digest(request.ip)},${request.headers['user-agent'] || null},${new Date(Date.now()+maxAgeSeconds*1000)})`;
      await tx`select set_config('app.tenant_id',${tenantId},true)`;
      await tx`insert into privacy_preferences(tenant_id,user_id) values (${tenantId},${userId}) on conflict do nothing`;
      await tx`insert into audit_events(tenant_id,actor_id,actor_type,action,resource_type,resource_id) values (${tenantId},${userId},'user',${created ? 'auth.registered' : 'auth.email_verified'},'user',${userId})`;
      return { outcome: "authenticated" as const, sessionToken, csrfToken, maxAgeSeconds, rememberMe: true };
    });
    if (result?.outcome === "expired") return expired(reply);
    if (!result || !("sessionToken" in result)) return unavailable(reply);
    setSessionCookies(reply, result);
    reply.clearCookie("tn_auth", { path: "/" });
    return { authenticated: true };
  });
  app.post("/v1/account/verify-mfa", rate, async (request, reply) => {
    const { code } = proofSchema.parse(request.body);
    const token = request.cookies.tn_auth;
    if (!token) return unavailable(reply);
    const result = await database.begin(async tx => {
      const [identity] = await tx<{ email: string }[]>`select email from account_challenges where token_hash=${digest(token)}`;
      if (!identity) return null;
      // Serialize enrollment, recovery and legacy authentication for one identity.
      await tx`select pg_advisory_xact_lock(hashtext(${identity.email}))`;
      const [row] = await tx<ChallengeState[]>`select *,expires_at<=now() as expired,(consumed_at is not null or attempts>=5) as unavailable from account_challenges where token_hash=${digest(token)} and stage in ('enroll','mfa') for update`;
      if (!row) return null;
      if (row.unavailable) return null;
      if (row.expired) return { outcome: "expired" as const };
      await tx`update account_challenges set attempts=attempts+1 where token_hash=${row.token_hash}`;
      const payload = unseal<Payload>(row.payload, secret);
      const [credential] = payload.userId ? await tx<{ totp_secret: string; last_totp_step: number; backup_hashes: string[]; locked: boolean }[]>`select totp_secret,last_totp_step,backup_hashes,(locked_until>now()) as locked from account_credentials where user_id=${payload.userId} for update` : [];
      if (payload.googleSubject) {
        await tx`select pg_advisory_xact_lock(hashtext(${`google:${payload.googleSubject}`}))`;
        const [linked] = await tx<{ user_id: string }[]>`select user_id from google_identities where subject=${payload.googleSubject}`;
        if (linked && linked.user_id !== payload.userId) return null;
      }
      if (credential?.locked) return null;
      if (row.stage === "mfa" && !credential?.totp_secret) return null;
      if (row.stage === "enroll" && credential) return null;
      const totpSecret = credential ? unseal<string>(credential.totp_secret, secret) : payload.secret!;
      const step = validTotpStep(totpSecret, code, Number(credential?.last_totp_step ?? -1));
      const backupIndex = credential?.backup_hashes.indexOf(digest(code)) ?? -1;
      if (step === null && backupIndex < 0) {
        if (credential) await tx`update account_credentials set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=10 then now()+interval '15 minutes' else locked_until end where user_id=${payload.userId!}`;
        return { outcome: "invalid" as const };
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
      return { outcome: "authenticated" as const,sessionToken,csrfToken,maxAgeSeconds,backupCodes,rememberMe: payload.rememberMe ?? true };
    });
    if (result?.outcome === "expired") return expired(reply);
    if (result?.outcome === "invalid") return invalidCode(reply);
    if (!result) return unavailable(reply);
    setSessionCookies(reply, result);
    reply.clearCookie("tn_auth", { path: "/" });
    return { authenticated: true, backupCodes: result.backupCodes };
  });
  await registerAccountRecoveryRoutes(app, database);
}
