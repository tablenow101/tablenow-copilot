import { createDatabase, type EmailSender } from "@tablenow/provider-adapters";
import { buildApp } from "./app.js";
import { getConfig } from "./environment.js";

export function shouldRunPreviewSmoke(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.VERCEL === "1"
    && environment.VERCEL_ENV === "preview"
    && environment.TABLENOW_PREVIEW_SEED === "true";
}

function requireStatus(label: string, actual: number, expected: number): void {
  if (actual !== expected) throw new Error(`${label} returned ${actual}; expected ${expected}`);
}

function sessionCookies(header: string | string[] | undefined): { cookie: string; csrf: string } {
  const values = Array.isArray(header) ? header : header ? [header] : [];
  const pairs = values
    .map((value) => value.split(";", 1)[0])
    .filter((value): value is string => Boolean(value));
  const csrf = pairs.find((value) => value.startsWith("tn_csrf="))?.slice("tn_csrf=".length);
  if (!csrf || !pairs.some((value) => value.startsWith("tn_session="))) {
    throw new Error("Preview login did not return the required session cookies");
  }
  return { cookie: pairs.join("; "), csrf };
}

export async function runPreviewSmoke(environment: NodeJS.ProcessEnv = process.env): Promise<false | "legacy-session" | "registered-account"> {
  if (!shouldRunPreviewSmoke(environment)) return false;
  const config = getConfig();
  const database = createDatabase(config.DATABASE_URL, 1);
  // This in-process infrastructure check captures its injected sender only.
  // It does not certify delivery through the real mail provider.
  let issuedCode: string | undefined;
  const silentEmail: EmailSender = { send: async message => {
    issuedCode = message.text.match(/\b\d{6}\b/)?.[0];
  } };
  const app = await buildApp({ database, email: silentEmail });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    requireStatus("health", health.statusCode, 200);

    const [registered] = await database`select c.user_id from account_credentials c join users u on u.id=c.user_id where u.email=${config.PLATFORM_ADMIN_EMAIL}`;
    const requestCode = await app.inject({
      method: "POST",
      url: "/v1/auth/request-code",
      payload: { email: config.PLATFORM_ADMIN_EMAIL },
    });
    requireStatus("request code", requestCode.statusCode, 202);
    if (registered) {
      if (issuedCode) throw new Error("Registered account unexpectedly received a legacy sign-in code");
      requireStatus("anonymous session", (await app.inject({method:"GET",url:"/v1/auth/session"})).statusCode, 401);
      requireStatus("anonymous workspace", (await app.inject({method:"GET",url:"/v1/workspace"})).statusCode, 401);
      requireStatus("legacy sign-in denied", (await app.inject({method:"POST",url:"/v1/auth/verify-code",payload:{email:config.PLATFORM_ADMIN_EMAIL,code:"000000"}})).statusCode, 400);
      return "registered-account";
    }
    if (!issuedCode) throw new Error("Preview smoke did not receive its generated access code");

    const verifyCode = await app.inject({
      method: "POST",
      url: "/v1/auth/verify-code",
      payload: { email: config.PLATFORM_ADMIN_EMAIL, code: issuedCode },
    });
    requireStatus("verify code", verifyCode.statusCode, 200);
    const cookies = sessionCookies(verifyCode.headers["set-cookie"]);

    const session = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies.cookie } });
    requireStatus("session", session.statusCode, 200);

    const workspace = await app.inject({ method: "GET", url: "/v1/workspace", headers: { cookie: cookies.cookie } });
    requireStatus("workspace", workspace.statusCode, 200);

    const logout = await app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie: cookies.cookie, origin: config.PUBLIC_ORIGIN, "x-csrf-token": cookies.csrf },
    });
    requireStatus("logout", logout.statusCode, 200);

    const revoked = await app.inject({ method: "GET", url: "/v1/auth/session", headers: { cookie: cookies.cookie } });
    requireStatus("revoked session", revoked.statusCode, 401);
    return "legacy-session";
  } finally {
    await app.close();
    await database.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPreviewSmoke()
    .then((ran) => process.stdout.write(ran === "registered-account"
      ? "Preview smoke passed: database, anonymous access denied, legacy email sign-in denied for registered account. Password/TOTP and real email are not tested by this build.\n"
      : ran === "legacy-session" ? "Preview smoke passed: database, injected legacy login, session, workspace, CSRF and logout. Real email and account/TOTP are not tested by this build.\n" : "Preview smoke skipped.\n"))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
