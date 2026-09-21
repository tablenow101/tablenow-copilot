import { afterEach, describe, expect, it, vi } from "vitest";
import { readAccountProgress } from "./account-continuation";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const unauthorized = () => response({ error: { code: "UNAUTHORIZED" } }, 401);
afterEach(() => vi.unstubAllGlobals());

describe("account progress reconciliation", () => {
  it("reads a committed MFA session after a lost reply without retrying a code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ tenant: { onboardingComplete: false } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAccountProgress("signup")).toEqual({ kind: "session", onboardingComplete: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/session");
    expect(fetchMock.mock.calls[0]?.[1].method).toBeUndefined();
  });
  it("finds an advanced email verification using only reads", async () => {
    const challenge = { stage: "enroll", purpose: "signup" };
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response(challenge));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAccountProgress("signup")).toEqual({ kind: "challenge", challenge });
    expect(fetchMock.mock.calls.every(call => call[1].method === undefined)).toBe(true);
  });
  it("does not hijack password recovery with an existing login challenge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response({ stage: "mfa", purpose: "login" })));
    expect(await readAccountProgress("reset")).toEqual({ kind: "none" });
  });
  it("resumes Google only on the login flow", async () => {
    const challenge = { stage: "mfa", purpose: "google" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response(challenge)));
    expect(await readAccountProgress("login")).toEqual({ kind: "challenge", challenge });
  });
  it("keeps an unavailable server distinct from an absent session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { message: "Unavailable" } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(readAccountProgress("login")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
