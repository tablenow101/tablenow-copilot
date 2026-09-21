import { withTenant, type Database } from "@tablenow/provider-adapters";
import type { AuthActor } from "./types.js";
import { unseal } from "./account-crypto.js";
import { getConfig } from "./environment.js";

export const maxExtractedCharacters = 12_000;
export type AttachmentExtraction = {
  status: "extracted" | "unsupported" | "unreadable";
  text?: string;
  truncated: boolean;
  message: string;
};
export type ExtractedAttachment = {
  id: string;
  name: string;
  mimeType: string;
  byteSize: number;
  extraction: AttachmentExtraction;
};

/** Extraction is not an AI analysis and never confirms a business fact. */
export function extractAttachmentText(mimeType: string, bytes: Uint8Array): AttachmentExtraction {
  if (mimeType !== "text/plain") return {
    status: "unsupported", truncated: false,
    message: "Ce format est conservé en privé, mais son analyse n’est pas disponible. Utilisez un fichier texte UTF-8 pour l’exploiter dans la conversation.",
  };
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return { status: "unreadable", truncated: false, message: "Le texte n’est pas encodé en UTF-8. Exportez-le en texte UTF-8 puis ajoutez-le à nouveau." }; }
  if (!text.trim() || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) return {
    status: "unreadable", truncated: false, message: "Ce fichier ne contient pas de texte lisible. Vérifiez son contenu avant de le renvoyer.",
  };
  const truncated = text.length > maxExtractedCharacters;
  return {
    status: "extracted", text: text.slice(0, maxExtractedCharacters), truncated,
    message: truncated
      ? "Les 12 000 premiers caractères sont lisibles. La suite ne sera pas analysée ; sélectionnez un extrait plus court si elle est nécessaire."
      : "Texte extrait. Son analyse commence seulement avec votre envoi dans la conversation IA ; aucune information métier n’est confirmée automatiquement.",
  };
}

export async function readPrivateAttachment(database: Database, actor: AuthActor, id: string): Promise<ExtractedAttachment | null> {
  if (!actor.userId || actor.actorType !== "user") throw new Error("USER_REQUIRED");
  const [file] = await withTenant(database, actor.tenantId, tx => tx<{
    id: string; name: string; mime_type: string; byte_size: number; encrypted_content: string;
  }[]>`select id,name,mime_type,byte_size,encrypted_content from onboarding_attachments where id=${id} and tenant_id=${actor.tenantId} and user_id=${actor.userId} and data_origin='business'`);
  if (!file) return null;
  const bytes = Buffer.from(unseal<string>(file.encrypted_content, getConfig().SESSION_SECRET), "base64");
  return { id: file.id, name: file.name, mimeType: file.mime_type, byteSize: file.byte_size, extraction: extractAttachmentText(file.mime_type, bytes) };
}
