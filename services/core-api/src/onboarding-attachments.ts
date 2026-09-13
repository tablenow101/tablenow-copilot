import type { FastifyInstance } from "fastify";
import { withTenant, type Database } from "@tablenow/provider-adapters";
import { z } from "zod";
import { authGuard } from "./auth.js";
import { seal, unseal } from "./account-crypto.js";
import { getConfig } from "./environment.js";

const inputSchema = z.object({ name: z.string().trim().min(1).max(180).refine(s => !/[\x00-\x1f\/\\]/.test(s)), mimeType: z.enum(["application/pdf", "image/png", "image/jpeg", "text/plain"]), base64: z.string().max(2666668).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict();
export async function registerOnboardingAttachments(app: FastifyInstance, database: Database) {
  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/v1/onboarding-attachments")) reply.header("Cache-Control", "no-store");
  });
  const guard = authGuard(database, "tenant.manage");
  const key = getConfig().SESSION_SECRET;
  app.get("/v1/onboarding-attachments", { preHandler: guard }, async request => withTenant(database, request.actor!.tenantId, async tx => ({ files: await tx`select id,name,byte_size as "byteSize" from onboarding_attachments where tenant_id=${request.actor!.tenantId} order by created_at` })));
  app.post("/v1/onboarding-attachments", { preHandler: guard, bodyLimit: 2800000, config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = inputSchema.parse(request.body);
    const bytes = Buffer.from(input.base64,"base64");
    const valid = bytes.length > 0 && bytes.length <= 2000000 && bytes.toString("base64") === input.base64 && (
      input.mimeType === "application/pdf" ? bytes.subarray(0,5).toString() === "%PDF-" :
      input.mimeType === "image/png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
      input.mimeType === "image/jpeg" ? bytes.subarray(0,3).equals(Buffer.from([255,216,255])) : !bytes.includes(0)
    );
    if (!valid) return reply.code(400).send({ error: { message: "Ce fichier n’est pas pris en charge. PDF, PNG, JPEG ou texte, 2 Mo maximum." } });
    const actor = request.actor!;
    const result = await withTenant(database, actor.tenantId, async tx => {
      await tx`select pg_advisory_xact_lock(hashtext(${`attachments:${actor.tenantId}`}))`;
      const [quota] = await tx<{ total: number; count: number }[]>`select coalesce(sum(byte_size),0)::int as total,count(*)::int as count from onboarding_attachments where tenant_id=${actor.tenantId}`;
      if (quota!.total + bytes.length > 20000000 || quota!.count >= 30) return null;
      const [file] = await tx`insert into onboarding_attachments(tenant_id,user_id,name,mime_type,byte_size,encrypted_content) values (${actor.tenantId},${actor.userId!},${input.name},${input.mimeType},${bytes.length},${seal(input.base64,key)}) returning id,name,byte_size as "byteSize"`;
      return file;
    });
    return result ? reply.code(201).send(result) : reply.code(409).send({ error: { message: "L’espace documentaire de cet onboarding est plein. Retirez un fichier avant d’en ajouter un autre." } });
  });
  app.get("/v1/onboarding-attachments/:id", { preHandler: guard }, async (request, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    const [file] = await withTenant(database, request.actor!.tenantId, tx => tx<{ name: string; encrypted_content: string }[]>`select name,encrypted_content from onboarding_attachments where id=${id} and tenant_id=${request.actor!.tenantId}`);
    if (!file) return reply.code(404).send({ error: { message: "Fichier introuvable." } });
    // Always download; uploaded content is not rendered or executed on our origin.
    return reply.header("cache-control","no-store").header("content-type","application/octet-stream").header("content-disposition",`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`).send(Buffer.from(unseal<string>(file.encrypted_content,key),"base64"));
  });
  app.delete("/v1/onboarding-attachments/:id", { preHandler: guard }, async (request, reply) => {
    const { id } = z.object({ id: z.uuid() }).parse(request.params);
    await withTenant(database, request.actor!.tenantId, tx => tx`delete from onboarding_attachments where id=${id} and tenant_id=${request.actor!.tenantId}`);
    return reply.code(204).send();
  });
}
