import { afterEach, describe, expect, it, vi } from "vitest";
import { acknowledgeBackupCodes, replaceBackupCodes } from "./account-recovery";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());
const ready = { state: "ready", backupCodes: ["fixture-code"], expiresAt: "2026-09-22T12:10:00Z", expiresInSeconds: 600 };

describe("backup code response reconciliation", () => {
  it("reads the same operation after a lost response without repeating the TOTP", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(response(ready));
    vi.stubGlobal("fetch", fetchMock);
    expect(await replaceBackupCodes("fixture-operation", "123456")).toEqual(ready);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/v1/account/backup-codes/replace", "/api/v1/account/backup-codes/read"]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body)).toEqual({ operationId: "fixture-operation" });
  });
  it("keeps an uncommitted response distinct without automatically generating another batch", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: {} }, 503)).mockResolvedValueOnce(response({ state: "missing" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await replaceBackupCodes("fixture-operation", "123456")).toEqual({ state: "missing" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not retry a known incorrect code or hide an uncertain status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ error: { code: "ACCOUNT_CODE_INVALID" } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(replaceBackupCodes("fixture-operation", "123456")).rejects.toMatchObject({ code: "ACCOUNT_CODE_INVALID" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockReset().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(response({ error: {} }, 503));
    await expect(replaceBackupCodes("fixture-operation", "123456")).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("reconciles a lost acknowledgment without displaying codes once it was committed", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(response({ state: "acknowledged" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await acknowledgeBackupCodes("fixture-operation")).toEqual({ state: "acknowledged" });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(["/api/v1/account/backup-codes/acknowledge", "/api/v1/account/backup-codes/read"]);
  });
});
