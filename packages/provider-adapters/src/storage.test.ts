import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileEvidenceStore, FileExportStore } from "./storage.js";

const roots: string[] = [];
const key = "a".repeat(64);
const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("encrypted file stores", () => {
  it("encrypts evidence at rest and returns the original PNG", async () => {
    const root = await temporaryRoot();
    const store = new FileEvidenceStore(root, key);
    const saved = await store.putPng("tenant-1", "run-1", 1, tinyPng);
    const raw = await readFile(path.join(root, saved.storageKey));
    expect(raw.subarray(0, 6).toString("ascii")).toBe("TNENC1");
    expect(await store.get(saved.storageKey)).toEqual(tinyPng);
  });

  it("encrypts privacy exports and rejects traversal keys", async () => {
    const root = await temporaryRoot();
    const store = new FileExportStore(root, key);
    const storageKey = await store.put("tenant-1", "request-1", { email: "owner@example.test" });
    expect((await readFile(path.join(root, storageKey))).includes(Buffer.from("owner@example.test"))).toBe(false);
    expect(JSON.parse((await store.get(storageKey)).toString("utf8"))).toEqual({ email: "owner@example.test" });
    await expect(store.get("../../etc/passwd")).rejects.toThrow("INVALID_STORAGE_KEY");
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "tablenow-storage-"));
  roots.push(root);
  return root;
}
