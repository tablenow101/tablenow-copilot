import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { hashSecret, randomToken, type Database } from "@tablenow/provider-adapters";
import { getConfig } from "./environment.js";
import { seal, unseal } from "./account-crypto.js";
import { exchangeGoogleCode, googleAuthorizationUrl, googleConfiguration, googleCallbackConfiguration, type GoogleExchange, type GoogleIdentity } from "./google-identity.js";

type Attempt = { verifier: string; nonce: string; rememberMe: boolean; origin?: string };
type BeginAccount = (identity: GoogleIdentity, rememberMe: boolean, reply: FastifyReply) => Promise<void>;
export async function registerGoogleRoutes(app: FastifyInstance, database: Database, beginAccount: BeginAccount, exchange: GoogleExchange = exchangeGoogleCode) {
  const config = googleConfiguration();
  const secret = getConfig().SESSION_SECRET;
  const digest = (value: string) => hashSecret(value, secret);
  const rate = { logLevel: "silent" as const, config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } };
  const cookies = { httpOnly: true, secure: config?.origin.startsWith("https:") ?? true, sameSite: "lax" as const, path: "/api/v1/oauth/google", maxAge: 600 };
  app.get("/v1/oauth/google/config", async (_, reply) => reply.header("Cache-Control", "no-store").send({ enabled: !!config, startUrl: config ? `${config.origin}/api/v1/oauth/google/start` : null }));
  app.get("/v1/oauth/google/start", rate, async (request, reply) => {
    reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
    if (!config) return reply.code(503).send({ error: { message: "La connexion Google est indisponible." } });
    const input = z.object({ remember: z.enum(["0", "1"]).default("1") }).parse(request.query);
    const host = String(request.headers["x-forwarded-host"] || request.headers.host).split(",")[0]!.trim();
    if (host !== new URL(config.origin).host) return reply.redirect(`${config.origin}/api/v1/oauth/google/start?remember=${input.remember}`);
    const state = randomToken(32), browser = randomToken(32), verifier = randomToken(48), nonce = randomToken(32);
    await database`delete from google_login_attempts where expires_at < now()`;
    await database`insert into google_login_attempts(state_hash,browser_hash,payload) values (${digest(state)},${digest(browser)},${seal({ verifier, nonce, rememberMe: input.remember === "1", origin: config.origin }, secret)})`;
    reply.setCookie("tn_google", browser, cookies);
    return reply.redirect(googleAuthorizationUrl(config, state, verifier, nonce));
  });
  app.get("/v1/oauth/google/callback", rate, async (request, reply) => {
    reply.header("Cache-Control", "no-store").header("Referrer-Policy", "no-referrer");
    if (!config) return reply.code(503).send({ error: { message: "La connexion Google est indisponible." } });
    reply.clearCookie("tn_google", { path: cookies.path });
    try {
      const host = String(request.headers["x-forwarded-host"] || request.headers.host).split(",")[0]!.trim();
      const callbackConfig = googleCallbackConfiguration(config, host);
      if (!callbackConfig) throw new Error();
      const input = z.object({ state: z.string().min(32).max(256), code: z.string().min(1).max(4096).optional(), error: z.string().max(256).optional() }).parse(request.query);
      const browser = request.cookies.tn_google;
      if (!browser) throw new Error();
      // Consume atomically before the external exchange, including cancelled logins.
      const [row] = await database<{ payload: string }[]>`delete from google_login_attempts where state_hash=${digest(input.state)} and browser_hash=${digest(browser)} and expires_at>now() returning payload`;
      if (!row || input.error || !input.code) throw new Error();
      const attempt = unseal<Attempt>(row.payload, secret);
      const attemptOrigin = attempt.origin ?? config.origin;
      if (attemptOrigin !== callbackConfig.origin) throw new Error();
      const identity = await exchange(callbackConfig, input.code, attempt.verifier, attempt.nonce);
      await beginAccount(identity, attempt.rememberMe, reply);
      return reply.redirect(`${callbackConfig.origin}/login?google=continue`);
    } catch {
      // Fixed destination and fixed error: no provider response or secret in URLs/logs.
      return reply.redirect(`${config.origin}/login?google=error`);
    }
  });
}
