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

export async function runPreviewSmoke(environment: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!shouldRunPreviewSmoke(environment)) return false;
  const config = getConfig();
  if (!config.AUTH_FIXED_OTP) throw new Error("Preview smoke requires an ephemeral AUTH_FIXED_OTP");

  const database = createDatabase(config.DATABASE_URL, 1);
  const silentEmail: EmailSender = { send: async () => undefined };
  const app = await buildApp({ database, email: silentEmail });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    requireStatus("health", health.statusCode, 200);

    const requestCode = await app.inject({
      method: "POST",
      url: "/v1/auth/request-code",
      payload: { email: config.PLATFORM_ADMIN_EMAIL },
    });
    requireStatus("request code", requestCode.statusCode, 202);

    const verifyCode = await app.inject({
      method: "POST",
      url: "/v1/auth/verify-code",
      payload: { email: config.PLATFORM_ADMIN_EMAIL, code: config.AUTH_FIXED_OTP },
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
    return true;
  } finally {
    await app.close();
    await database.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPreviewSmoke()
    .then((ran) => process.stdout.write(ran
      ? "Preview smoke passed: database, login, session, workspace, CSRF and logout.\n"
      : "Preview smoke skipped.\n"))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
}
