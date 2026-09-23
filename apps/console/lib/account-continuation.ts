import { ApiError } from "./api";
import { accountRequest } from "./account-feedback";

export type AccountMode = "signup" | "login";
export type AccountContinuation = {
  stage: "email";
  email: string;
  purpose: AccountMode;
  rememberMe: boolean;
  expiresAt: string;
  expiresInSeconds: number;
};
export type AccountProgress = { kind: "session"; onboardingComplete: boolean }
  | { kind: "challenge"; challenge: AccountContinuation } | { kind: "none" };

/** Reconcile a lost response with read-only requests, never replay a submitted code. */
export async function readAccountProgress(mode: AccountMode): Promise<AccountProgress> {
  try {
    const session = await accountRequest<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
    return { kind: "session", onboardingComplete: session.tenant.onboardingComplete };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  }
  const challenge = await accountRequest<AccountContinuation | null>("/v1/account/continuation");
  if (!challenge || challenge.stage !== "email" || challenge.purpose !== mode) return { kind: "none" };
  return { kind: "challenge", challenge };
}
