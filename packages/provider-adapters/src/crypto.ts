import crypto from "node:crypto";

export function randomDigits(length = 6): string {
  const maximum = 10 ** length;
  return crypto.randomInt(0, maximum).toString().padStart(length, "0");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashSecret(value: string, pepper: string): string {
  return crypto.createHmac("sha256", pepper).update(value).digest("hex");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function idempotencyKey(parts: Array<string | number | null | undefined>): string {
  return crypto.createHash("sha256").update(parts.map((part) => part ?? "").join("\u001f")).digest("hex");
}
