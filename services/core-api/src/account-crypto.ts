import crypto from "node:crypto";

const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 32, options, (error, key) => error ? reject(error) : resolve(key)));
}
export async function passwordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return `scrypt-v1$${salt.toString("hex")}$${(await derive(password, salt)).toString("hex")}`;
}
export async function passwordMatches(password: string, stored?: string | null): Promise<boolean> {
  const parts = stored?.split("$");
  const salt = parts?.[0] === "scrypt-v1" ? Buffer.from(parts[1]!, "hex") : Buffer.alloc(16);
  const actual = await derive(password, salt);
  const expected = parts?.[2] ? Buffer.from(parts[2], "hex") : Buffer.alloc(32);
  return !!stored && expected.length === actual.length && crypto.timingSafeEqual(actual, expected);
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  return bits.match(/.{5}/g)!.map(part => alphabet[parseInt(part, 2)]).join("");
}
export function totpAt(secret: string, step: number): string {
  const bits = [...secret].map(c => alphabet.indexOf(c).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(b => parseInt(b, 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const hash = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1]! & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
export function validTotpStep(secret: string, code: string, lastStep = -1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1]) {
    if (step > lastStep && crypto.timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code))) return step;
  }
  return null;
}
function encryptionKey(secret: string) { return crypto.createHash("sha256").update(`tablenow-account-v1:${secret}`).digest(); }
export function seal(value: unknown, secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}
export function unseal<T>(value: string, secret: string): T {
  const raw = Buffer.from(value, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(secret), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
}
