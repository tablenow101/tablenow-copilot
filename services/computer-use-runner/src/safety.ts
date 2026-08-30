import path from "node:path";
import { isUrlAllowed, requiresPointOfActionApproval } from "@tablenow/domain";
import type { ClaimedRun } from "./types.js";

export class SecurityBlockError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function assertAllowedUrl(value: string, allowedHosts: string[]): void {
  if (!isUrlAllowed(value, allowedHosts)) throw new SecurityBlockError("DOMAIN_NOT_ALLOWED", `Navigation bloquée vers un domaine non autorisé : ${safeOrigin(value)}`);
}

export function assertFinalControlAllowed(run: ClaimedRun, visibleText: string): void {
  if (!requiresPointOfActionApproval(visibleText)) return;
  if (run.approved) return;
  throw new SecurityBlockError("POINT_OF_ACTION_APPROVAL_REQUIRED", "Une validation humaine est requise juste avant ce contrôle sensible.");
}

const promptInjectionPatterns = [
  /ignore (all|any|the|your)?\s*(previous|prior|above) instructions?/i,
  /(?:system|developer) message\s*:/i,
  /(?:to continue|unlock|verify your account|security check).{0,60}(?:upload|send|share|copy|paste).{0,40}(?:api key|password|credential|secret|token)/i,
  /(?:ignorez|oubliez).{0,30}(?:instructions?|consignes?) (?:precedentes?|ci-dessus)/i,
  /(?:pour continuer|débloquer|verifier votre compte|vérifier votre compte).{0,60}(?:envoyez|partagez|copiez|collez).{0,40}(?:mot de passe|identifiants?|secret|jeton)/i,
];

export function detectPromptInjection(visibleText: string): string | null {
  const normalized = visibleText.normalize("NFKC").slice(0, 200_000);
  return promptInjectionPatterns.some((pattern) => pattern.test(normalized))
    ? "Le contenu de la page ressemble à une instruction destinée à détourner l’automatisation."
    : null;
}

export function safeProfilePath(root: string, credentialRef: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,100}$/.test(credentialRef)) throw new SecurityBlockError("INVALID_CREDENTIAL_REF", "Référence de session locale invalide.");
  const resolved = path.resolve(root, credentialRef);
  const safeRoot = path.resolve(root) + path.sep;
  if (!resolved.startsWith(safeRoot)) throw new SecurityBlockError("PROFILE_PATH_ESCAPE", "Chemin de profil local interdit.");
  return resolved;
}

export function interpolate(template: string, inputs: ClaimedRun["inputs"]): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9_]{0,63})\}\}/g, (_match, key: string) => {
    if (!(key in inputs)) throw new Error(`MISSING_INPUT:${key}`);
    const value = inputs[key];
    return value === null ? "" : String(value);
  });
}

export function safeOrigin(value: string): string {
  try { return new URL(value).origin; } catch { return "URL invalide"; }
}
