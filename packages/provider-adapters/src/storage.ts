import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

export interface ExportStore {
  put(tenantId: string, requestId: string, payload: unknown): Promise<string>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export interface EvidenceStore {
  putPng(tenantId: string, runId: string, sequence: number, png: Buffer): Promise<{ storageKey: string; sha256: string }>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

export class FileEvidenceStore implements EvidenceStore {
  private readonly cipher: StorageCipher;

  public constructor(private readonly root: string, encryptionKey?: string) {
    this.cipher = new StorageCipher(encryptionKey);
  }

  public async putPng(tenantId: string, runId: string, sequence: number, png: Buffer): Promise<{ storageKey: string; sha256: string }> {
    if (png.length < 8 || png.length > 6_000_000 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error("INVALID_EVIDENCE_PNG");
    }
    assertSafeSegment(tenantId);
    assertSafeSegment(runId);
    const directory = path.join(this.root, tenantId, runId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const sha256 = crypto.createHash("sha256").update(png).digest("hex");
    const storageKey = path.join(tenantId, runId, `${String(sequence).padStart(5, "0")}-${sha256.slice(0, 12)}.png`);
    await writePrivateFile(path.join(this.root, storageKey), this.cipher.encrypt(png));
    return { storageKey, sha256 };
  }

  public async get(storageKey: string): Promise<Buffer> {
    return this.cipher.decrypt(await readFile(this.resolve(storageKey)));
  }

  public async delete(storageKey: string): Promise<void> {
    await unlink(this.resolve(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private resolve(storageKey: string): string {
    const resolved = path.resolve(this.root, storageKey);
    const root = path.resolve(this.root) + path.sep;
    if (!resolved.startsWith(root)) throw new Error("INVALID_STORAGE_KEY");
    return resolved;
  }
}

export class FileExportStore implements ExportStore {
  private readonly cipher: StorageCipher;

  public constructor(private readonly root: string, encryptionKey?: string) {
    this.cipher = new StorageCipher(encryptionKey);
  }

  public async put(tenantId: string, requestId: string, payload: unknown): Promise<string> {
    assertSafeSegment(tenantId);
    assertSafeSegment(requestId);
    const directory = path.join(this.root, tenantId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const storageKey = path.join(tenantId, `${requestId}.json`);
    const plaintext = Buffer.from(JSON.stringify(payload, null, 2));
    await writePrivateFile(path.join(this.root, storageKey), this.cipher.encrypt(plaintext));
    return storageKey;
  }

  public async get(storageKey: string): Promise<Buffer> {
    const resolved = this.resolve(storageKey);
    return this.cipher.decrypt(await readFile(resolved));
  }

  public async delete(storageKey: string): Promise<void> {
    await unlink(this.resolve(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private resolve(storageKey: string): string {
    const resolved = path.resolve(this.root, storageKey);
    const root = path.resolve(this.root) + path.sep;
    if (!resolved.startsWith(root)) throw new Error("INVALID_STORAGE_KEY");
    return resolved;
  }
}

const envelopeMagic = Buffer.from("TNENC1", "ascii");

class StorageCipher {
  private readonly key?: Buffer;

  public constructor(encryptionKey?: string) {
    if (encryptionKey) this.key = Buffer.from(encryptionKey, "hex");
  }

  public encrypt(plaintext: Buffer): Buffer {
    if (!this.key) return plaintext;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(envelopeMagic);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([envelopeMagic, iv, cipher.getAuthTag(), ciphertext]);
  }

  public decrypt(envelope: Buffer): Buffer {
    if (!envelope.subarray(0, envelopeMagic.length).equals(envelopeMagic)) return envelope;
    if (!this.key) throw new Error("STORAGE_ENCRYPTION_KEY_REQUIRED");
    if (envelope.length < envelopeMagic.length + 12 + 16) throw new Error("INVALID_ENCRYPTED_FILE");
    const ivStart = envelopeMagic.length;
    const tagStart = ivStart + 12;
    const bodyStart = tagStart + 16;
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, envelope.subarray(ivStart, tagStart));
    decipher.setAAD(envelopeMagic);
    decipher.setAuthTag(envelope.subarray(tagStart, bodyStart));
    return Buffer.concat([decipher.update(envelope.subarray(bodyStart)), decipher.final()]);
  }
}

async function writePrivateFile(target: string, payload: Buffer): Promise<void> {
  const temporary = `${target}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  await writeFile(temporary, payload, { flag: "wx", mode: 0o600 });
  await rename(temporary, target);
}

function assertSafeSegment(value: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw new Error("INVALID_STORAGE_SEGMENT");
}
