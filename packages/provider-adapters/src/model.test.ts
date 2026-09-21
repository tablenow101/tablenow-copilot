import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "./model.js";

afterEach(() => vi.unstubAllGlobals());
const provider = new OpenAICompatibleProvider({ baseUrl: "https://model.example.test/v1", model: "configured-model" });
const prompt = { system: "Use the declared provenance.", message: "Analyse ce document.", context: { documentsUnverified: [{ text: "Données déclarées" }] } };

describe("existing model adapter", () => {
  it("keeps omitted usage and pricing unknown instead of reporting zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Réponse exploitable" } }] }))));
    await expect(provider.complete(prompt)).resolves.toMatchObject({ text: "Réponse exploitable", inputTokens: null, outputTokens: null, estimatedCostEur: null });
  });
  it("preserves actual token measurements without inventing a tariff", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Réponse" } }], usage: { prompt_tokens: 27, completion_tokens: 9 } }))));
    await expect(provider.complete(prompt)).resolves.toMatchObject({ inputTokens: 27, outputTokens: 9, estimatedCostEur: null });
  });
  it("rejects an empty model response instead of calling fallback text an AI result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }))));
    await expect(provider.complete(prompt)).rejects.toThrow("MODEL_PROVIDER_EMPTY_RESPONSE");
  });
  it("does not label untrusted document context as verified data", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Réponse" } }] })));
    vi.stubGlobal("fetch", fetch);
    await provider.complete(prompt);
    const sent = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(sent.messages[1].content).toContain("documentsUnverified");
    expect(sent.messages[1].content).not.toContain("Contexte vérifié");
  });
});
