import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { accountFeedback, accountRequest, shouldReconcileAccountFailure } from "./account-feedback";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("account verification feedback", () => {
  it("separates a rejected code from an expired verification and a server failure", () => {
    expect(accountFeedback(new ApiError(400, "ACCOUNT_CODE_INVALID", "Code incorrect."))).toEqual({ message: "Code incorrect.", restart: false });
    expect(accountFeedback(new ApiError(410, "ACCOUNT_CHALLENGE_EXPIRED", "expired")).restart).toBe(true);
    expect(accountFeedback(new ApiError(503, "SERVER_FAILURE", "internal detail"))).toEqual({ message: "Le service de vérification rencontre un problème technique. Votre saisie est conservée. Réessayez dans un instant.", restart: false });
  });

  it("does not replace an explicit email delivery failure with a missing-challenge error", () => {
    const deliveryFailure = new ApiError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "L’envoi de l’e-mail est indisponible.");
    expect(shouldReconcileAccountFailure(deliveryFailure)).toBe(false);
    expect(accountFeedback(deliveryFailure)).toEqual({
      message: "L’envoi de l’e-mail est indisponible. Réessayez dans quelques minutes.",
      restart: false,
    });
    expect(shouldReconcileAccountFailure(new ApiError(0, "ACCOUNT_NETWORK", "interrupted"))).toBe(true);
  });

  it("reports an interrupted connection without asserting that the code was wrong", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(accountRequest("/v1/account/continuation")).rejects.toMatchObject({ code: "ACCOUNT_NETWORK", status: 0 });
  });

  it("treats truncated JSON as an uncertain response without replaying the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"authenticated":', { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(accountRequest("/v1/account/verify-mfa", { method: "POST", body: JSON.stringify({ code: "000000" }) })).rejects.toMatchObject({ code: "ACCOUNT_RESPONSE_UNCERTAIN", status: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds waiting and never automatically retries a verification", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = expect(accountRequest("/v1/account/verify-mfa", { method: "POST", body: JSON.stringify({ code: "000000" }) })).rejects.toMatchObject({ code: "ACCOUNT_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20_000);
    await result;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
