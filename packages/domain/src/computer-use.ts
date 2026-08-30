import type { Role } from "@tablenow/contracts";
import type { Permission } from "./authorization.js";

export type ComputerRisk = "low" | "medium" | "high" | "critical";
export type ComputerMode = "observe" | "assist" | "autonomous" | "paused";

export interface ComputerExecutionPolicy {
  risk: ComputerRisk;
  approvalRequired: boolean;
  permission: Permission;
  executable: boolean;
  reason: string;
}

export function computerExecutionPolicy(input: {
  risk: ComputerRisk;
  mode: ComputerMode;
  readOnly: boolean;
}): ComputerExecutionPolicy {
  if (input.mode === "paused") {
    return { risk: input.risk, approvalRequired: true, permission: "computer_use.approve.high", executable: false, reason: "Connexion mise en pause." };
  }
  if (input.mode === "observe" && !input.readOnly) {
    return { risk: input.risk, approvalRequired: true, permission: "computer_use.approve.high", executable: false, reason: "Le mode observation interdit toute écriture." };
  }
  if (input.risk === "critical") {
    return { risk: input.risk, approvalRequired: true, permission: "computer_use.approve.high", executable: false, reason: "Les actions critiques ne sont jamais exécutées par computer use." };
  }
  if (input.risk === "high") {
    return { risk: input.risk, approvalRequired: true, permission: "computer_use.approve.high", executable: true, reason: "Validation de la direction requise au point d'action." };
  }
  if (input.risk === "medium") {
    const approvalRequired = input.mode !== "autonomous";
    return { risk: input.risk, approvalRequired, permission: approvalRequired ? "computer_use.approve.high" : "computer_use.execute", executable: true, reason: approvalRequired ? "Validation requise en mode assisté." : "Autorisé par la politique autonome du restaurant." };
  }
  return { risk: input.risk, approvalRequired: false, permission: "computer_use.execute", executable: true, reason: "Action réversible à faible impact." };
}

export function canApproveComputerRun(role: Role, risk: ComputerRisk): boolean {
  if (risk === "high" || risk === "critical") return ["platform_admin", "owner", "group_admin"].includes(role);
  return ["platform_admin", "owner", "group_admin", "manager"].includes(role);
}

export function normalizeAllowedHosts(baseUrl: string, hosts: string[]): string[] {
  const originHost = new URL(baseUrl).hostname.toLowerCase();
  return [...new Set([originHost, ...hosts.map((host) => host.trim().toLowerCase())])].sort();
}

export function isUrlAllowed(value: string, allowedHosts: string[]): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  const hostname = url.hostname.toLowerCase();
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

const sensitiveActionPattern = /\b(delete|remove|cancel|refund|pay|purchase|order|send|publish|save|confirm|submit|create|modify|supprimer|annuler|rembourser|payer|commander|envoyer|publier|enregistrer|confirmer|valider|creer|créer|modifier)\b/i;

export function requiresPointOfActionApproval(visibleTargetText: string): boolean {
  return sensitiveActionPattern.test(visibleTargetText.normalize("NFKC"));
}
