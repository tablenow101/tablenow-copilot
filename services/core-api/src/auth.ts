import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import type { Database } from "@tablenow/provider-adapters";
import { constantTimeEqual, hashSecret } from "@tablenow/provider-adapters";
import { hasPermission, type Permission } from "@tablenow/domain";
import type { AuthActor } from "./types.js";
import { getConfig } from "./environment.js";

const sessionCookie = "tn_session";
const csrfCookie = "tn_csrf";

export const cookieNames = { sessionCookie, csrfCookie } as const;

export function authGuard(database: Database, permission?: Permission): preHandlerHookHandler {
  return async (request, reply) => {
    const config = getConfig();
    const actor = await resolveActor(database, request);
    if (!actor) {
      return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Connexion requise." } });
    }
    if (permission && !hasPermission(actor.role, permission)) {
      return reply.code(403).send({ error: { code: "FORBIDDEN", message: "Cette action n'est pas autorisée pour votre rôle." } });
    }
    if (actor.actorType === "user" && isMutation(request.method)) {
      const csrfHeader = request.headers["x-csrf-token"];
      const csrfValue = Array.isArray(csrfHeader) ? csrfHeader[0] : csrfHeader;
      const csrfCookieValue = request.cookies[csrfCookie];
      if (!csrfValue || !csrfCookieValue || csrfValue !== csrfCookieValue || !actor.csrfHash) {
        return reply.code(403).send({ error: { code: "CSRF_INVALID", message: "La session de sécurité a expiré." } });
      }
      const csrfHash = hashSecret(csrfValue, config.SESSION_SECRET);
      if (!constantTimeEqual(csrfHash, actor.csrfHash)) {
        return reply.code(403).send({ error: { code: "CSRF_INVALID", message: "La session de sécurité a expiré." } });
      }
    }
    request.actor = actor;
  };
}

export async function resolveActor(database: Database, request: FastifyRequest): Promise<AuthActor | null> {
  const config = getConfig();
  const cookieToken = request.cookies[sessionCookie];
  if (cookieToken) {
    const tokenHash = hashSecret(cookieToken, config.SESSION_SECRET);
    const [row] = await database<{
      user_id: string;
      tenant_id: string;
      csrf_hash: string;
      email: string;
      display_name: string | null;
      role: AuthActor["role"];
      tenant_name: string;
      tenant_slug: string;
      onboarding_complete: boolean;
    }[]>`
      select s.user_id, s.tenant_id, s.csrf_hash, u.email, u.display_name,
        m.role, t.name as tenant_name, t.slug as tenant_slug, t.onboarding_complete
      from sessions s
      join users u on u.id = s.user_id and u.status = 'active'
      join memberships m on m.user_id = s.user_id and m.tenant_id = s.tenant_id
      join tenants t on t.id = s.tenant_id and t.status in ('pilot', 'active')
      where s.token_hash = ${tokenHash} and s.expires_at > now()
    `;
    if (!row) return null;
    await database`update sessions set last_seen_at = now() where token_hash = ${tokenHash} and last_seen_at < now() - interval '5 minutes'`;
    return {
      actorType: "user",
      actorId: row.user_id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      role: row.role,
      email: row.email,
      displayName: row.display_name,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      onboardingComplete: row.onboarding_complete,
      csrfHash: row.csrf_hash,
    };
  }

  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    const tokenHash = hashSecret(token, config.SESSION_SECRET);
    const [row] = await database<{
      id: string;
      tenant_id: string;
      tenant_name: string;
      tenant_slug: string;
      onboarding_complete: boolean;
    }[]>`
      select n.id, n.tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.onboarding_complete
      from node_credentials n
      join tenants t on t.id = n.tenant_id and t.status in ('pilot', 'active')
      where n.token_hash = ${tokenHash} and n.status = 'active'
    `;
    if (!row) return null;
    await database`update node_credentials set last_seen_at = now() where id = ${row.id}`;
    return {
      actorType: "node",
      actorId: row.id,
      userId: null,
      tenantId: row.tenant_id,
      role: "operator",
      email: null,
      displayName: "TableNow Node",
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      onboardingComplete: row.onboarding_complete,
      csrfHash: null,
    };
  }
  return null;
}

export function setSessionCookies(reply: FastifyReply, values: { sessionToken: string; csrfToken: string; maxAgeSeconds: number }): void {
  const config = getConfig();
  // A restaurant node may intentionally run on an isolated HTTP LAN. Cloud
  // deployments use HTTPS and therefore receive Secure cookies automatically.
  const secure = new URL(config.PUBLIC_ORIGIN).protocol === "https:";
  reply.setCookie(sessionCookie, values.sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: values.maxAgeSeconds,
  });
  reply.setCookie(csrfCookie, values.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: values.maxAgeSeconds,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(sessionCookie, { path: "/" });
  reply.clearCookie(csrfCookie, { path: "/" });
}

export function assertAllowedOrigin(request: FastifyRequest): boolean {
  if (!isMutation(request.method) || !request.cookies[sessionCookie]) return true;
  const origin = request.headers.origin;
  if (!origin) return false;
  const configuredOrigins = new Set([getConfig().PUBLIC_ORIGIN, "http://localhost:3000", "http://localhost:8080"]);
  if (configuredOrigins.has(origin)) return true;

  try {
    const originUrl = new URL(origin);
    if (!["http:", "https:"].includes(originUrl.protocol)) return false;
    const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
    const requestHost = forwardedHost || firstHeaderValue(request.headers.host);
    if (!requestHost || originUrl.host.toLowerCase() !== requestHost.toLowerCase()) return false;
    const forwardedProtocol = firstHeaderValue(request.headers["x-forwarded-proto"]);
    return !forwardedProtocol || `${forwardedProtocol.toLowerCase()}:` === originUrl.protocol;
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(",", 1)[0]?.trim();
}

function isMutation(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}
