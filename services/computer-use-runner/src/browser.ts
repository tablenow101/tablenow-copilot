import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page, type Route } from "playwright-core";
import type { ClaimedRun, RunnerConfig } from "./types.js";
import { assertAllowedUrl, safeProfilePath, SecurityBlockError } from "./safety.js";

export interface RestrictedBrowser {
  context: BrowserContext;
  page: Page;
}

export async function launchRestrictedBrowser(run: ClaimedRun, config: RunnerConfig): Promise<RestrictedBrowser> {
  if (run.connection.surface !== "browser") {
    throw new SecurityBlockError("DESKTOP_RUNTIME_NOT_CONFIGURED", "Cette connexion nécessite un environnement de bureau local dédié.");
  }
  const profilePath = safeProfilePath(config.profileRoot, run.connection.credentialRef);
  await mkdir(profilePath, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(profilePath, {
    acceptDownloads: false,
    args: ["--disable-extensions", "--disable-file-system", "--disable-dev-shm-usage"],
    chromiumSandbox: typeof process.getuid === "function" ? process.getuid() !== 0 : true,
    env: {},
    headless: config.headless,
    ignoreHTTPSErrors: false,
    permissions: [],
    serviceWorkers: "block",
    viewport: { width: 1280, height: 800 },
    ...(config.chromiumPath ? { executablePath: config.chromiumPath } : {}),
  });
  context.setDefaultTimeout(12_000);
  context.setDefaultNavigationTimeout(25_000);
  await context.route("**/*", (route) => restrictRoute(route, run.connection.allowedHosts));
  const attach = (page: Page) => {
    page.on("download", (download) => void download.cancel());
  };
  context.pages().forEach(attach);
  context.on("page", attach);
  const page = context.pages()[0] || await context.newPage();
  return { context, page };
}

export function assertCurrentPageAllowed(page: Page, allowedHosts: string[]): void {
  if (page.url() === "about:blank") return;
  assertAllowedUrl(page.url(), allowedHosts);
}

function restrictRoute(route: Route, allowedHosts: string[]): Promise<void> {
  const value = route.request().url();
  const protocol = safeProtocol(value);
  if (["about:", "blob:", "data:"].includes(protocol)) return route.continue();
  try {
    assertAllowedUrl(value, allowedHosts);
    return route.continue();
  } catch {
    return route.abort("blockedbyclient");
  }
}

function safeProtocol(value: string): string {
  try {
    return new URL(value).protocol;
  } catch {
    return "invalid:";
  }
}
