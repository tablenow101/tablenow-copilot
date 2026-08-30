import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone", "apps", "console");
const staticTarget = path.join(standaloneRoot, ".next", "static");

await mkdir(path.dirname(staticTarget), { recursive: true });
await cp(path.join(root, ".next", "static"), staticTarget, { recursive: true, force: true });

const publicDirectory = path.join(root, "public");
if (await exists(publicDirectory)) {
  await cp(publicDirectory, path.join(standaloneRoot, "public"), { recursive: true, force: true });
}

async function exists(target) {
  try { await stat(target); return true; }
  catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}
