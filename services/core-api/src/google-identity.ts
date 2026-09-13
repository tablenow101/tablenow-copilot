import crypto from "node:crypto";
import { OAuth2Client, CodeChallengeMethod } from "google-auth-library";
import { z } from "zod";

export const googlePreviewOrigin = "https://tablenow-copilot-v2-git-product-stitch-funct-786bbe-tablenow101.vercel.app";
export const googleCallbackPath = "/api/v1/oauth/google/callback";
export type GoogleConfig = { clientId: string; clientSecret: string; origin: string };
export type GoogleIdentity = { sub: string; email: string; name: string };
export function googleConfiguration(environment: NodeJS.ProcessEnv = process.env): GoogleConfig | null {
  const preview = (environment.APP_ENV || environment.VERCEL_ENV) === "preview";
  const test = environment.APP_ENV === "test" && environment.NODE_ENV === "test" && !environment.VERCEL;
  if (!preview && !test) return null;
  if (environment.VERCEL && (environment.VERCEL_ENV !== "preview" || environment.VERCEL_GIT_COMMIT_REF !== "product/stitch-functional-owner")) return null;
  const clientId = environment.GOOGLE_OAUTH_CLIENT_ID, clientSecret = environment.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, origin: test ? "http://localhost:3000" : googlePreviewOrigin };
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
      nonce: z.literal(nonce), name: z.string().trim().max(100).optional(), azp: z.string().optional() }).parse(ticket.getPayload());
    if (claims.azp && claims.azp !== config.clientId) throw new Error();
    return { sub: claims.sub, email: claims.email.toLowerCase(), name: claims.name || claims.email.split("@")[0]! };
  } catch { throw new Error("GOOGLE_IDENTITY_FAILED"); }
};
