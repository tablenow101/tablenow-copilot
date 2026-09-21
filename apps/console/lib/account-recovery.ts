import { ApiError } from "./api";
import { accountRequest } from "./account-feedback";

export type BackupRecoveryState = { state: "missing" | "acknowledged" }
  | { state: "ready"; backupCodes: string[]; expiresAt: string; expiresInSeconds: number };

function request(action: "replace" | "read" | "acknowledge", operationId: string, code?: string) {
  return accountRequest<BackupRecoveryState>(`/v1/account/backup-codes/${action}`, {
    method: "POST", body: JSON.stringify({ operationId, ...(code === undefined ? {} : { code }) }),
  });
}
export function uncertainAccountResponse(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}
export function readBackupRecovery(operationId: string) { return request("read", operationId); }

/** Never replay a submitted TOTP or acknowledgment automatically after an uncertain reply. */
export async function replaceBackupCodes(operationId: string, code: string) {
  try { return await request("replace", operationId, code); }
  catch (error) {
    if (!uncertainAccountResponse(error)) throw error;
    return readBackupRecovery(operationId);
  }
}
export async function acknowledgeBackupCodes(operationId: string) {
  try { return await request("acknowledge", operationId); }
  catch (error) {
    if (!uncertainAccountResponse(error)) throw error;
    return readBackupRecovery(operationId);
  }
}
