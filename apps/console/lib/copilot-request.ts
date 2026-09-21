import { api, ApiError } from "./api";
import type { OnboardingPresentationStep } from "@tablenow/contracts";

export type CopilotRequestContext = { surface: "onboarding" | "dashboard"; step?: OnboardingPresentationStep };
export type CopilotRequestDetails = { attachmentIds: string[]; context?: CopilotRequestContext };
export type CopilotRequest = CopilotRequestDetails & { restaurantId: string; message: string; key: string };
export type ReplayableCopilotRun = { message: string; requestKey: string; request: CopilotRequestDetails };

/** Reuse a key only for the same user intent, including selected documents and context. */
export function prepareCopilotRequest(previous: CopilotRequest | null, next: Omit<CopilotRequest, "key">, createKey: () => string): CopilotRequest {
  const same = previous && previous.restaurantId === next.restaurantId && previous.message === next.message
    && JSON.stringify(previous.attachmentIds) === JSON.stringify(next.attachmentIds)
    && JSON.stringify(previous.context ?? null) === JSON.stringify(next.context ?? null);
  return { ...next, attachmentIds: [...next.attachmentIds], key: same ? previous.key : createKey() };
}

/** A replay is its persisted payload, never a newly composed dashboard request. */
export function replayCopilotRequest(restaurantId: string, run: ReplayableCopilotRun): CopilotRequest {
  return { restaurantId, message: run.message, key: run.requestKey, attachmentIds: [...run.request.attachmentIds], ...(run.request.context ? { context: { ...run.request.context } } : {}) };
}

export function copilotRequestBody(request: CopilotRequest) {
  return { restaurantId: request.restaurantId, message: request.message, idempotencyKey: request.key, attachmentIds: request.attachmentIds, ...(request.context ? { context: request.context } : {}) };
}

export type CopilotReport = { sources?: Array<{ id: string; label: string }>; uncertainties?: string[] };
export type CopilotRun = { id: string; status: string; requestKey: string; leaseUntil: string; message: string; answer: string | null; mode: "ai" | "summary" | null; report: CopilotReport | null; request: CopilotRequestDetails | null };
export type CopilotReply = { runId: string; answer: string; mode: "ai" | "summary" | null; report?: CopilotReport };
export async function readCopilotRuns(restaurantId: string): Promise<CopilotRun[]> {
  const result = await api<{ runs: CopilotRun[] }>(`/v1/operating/runs?restaurantId=${encodeURIComponent(restaurantId)}`, { signal: AbortSignal.timeout(10_000) });
  return result.runs;
}
function completedReply(run: CopilotRun | undefined): CopilotReply | undefined {
  if (run?.status !== "succeeded" || run.answer === null) return;
  return { runId: run.id, answer: run.answer, mode: run.mode, ...(run.report ? { report: run.report } : {}) };
}
/** Resolve an uncertain prior attempt before retrying; all retries keep their original key. */
export async function sendCopilotRequest(request: CopilotRequest, checkExisting = false): Promise<CopilotReply> {
  if (checkExisting) {
    const run = (await readCopilotRuns(request.restaurantId)).find(run => run.requestKey === request.key);
    const completed = completedReply(run);
    if (completed) return completed;
    if (run?.status === "running" && new Date(run.leaseUntil).getTime() > Date.now()) throw new Error("Votre demande est encore en cours. Son contenu est conservé ; vérifiez à nouveau dans quelques instants.");
  }
  try {
    return await api<CopilotReply>("/v1/operating/chat", { method: "POST", body: JSON.stringify(copilotRequestBody(request)), signal: AbortSignal.timeout(35_000) });
  } catch (caught) {
    if (caught instanceof ApiError && caught.status < 500) throw caught;
    try {
      const completed = completedReply((await readCopilotRuns(request.restaurantId)).find(run => run.requestKey === request.key));
      if (completed) return completed;
    } catch { /* Preserve the original error and request if reconciliation is offline too. */ }
    if (!(caught instanceof ApiError)) throw new Error("La réponse n’a pas pu être confirmée. Votre message est conservé. Réessayez : TableNow vérifiera d’abord si la demande a déjà abouti.");
    throw caught;
  }
}
