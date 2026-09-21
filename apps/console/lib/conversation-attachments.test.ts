import { afterEach, describe, expect, it, vi } from "vitest";
import { requestAttachment } from "./conversation-attachments";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("documents privés de la barre conversationnelle", () => {
  it("ne réenvoie pas le fichier quand la réponse d’enregistrement est perdue", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    await expect(requestAttachment("POST", undefined, "{}")).rejects.toMatchObject({ unconfirmed: true });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("distingue le refus explicite du serveur du résultat inconnu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "FILE_TOO_LARGE" } }), { status: 413, headers: { "content-type": "application/json" } })));
    await expect(requestAttachment("POST", undefined, "{}")).rejects.toMatchObject({ unconfirmed: false, status: 413 });
  });
  it("ne considère pas une erreur serveur comme une preuve que le retrait n’a pas eu lieu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(requestAttachment("DELETE", "document-id")).rejects.toMatchObject({ unconfirmed: true });
  });
  it("interrompt une lecture silencieuse et rend une erreur après vingt secondes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const result = expect(requestAttachment("GET")).rejects.toMatchObject({ unconfirmed: false });
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
  it("ne prétend pas que le fichier a échoué si la confirmation dépasse le délai", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    const result = expect(requestAttachment("POST", undefined, "{}")).rejects.toMatchObject({ unconfirmed: true });
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
  });
  it("retourne uniquement la confirmation reçue du serveur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "saved-id", name: "menu.txt", byteSize: 4 }), { headers: { "content-type": "application/json" } })));
    await expect(requestAttachment("POST", undefined, "{}")).resolves.toEqual({ id: "saved-id", name: "menu.txt", byteSize: 4 });
  });
});
