import { api, ApiError } from "./api";

export type ConversationAttachment = { id: string; name: string; byteSize: number; mimeType?: string };

export class AttachmentRequestError extends Error {
  constructor(public readonly unconfirmed: boolean, public readonly status?: number) {
    super(unconfirmed ? "ATTACHMENT_RESULT_UNCONFIRMED" : "ATTACHMENT_REQUEST_FAILED");
  }
}

/** A lost mutation response does not establish whether the document was saved or removed. */
export async function requestAttachment<T>(method: "GET" | "POST" | "DELETE", id?: string, body?: string, operation?: "extraction"): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await api<T>(`/v1/onboarding-attachments${id ? `/${encodeURIComponent(id)}` : ""}${operation === "extraction" ? "/extraction" : ""}`, { method, ...(body !== undefined ? { body } : {}), signal: controller.signal });
  } catch (caught) {
    const status = caught instanceof ApiError ? caught.status : undefined;
    throw new AttachmentRequestError(method !== "GET" && (status === undefined || status >= 500), status);
  } finally {
    clearTimeout(timeout);
  }
}
