import { afterEach, describe, expect, it, vi } from "vitest";
import { readAccountProgress } from "./account-continuation";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const unauthorized = () => response({ error: { code: "UNAUTHORIZED" } }, 401);
afterEach(() => vi.unstubAllGlobals());

describe("account progress reconciliation", () => {
  it("reads a committed email session after a lost reply without retrying a code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ tenant: { onboardingComplete: false } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAccountProgress()).toEqual({ kind: "session", onboardingComplete: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/auth/session");
    expect(fetchMock.mock.calls[0]?.[1].method).toBeUndefined();
  });
  it("finds an active email verification using only reads", async () => {
    const challenge = { stage: "email", purpose: "access" };
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response(challenge));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAccountProgress()).toEqual({ kind: "challenge", challenge });
    expect(fetchMock.mock.calls.every(call => call[1].method === undefined)).toBe(true);
  });
  it("resumes the short profile step after the address has been verified", async () => {
    const challenge = { stage: "profile", purpose: "access", email: "new@tablenow.test" };
    const fetchMock = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response(challenge));
    vi.stubGlobal("fetch", fetchMock);
    expect(await readAccountProgress()).toEqual({ kind: "challenge", challenge });
    expect(fetchMock.mock.calls.every(call => call[1].method === undefined)).toBe(true);
  });
  it("ignores a legacy MFA challenge instead of reopening the retired flow", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response({ stage: "mfa", purpose: "login" })));
    expect(await readAccountProgress()).toEqual({ kind: "none" });
  });
  it("ignores a legacy Google challenge because Google now creates the session directly", async () => {
    const challenge = { stage: "enroll", purpose: "google" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(response(challenge)));
    expect(await readAccountProgress()).toEqual({ kind: "none" });
  });
  it("keeps an unavailable server distinct from an absent session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { message: "Unavailable" } }, 503));
    vi.stubGlobal("fetch", fetchMock);
    await expect(readAccountProgress()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
