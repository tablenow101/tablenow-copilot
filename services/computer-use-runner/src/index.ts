import "dotenv/config";
import { z } from "zod";
import { NodeClient } from "./client.js";
import { executeOpenAIComputerWorkflow } from "./openai-computer-engine.js";
import { executePlaywrightWorkflow } from "./playwright-engine.js";
import { RunReporter } from "./reporter.js";
import type { ClaimedRun, RunnerConfig, RunResult } from "./types.js";

const optionalString = z.preprocess((value) => value === "" ? undefined : value, z.string().optional());
const booleanString = z.preprocess((value) => typeof value === "string" ? value.toLowerCase() === "true" : value, z.boolean());
const configSchema = z.object({
  COMPUTER_RUNNER_API_URL: z.url().default("http://core-api:4000"),
  TABLENOW_COMPUTER_NODE_TOKEN: z.string().min(32),
  COMPUTER_PROFILE_ROOT: z.string().default("/data/browser-profiles"),
  COMPUTER_CHROMIUM_PATH: optionalString,
  COMPUTER_HEADLESS: booleanString.default(true),
  COMPUTER_POLL_MS: z.coerce.number().int().min(250).max(60_000).default(2_000),
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_COMPUTER_MODEL: z.string().min(2).default("gpt-5.6"),
  COMPUTER_MAX_MODEL_STEPS: z.coerce.number().int().min(1).max(80).default(30),
});

const environment = configSchema.parse(process.env);
const config: RunnerConfig = {
  apiUrl: environment.COMPUTER_RUNNER_API_URL.replace(/\/$/, ""),
  nodeToken: environment.TABLENOW_COMPUTER_NODE_TOKEN,
  profileRoot: environment.COMPUTER_PROFILE_ROOT,
  headless: environment.COMPUTER_HEADLESS,
  pollMs: environment.COMPUTER_POLL_MS,
  openAiModel: environment.OPENAI_COMPUTER_MODEL,
  maxModelSteps: environment.COMPUTER_MAX_MODEL_STEPS,
  openAiBaseUrl: environment.OPENAI_BASE_URL,
  ...(environment.COMPUTER_CHROMIUM_PATH ? { chromiumPath: environment.COMPUTER_CHROMIUM_PATH } : {}),
  ...(environment.OPENAI_API_KEY ? { openAiApiKey: environment.OPENAI_API_KEY } : {}),
};

const client = new NodeClient(config);
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

await client.heartbeat();
const heartbeatTimer = setInterval(() => {
  void client.heartbeat().catch((error) => process.stderr.write(`[computer-runner] heartbeat: ${safeError(error)}\n`));
}, 30_000);
while (!stopping) {
  try {
    const run = await client.claim();
    if (!run) {
      await sleep(config.pollMs);
      continue;
    }
    await execute(run);
  } catch (error) {
    process.stderr.write(`[computer-runner] ${safeError(error)}\n`);
    await sleep(Math.max(config.pollMs, 2_000));
  }
}
clearInterval(heartbeatTimer);

async function execute(run: ClaimedRun): Promise<void> {
  const reporter = new RunReporter(client, run);
  await reporter.event("run_started", `Exécution locale démarrée : ${run.workflow.name}`, "info", { engine: run.workflow.definition.engine });
  let result: RunResult;
  if (run.workflow.definition.engine === "playwright") {
    result = await executePlaywrightWorkflow(run, config, client, reporter);
  } else {
    result = await executeOpenAIComputerWorkflow(run, config, client, reporter);
  }
  await client.complete(run, result);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function safeError(error: unknown): string {
  if (!(error instanceof Error)) return "UNKNOWN_RUNNER_ERROR";
  return error.message.replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]").slice(0, 500);
}
