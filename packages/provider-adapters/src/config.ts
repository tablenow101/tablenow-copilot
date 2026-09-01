import { z } from "zod";
import { createHash } from "node:crypto";

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());
const booleanString = z.preprocess(
  (value) => typeof value === "string" ? value.toLowerCase() === "true" : value,
  z.boolean(),
);

export const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "test", "preview", "production"]).default("development"),
  TABLENOW_STACK_ID: z.enum(["tablenow-v2", "tablenow-v2-test"]).default("tablenow-v2-test"),
  DATABASE_SCOPE: optionalString,
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgres://")).or(z.string().startsWith("postgresql://")),
  PUBLIC_ORIGIN: z.url().default("http://localhost:8080"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  SESSION_SECRET: z.string().min(32),
  OTP_PEPPER: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  OTP_TTL_MINUTES: z.coerce.number().int().min(3).max(30).default(10),
  AUTH_FIXED_OTP: optionalString,
  PLATFORM_ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
  EMAIL_TRANSPORT: z.enum(["smtp", "log"]).default("log"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: booleanString.default(false),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  EMAIL_FROM: z.string().min(3).default("TableNow <access@tablenow.local>"),
  AI_PROVIDER: z.enum(["deterministic", "openai-compatible"]).default("deterministic"),
  AI_BASE_URL: optionalString,
  AI_API_KEY: optionalString,
  AI_MODEL: z.string().default("qwen3:8b"),
  AI_MAX_DAILY_EUR: z.coerce.number().min(0).max(10_000).default(5),
  STORAGE_ENCRYPTION_KEY: optionalString.refine(
    (value) => value === undefined || /^[a-fA-F0-9]{64}$/.test(value),
    "STORAGE_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters",
  ),
  EXPORTS_DIR: z.string().default("/data/exports"),
  COMPUTER_EVIDENCE_DIR: z.string().default("/data/computer-evidence"),
  COMPUTER_SIMULATOR_URL: z.url().default("http://integration-simulator:4200"),
  DATA_RETENTION_MONTHS: z.coerce.number().int().min(1).max(120).default(24),
  TABLENOW_NODE_TOKEN: optionalString,
  TABLENOW_COMPUTER_NODE_TOKEN: optionalString,
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const appEnvironment = environment.APP_ENV
    || (environment.VERCEL_ENV === "preview" ? "preview" : undefined)
    || (environment.VERCEL_ENV === "production" ? "production" : undefined)
    || (environment.NODE_ENV === "test" ? "test" : undefined)
    || (environment.NODE_ENV === "production" ? "production" : "development");
  const publicOrigin = environment.PUBLIC_ORIGIN
    || (environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : undefined);
  const databaseUrl = environment.DATABASE_URL || environment.POSTGRES_URL;
  const previewDefaults = appEnvironment === "preview" && environment.VERCEL === "1" && databaseUrl
    ? vercelPreviewDefaults(databaseUrl, environment.VERCEL_URL || "vercel-preview")
    : {};
  const config = runtimeConfigSchema.parse({
    ...previewDefaults,
    ...environment,
    APP_ENV: appEnvironment,
    ...(publicOrigin ? { PUBLIC_ORIGIN: publicOrigin } : {}),
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  });
  const publicHost = new URL(config.PUBLIC_ORIGIN).hostname.toLowerCase();
  if ((config.APP_ENV === "production" || environment.VERCEL === "1") && config.TABLENOW_STACK_ID !== "tablenow-v2") {
    throw new Error("Production requires TABLENOW_STACK_ID=tablenow-v2");
  }
  if ((config.APP_ENV === "production" || environment.VERCEL === "1") && config.DATABASE_SCOPE !== "tablenow-v2") {
    throw new Error("Production requires DATABASE_SCOPE=tablenow-v2");
  }
  if (config.APP_ENV === "production" && ["app.tablenow.io", "tablenow.io", "www.tablenow.io"].includes(publicHost)) {
    throw new Error("V2 cannot use a V1 or website production origin");
  }
  if (config.APP_ENV === "production" && config.AUTH_FIXED_OTP) {
    throw new Error("AUTH_FIXED_OTP is forbidden in production");
  }
  if (config.APP_ENV === "production" && config.EMAIL_TRANSPORT !== "smtp") {
    throw new Error("Production requires a real SMTP transport");
  }
  if (config.APP_ENV === "production" && !config.STORAGE_ENCRYPTION_KEY) {
    throw new Error("Production requires STORAGE_ENCRYPTION_KEY");
  }
  if (config.EMAIL_TRANSPORT === "smtp" && !config.SMTP_HOST) {
    throw new Error("SMTP_HOST is required when EMAIL_TRANSPORT=smtp");
  }
  return config;
}

function vercelPreviewDefaults(databaseUrl: string, deploymentUrl: string): Partial<RuntimeConfig> {
  const derive = (purpose: string) => createHash("sha256")
    .update(`tablenow-preview:${purpose}:${deploymentUrl}:${databaseUrl}`)
    .digest("hex");
  return {
    SESSION_SECRET: derive("session"),
    OTP_PEPPER: derive("otp"),
    AUTH_FIXED_OTP: "424242",
    PLATFORM_ADMIN_EMAIL: "preview@tablenow.local",
    EMAIL_TRANSPORT: "log",
  };
}
