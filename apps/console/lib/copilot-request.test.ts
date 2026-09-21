import { beforeEach, describe, expect, it, vi } from "vitest";
import { copilotRequestBody, prepareCopilotRequest, replayCopilotRequest, sendCopilotRequest, type CopilotRequest } from "./copilot-request";

import { api } from "./api";
vi.mock("./api", async importOriginal => ({ ...await importOriginal<typeof import("./api")>(), api: vi.fn() }));
beforeEach(() => vi.mocked(api).mockReset());

describe("exact copilot retry payloads", () => {
  it("replays a historical run without injecting a dashboard context or changing its key", () => {
    const payload = replayCopilotRequest("restaurant-a", { message: "Préparons le service", requestKey: "old-key", request: { attachmentIds: [] } });
    expect(copilotRequestBody(payload)).toEqual({ restaurantId: "restaurant-a", message: "Préparons le service", idempotencyKey: "old-key", attachmentIds: [] });
    expect(copilotRequestBody(payload)).not.toHaveProperty("context");
  });
  it("replays onboarding and document context after a page reload without adding the current draft", () => {
    const saved = JSON.parse(JSON.stringify({ message: "Explique ma carte", requestKey: "saved-key", request: { attachmentIds: ["doc-a", "doc-b"], context: { surface: "onboarding", step: "complements" } } }));
    const request = replayCopilotRequest("restaurant-a", saved);
    expect(copilotRequestBody(request)).toEqual({ restaurantId: "restaurant-a", message: "Explique ma carte", idempotencyKey: "saved-key", attachmentIds: ["doc-a", "doc-b"], context: { surface: "onboarding", step: "complements" } });
    request.attachmentIds.push("not-persisted");
    expect(saved.request.attachmentIds).toEqual(["doc-a", "doc-b"]);
  });
  it("reuses a lost response key but creates a new one for a genuinely changed request", () => {
    const existing: CopilotRequest = { restaurantId: "a", message: "Mon service", attachmentIds: ["doc-a"], context: { surface: "dashboard" }, key: "stable-key" };
    const createKey = vi.fn(() => "new-key");
    expect(prepareCopilotRequest(existing, existing, createKey).key).toBe("stable-key");
    expect(createKey).not.toHaveBeenCalled();
    expect(prepareCopilotRequest(existing, { ...existing, attachmentIds: ["doc-b"] }, createKey).key).toBe("new-key");
    expect(prepareCopilotRequest(existing, { ...existing, context: { surface: "onboarding", step: "systems" } }, createKey).key).toBe("new-key");
    expect(prepareCopilotRequest(existing, { ...existing, message: "Autre demande" }, createKey).key).toBe("new-key");
  });
});


describe("uncertain chat delivery", () => {
  const request: CopilotRequest = { restaurantId: "restaurant-a", message: "Préparons le service", key: "same-key", attachmentIds: [], context: { surface: "dashboard" } };
  const savedRun = { id: "run-a", requestKey: "same-key", status: "succeeded", answer: "Réponse enregistrée", mode: "summary", report: { sources: [] } };
  it("recovers a completed request after a lost POST response without sending again", async () => {
    vi.mocked(api).mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce({ runs: [savedRun] });
    const reply = await sendCopilotRequest(request);
    expect(reply).toMatchObject({ runId: "run-a", answer: "Réponse enregistrée" });
    expect(vi.mocked(api).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
    expect(api).toHaveBeenNthCalledWith(1, "/v1/operating/chat", expect.objectContaining({ signal: expect.any(AbortSignal), body: expect.stringContaining('"idempotencyKey":"same-key"') }));
  });
  it("looks up the prior result before an explicit retry and does not create a duplicate", async () => {
    vi.mocked(api).mockResolvedValueOnce({ runs: [savedRun] });
    await sendCopilotRequest(request, true);
    expect(api).toHaveBeenCalledOnce();
    expect(vi.mocked(api).mock.calls[0]![0]).toContain("/v1/operating/runs?");
  });
  it("retains the original key when a failed run is genuinely retried", async () => {
    vi.mocked(api).mockResolvedValueOnce({ runs: [{ ...savedRun, status: "failed", answer: null }] }).mockResolvedValueOnce({ runId: "run-a", answer: "Reprise réussie", mode: "summary" });
    await sendCopilotRequest(request, true);
    expect(JSON.parse(String(vi.mocked(api).mock.calls[1]![1]?.body)).idempotencyKey).toBe("same-key");
  });
  it("does not retry an attempt still running under its server lease", async () => {
    vi.mocked(api).mockResolvedValueOnce({ runs: [{ ...savedRun, status: "running", answer: null, leaseUntil: new Date(Date.now() + 60_000).toISOString() }] });
    await expect(sendCopilotRequest(request, true)).rejects.toThrow("encore en cours");
    expect(api).toHaveBeenCalledOnce();
  });
});
