import type { AgentPlan } from "@tablenow/agent-runtime";
import type { CopilotReply } from "@tablenow/contracts";

export function publicCopilotReply(plan: AgentPlan, restaurantId?: string): CopilotReply {
  const { usage: _usage, tool: _tool, arguments: _arguments, ...reply } = plan;
  if (!reply.proposedAction || restaurantId) return reply;
  return {
    ...reply,
    answer: `${reply.answer} Sélectionnez un établissement avant de préparer cette action : TableNow ne choisit jamais une adresse à votre place.`,
    proposedAction: null,
  };
}
