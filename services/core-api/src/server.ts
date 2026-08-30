import { buildApp } from "./app.js";
import { getConfig } from "./environment.js";

const app = await buildApp();
const config = getConfig();

const close = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => void close("SIGINT"));
process.once("SIGTERM", () => void close("SIGTERM"));

await app.listen({ host: "0.0.0.0", port: config.API_PORT });
