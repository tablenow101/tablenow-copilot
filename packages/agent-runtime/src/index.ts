import crypto from "node:crypto";
import type { CopilotReply } from "@tablenow/contracts";
import { inferTool, policyForTool } from "@tablenow/domain";
import type { ModelProvider, ModelResult } from "@tablenow/provider-adapters";

export interface CopilotContext {
  tenantId: string;
  actorId: string;
  message: string;
  conversationId?: string;
  snapshot: {
    occupancyPercent: number;
    openDecisions: number;
    availableTables: number;
    revenueCapturedToday: number;
    inventoryAlerts: number;
  };
}

export interface AgentPlan extends CopilotReply {
  usage: { model: string; inputTokens: number; outputTokens: number; estimatedCostEur: number };
  tool: string;
  arguments: Record<string, unknown>;
}

export interface BudgetGuard {
  assertAvailable(tenantId: string, estimatedCostEur: number): Promise<void>;
}

class DeterministicProvider implements ModelProvider {
  public async complete(prompt: { message: string; context: Record<string, unknown> }): Promise<ModelResult> {
    const snapshot = prompt.context as CopilotContext["snapshot"];
    const answer = snapshot.openDecisions > 0
      ? `Le service est sous contrôle, mais ${snapshot.openDecisions} décision${snapshot.openDecisions > 1 ? "s" : ""} attend${snapshot.openDecisions > 1 ? "ent" : ""} une validation. L'occupation prévue est de ${snapshot.occupancyPercent} %, avec ${snapshot.availableTables} tables encore disponibles.`
      : `Aucune décision urgente n'attend votre validation. L'occupation prévue est de ${snapshot.occupancyPercent} % et ${snapshot.availableTables} tables restent disponibles.`;
    return { text: answer, model: "tablenow-deterministic-v1", inputTokens: 0, outputTokens: 0, estimatedCostEur: 0 };
  }
}

export class AgentRuntime {
  public constructor(
    private readonly provider: ModelProvider = new DeterministicProvider(),
    private readonly budget?: BudgetGuard,
  ) {}

  public async plan(context: CopilotContext): Promise<AgentPlan> {
    const tool = inferTool(context.message);
    const policy = policyForTool(tool);
    const estimatedCost = 0.01;
    await this.budget?.assertAvailable(context.tenantId, estimatedCost);

    const completion = await this.provider.complete({
      system: "Tu es TableNow Copilot. Réponds en français, brièvement, uniquement à partir du contexte vérifié. Ne prétends jamais avoir exécuté une action.",
      message: context.message,
      context: context.snapshot,
    });

    const conversationId = context.conversationId || crypto.randomUUID();
    const evidence = [
      { label: "Occupation prévue", value: `${context.snapshot.occupancyPercent} %` },
      { label: "Tables disponibles", value: String(context.snapshot.availableTables) },
      { label: "Décisions ouvertes", value: String(context.snapshot.openDecisions) },
    ];

    const proposedAction = tool === "workspace.explain" ? null : {
      id: crypto.randomUUID(),
      tool,
      title: actionTitle(tool),
      rationale: actionRationale(tool, context.snapshot),
      risk: policy.risk,
      approvalRequired: policy.approvalRequired,
      status: "proposed" as const,
    };

    return {
      conversationId,
      answer: completion.text,
      evidence,
      proposedAction,
      usage: {
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        estimatedCostEur: completion.estimatedCostEur,
      },
      tool,
      arguments: actionArguments(tool, context),
    };
  }
}

function actionTitle(tool: string): string {
  const titles: Record<string, string> = {
    "reservation.follow_up": "Relancer les réservations à risque",
    "service.open_slot": "Ouvrir un créneau supplémentaire",
    "inventory.create_alert": "Créer une alerte de stock",
    "guest.bulk_message": "Envoyer une communication groupée",
  };
  return titles[tool] || "Action exceptionnelle";
}

function actionRationale(tool: string, snapshot: CopilotContext["snapshot"]): string {
  if (tool === "service.open_slot") return `${snapshot.availableTables} tables sont encore disponibles ; la modification affectera les réservations proposées.`;
  if (tool === "inventory.create_alert") return `${snapshot.inventoryAlerts} alerte(s) de stock sont actuellement actives.`;
  if (tool === "reservation.follow_up") return `${snapshot.openDecisions} décision(s) peuvent nécessiter un contact client.`;
  return "Cette action touche plusieurs clients et restera bloquée sans validation explicite.";
}

function actionArguments(tool: string, context: CopilotContext): Record<string, unknown> {
  if (tool === "inventory.create_alert") return { severity: "warning", source: "copilot" };
  if (tool === "service.open_slot") return { additionalTables: Math.min(context.snapshot.availableTables, 3) };
  if (tool === "reservation.follow_up") return { scope: "at_risk", channel: "sms" };
  return {};
}
