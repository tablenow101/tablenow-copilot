import { seed } from "./seed.js";
import { resolveVercelDeployment, tableNowDeploymentTopology } from "@tablenow/contracts";

export function shouldSeedPreview(environment: NodeJS.ProcessEnv = process.env): boolean {
  return resolveVercelDeployment(environment) === tableNowDeploymentTopology.preview
    && environment.TABLENOW_PREVIEW_SEED === "true";
}

export async function seedPreview(environment: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (!shouldSeedPreview(environment)) return false;
  await seed();
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeded = await seedPreview();
  process.stdout.write(seeded ? "Preview pilot workspace is current.\n" : "Preview pilot seed skipped.\n");
}
