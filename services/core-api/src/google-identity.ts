import crypto from "node:crypto";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { z } from "zod";
import { resolveVercelDeployment, tableNowDeploymentTopology } from "@tablenow/contracts";

export const googlePreviewOrigin = tableNowDeploymentTopology.preview.origin;
export const googleProductionOrigin = tableNowDeploymentTopology.production.origin;
export const googleCallbackPath = "/api/v1/oauth/google/callback";
export type GoogleConfig = { clientId: string; clientSecret: string; origin: string };
export type GoogleIdentity = { sub: string; email: string; name: string; emailAuthoritative?: boolean };
export function googleConfiguration(environment: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  const test = environment.APP_ENV === "test" && environment.NODE_ENV === "test" && !environment.VERCEL;
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID, clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (test) return { clientId, clientSecret, origin: "http://localhost:3000" };
  const deployment = resolveVercelDeployment(environment);
  return deployment ? { clientId, clientSecret, origin: deployment.origin } : null;
}
export function googleCallbackConfiguration(config: GoogleConfig, host: string): GoogleConfig | null {
  return new URL(config.origin).host === host ? config : null;
}
export type GoogleExchange = (config: GoogleConfig, code: string, verifier: string, nonce: string) => Promise<GoogleIdentity>;
function client(config: GoogleConfig) {
  return new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.origin + googleCallbackPath,
    transporterOptions: { timeout: 10000, retry: false } });
}
export function googleAuthorizationUrl(config: GoogleConfig, state: string, verifier: string, nonce: string) {
  const url = new URL(client(config).generateAuthUrl({ scope: ["openid", "email", "profile"], access_type: "online", prompt: "select_account",
    state, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: CodeChallengeMethod.S256 }));
  url.searchParams.set("nonce", nonce);
  return url.toString();
}
export const exchangeGoogleCode: GoogleExchange = async (config, code, verifier, nonce) => {
  // Never log upstream errors: they can contain codes, tokens and the client secret.
  try {
    const oauth = client(config);
    const { tokens } = await oauth.getToken({ code, codeVerifier: verifier });
    if (!tokens.id_token) throw new Error();
    const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
    // The official verifier checks signature, issuer, audience and expiry.
    const claims = z.object({ sub: z.string().min(1).max(255), email: z.email().max(254), email_verified: z.literal(true),
      nonce: z.literal(nonce), name: z.string().trim().max(100).optional(), azp: z.string().optional(), hd: z.string().min(1).optional() }).parse(ticket.getPayload());
    if (claims.azp && claims.azp !== config.clientId) throw new Error();
    return { emailAuthoritative: claims.email.toLowerCase().endsWith("@gmail.com") || Boolean(claims.hd), sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name || claims.email.split("@")[0]! };
  } catch { throw new Error("GOOGLE_IDENTITY_FAILED"); }
};
