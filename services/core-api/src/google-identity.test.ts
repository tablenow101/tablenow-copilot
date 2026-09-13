import crypto from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { CertificateFormat } from "google-auth-library/build/src/auth/oauth2client.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeGoogleCode } from "./google-identity.js";

const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const config = { clientId: "fixture.apps.googleusercontent.com", clientSecret: "fixture-secret-not-real", origin: "http://localhost:3000" };
function token(changes: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now()/1000);
  const body = [ { alg: "RS256", kid: "fixture" }, { sub: "google-sub", aud: config.clientId, iss: "https://accounts.google.com", iat: now, exp: now + 3600, email: "owner@gmail.com", email_verified: true, nonce: "fixture-nonce", ...changes } ].map(v => Buffer.from(JSON.stringify(v)).toString("base64url")).join(".");
  return `${body}.${crypto.sign("RSA-SHA256", Buffer.from(body), keys.privateKey).toString("base64url")}`;
}
function transport(jwt: string) {
  vi.spyOn(OAuth2Client.prototype, "getToken").mockResolvedValue({ tokens: { id_token: jwt } } as never);
  vi.spyOn(OAuth2Client.prototype, "getFederatedSignonCertsAsync").mockResolvedValue({ certs: { fixture: keys.publicKey.export({ type: "spki", format: "pem" }).toString() }, format: CertificateFormat.PEM });
}
afterEach(() => vi.restoreAllMocks());
describe("Google identity verification with the official JWT verifier", () => {
  it("accepts a signed, intended, verified identity", async () => {
    transport(token());
    expect(await exchangeGoogleCode(config, "fixture-code", "fixture-verifier", "fixture-nonce")).toMatchObject({ sub: "google-sub", email: "owner@gmail.com" });
    expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith({ code: "fixture-code", codeVerifier: "fixture-verifier" });
  });
  it.each([{ aud: "other-client" }, { iss: "https://attacker.test" }, { exp: 1 }, { nonce: "other-nonce" }, { email_verified: false }, { sub: "" }, { azp: "other-client" }])("rejects invalid claims %j", async changes => {
    transport(token(changes));
    await expect(exchangeGoogleCode(config, "fixture-code", "fixture-verifier", "fixture-nonce")).rejects.toThrow("GOOGLE_IDENTITY_FAILED");
  });
  it("rejects a tampered signature and never exposes upstream credentials in its error", async () => {
    transport(token().replace(/\.[^.]+$/, ".invalid"));
    await expect(exchangeGoogleCode(config, "fixture-code", "fixture-verifier", "fixture-nonce")).rejects.toThrow("GOOGLE_IDENTITY_FAILED");
    vi.mocked(OAuth2Client.prototype.getToken).mockRejectedValue(new Error("upstream echoed fixture-secret-not-real"));
    await expect(exchangeGoogleCode(config, "fixture-code", "fixture-verifier", "fixture-nonce")).rejects.toThrow(/^GOOGLE_IDENTITY_FAILED$/);
  });
});
