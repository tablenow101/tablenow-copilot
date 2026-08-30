import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { loadRuntimeConfig } from "@tablenow/provider-adapters";

const candidates = [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
].filter((value): value is string => Boolean(value));

for (const candidate of candidates) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate, quiet: true });
    break;
  }
}

let runtimeConfig: ReturnType<typeof loadRuntimeConfig> | undefined;

export function getConfig(): ReturnType<typeof loadRuntimeConfig> {
  runtimeConfig ||= loadRuntimeConfig();
  return runtimeConfig;
}
