import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import {
  approvalSchema,
  communicationUpdateSchema,
  computerConnectionCreateSchema,
  computerConnectionUpdateSchema,
  computerNodeCompleteSchema,
  computerNodeControlSchema,
  computerNodeEvidenceSchema,
  computerNodeEventSchema,
  computerNodeHeartbeatSchema,
  computerRunCreateSchema,
  computerRunDecisionSchema,
  copilotMessageSchema,
  decisionUpdateSchema,
  inventoryCreateSchema,
  inventoryUpdateSchema,
  invitePilotSchema,
  onboardingSchema,
  privacyAdminDecisionSchema,
  privacyPreferencesSchema,
  privacyRequestSchema,
  requestCodeSchema,
  reservationCreateSchema,
  reservationUpdateSchema,
  restaurantCreateSchema,
  shiftCreateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  verifyCodeSchema,
} from "@tablenow/contracts";
import { AgentRuntime } from "@tablenow/agent-runtime";
import { hasPermission } from "@tablenow/domain";
import {
  createDatabase,
  FileExportStore,
  FileEvidenceStore,
  hashSecret,
  invitationEmail,
  LogEmailSender,
  OpenAICompatibleProvider,
  SmtpEmailSender,
  type Database,
  type EmailSender,
} from "@tablenow/provider-adapters";
import { getConfig } from "./environment.js";
import { assertAllowedOrigin, authGuard, clearSessionCookies, cookieNames, setSessionCookies } from "./auth.js";
import { AuthService } from "./auth-service.js";
import { PlatformRepository } from "./repository.js";
import { ComputerUseRepository } from "./computer-use-repository.js";
import { publicCopilotReply } from "./copilot-scope.js";
import "./types.js";

export interface AppDependencies {
  database?: Database;
  email?: EmailSender;
}

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const config = getConfig();
  const ownsDatabase = !dependencies.database;
  const database = dependencies.database || createDatabase(config.DATABASE_URL);
  const email = dependencies.email || createEmailSender();
  const repository = new PlatformRepository(database);
  const auth = new AuthService(database, email);
  const exportStore = new FileExportStore(config.EXPORTS_DIR, config.STORAGE_ENCRYPTION_KEY);
  const evidenceStore = new FileEvidenceStore(config.COMPUTER_EVIDENCE_DIR, config.STORAGE_ENCRYPTION_KEY);
  const computerUse = new ComputerUseRepository(database, config.SESSION_SECRET);
  const modelProvider = config.AI_PROVIDER === "openai-compatible" && config.AI_BASE_URL
    ? new OpenAICompatibleProvider({
        baseUrl: config.AI_BASE_URL,
        model: config.AI_MODEL,
        ...(config.AI_API_KEY ? { apiKey: config.AI_API_KEY } : {}),
      })
    : undefined;
  const agent = new AgentRuntime(modelProvider, {
    assertAvailable: (tenantId, estimatedCostEur) => repository.assertAgentBudget(tenantId, estimatedCostEur, config.AI_MAX_DAILY_EUR),
  });

  const app = Fastify({
    logger: { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 1_048_576,
    requestIdHeader: "x-request-id",
  });
  app.decorateRequest("actor", null);
  await app.register(cookie);
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: [config.PUBLIC_ORIGIN, "http://localhost:3000", "http://localhost:8080"],
    credentials: true,
    allowedHeaders: ["content-type", "x-csrf-token", "authorization", "x-request-id"],
  });
  await app.register(rateLimit, { global: true, max: 240, timeWindow: "15 minutes" });

  app.addHook("onRequest", async (request, reply) => {
    if (!assertAllowedOrigin(request)) {
      return reply.code(403).send({ error: { code: "ORIGIN_FORBIDDEN", message: "Origine non autorisée." } });
    }
  });

  app.get("/health", async () => {
    const [health] = await database<{ ok: number }[]>`select 1 as ok`;
    return { status: health?.ok === 1 ? "ok" : "degraded", service: "core-api", version: "0.1.0" };
  });

  app.post("/v1/auth/request-code", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = requestCodeSchema.parse(request.body);
    await auth.requestCode(input.email, input.tenantSlug);
    return reply.code(202).send({ accepted: true, message: "Si cette adresse dispose d'un accès, le code vient d'être envoyé." });
  });

  app.post("/v1/auth/verify-code", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
    const input = verifyCodeSchema.parse(request.body);
    const verified = await auth.verifyCode(input.email, input.code, {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    setSessionCookies(reply, verified);
    return { authenticated: true };
  });

  app.get("/v1/auth/session", { preHandler: authGuard(database) }, async (request) => {
    return repository.sessionView(request.actor!, request.cookies[cookieNames.csrfCookie]);
  });

  app.post("/v1/auth/logout", { preHandler: authGuard(database) }, async (request, reply) => {
    await auth.revokeSession(request.cookies[cookieNames.sessionCookie]);
    clearSessionCookies(reply);
    return { signedOut: true };
  });

  app.get("/v1/workspace", { preHandler: authGuard(database, "workspace.read") }, async (request) => {
    return repository.getWorkspace(request.actor!.tenantId);
  });

  app.put("/v1/onboarding", { preHandler: authGuard(database, "tenant.manage") }, async (request) => {
    return repository.updateOnboarding(request.actor!, onboardingSchema.parse(request.body), {
      ipHash: hashSecret(request.ip, config.SESSION_SECRET),
      userAgent: request.headers["user-agent"],
    });
  });

  app.post("/v1/onboarding/complete", { preHandler: authGuard(database, "tenant.manage") }, async (request) => {
    return repository.completeOnboarding(request.actor!);
  });

  app.post("/v1/restaurants", { preHandler: authGuard(database, "tenant.manage") }, async (request, reply) => {
    const input = restaurantCreateSchema.parse(request.body);
    const restaurant = await repository.createRestaurant(request.actor!, input);
    return reply.code(201).send(restaurant);
  });

  app.post("/v1/reservations", { preHandler: authGuard(database, "reservation.write") }, async (request, reply) => {
    const reservation = await repository.createReservation(request.actor!, reservationCreateSchema.parse(request.body));
    return reply.code(201).send(reservation);
  });

  app.patch("/v1/reservations/:id", { preHandler: authGuard(database, "reservation.write") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return repository.updateReservation(request.actor!, id, reservationUpdateSchema.parse(request.body));
  });

  app.patch("/v1/decisions/:id", { preHandler: authGuard(database, "operations.write") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = decisionUpdateSchema.parse(request.body);
    return repository.updateDecision(request.actor!, id, input.status, input.note);
  });

  app.patch("/v1/communications/:id", { preHandler: authGuard(database, "operations.write") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = communicationUpdateSchema.parse(request.body);
    return repository.updateCommunication(request.actor!, id, input.status);
  });

  app.patch("/v1/tasks/:id", { preHandler: authGuard(database, "operations.write") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = taskUpdateSchema.parse(request.body);
    return repository.updateTask(request.actor!, id, input.status);
  });

  app.post("/v1/tasks", { preHandler: authGuard(database, "operations.write") }, async (request, reply) => {
    const input = taskCreateSchema.parse(request.body);
    return reply.code(201).send(await repository.createTask(request.actor!, input));
  });

  app.post("/v1/team/shifts", { preHandler: authGuard(database, "team.write") }, async (request, reply) => {
    const input = shiftCreateSchema.parse(request.body);
    return reply.code(201).send(await repository.createShift(request.actor!, input));
  });

  app.post("/v1/inventory", { preHandler: authGuard(database, "inventory.write") }, async (request, reply) => {
    const input = inventoryCreateSchema.parse(request.body);
    return reply.code(201).send(await repository.createInventoryItem(request.actor!, input));
  });

  app.patch("/v1/inventory/:id", { preHandler: authGuard(database, "inventory.write") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = inventoryUpdateSchema.parse(request.body);
    return repository.updateInventory(request.actor!, id, input.quantity, input.note);
  });

  app.post("/v1/copilot/messages", { preHandler: authGuard(database, "copilot.propose") }, async (request) => {
    const input = copilotMessageSchema.parse(request.body);
    const snapshot = await repository.copilotSnapshot(request.actor!.tenantId, input.restaurantId);
    const plan = await agent.plan({
      tenantId: request.actor!.tenantId,
      actorId: request.actor!.actorId,
      message: input.message,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      snapshot,
    });
    if (plan.proposedAction && input.restaurantId) {
      await repository.saveAgentPlan(request.actor!, {
        conversationId: plan.conversationId,
        proposedAction: plan.proposedAction,
        arguments: plan.arguments,
        usage: plan.usage,
      }, input.restaurantId);
    }
    return publicCopilotReply(plan, input.restaurantId);
  });

  app.post("/v1/copilot/actions/:id/decision", { preHandler: authGuard(database, "copilot.approve.low") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = approvalSchema.parse(request.body);
    const risk = await repository.agentActionRisk(request.actor!.tenantId, id);
    if (!risk) throw new Error("NOT_FOUND");
    if ((risk === "high" || risk === "critical") && !hasPermission(request.actor!.role, "copilot.approve.high")) {
      throw new Error("HIGH_RISK_APPROVAL_REQUIRED");
    }
    return repository.decideAgentAction(request.actor!, id, input.approved, input.note);
  });

  app.get("/v1/computer-use", { preHandler: authGuard(database, "computer_use.read") }, async (request) => {
    return computerUse.overview(request.actor!);
  });

  app.post("/v1/computer-use/connections", { preHandler: authGuard(database, "computer_use.configure") }, async (request, reply) => {
    const connection = await computerUse.createConnection(request.actor!, computerConnectionCreateSchema.parse(request.body));
    return reply.code(201).send(connection);
  });

  app.patch("/v1/computer-use/connections/:id", { preHandler: authGuard(database, "computer_use.configure") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return computerUse.updateConnection(request.actor!, id, computerConnectionUpdateSchema.parse(request.body));
  });

  app.post("/v1/computer-use/connections/:id/test", { preHandler: authGuard(database, "computer_use.execute") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    return reply.code(202).send(await computerUse.createConnectionTest(request.actor!, id));
  });

  app.post("/v1/computer-use/runs", { preHandler: authGuard(database, "computer_use.execute") }, async (request, reply) => {
    return reply.code(202).send(await computerUse.createRun(request.actor!, computerRunCreateSchema.parse(request.body)));
  });

  app.post("/v1/computer-use/runs/:id/decision", { preHandler: authGuard(database, "computer_use.read") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = computerRunDecisionSchema.parse(request.body);
    return computerUse.decideRun(request.actor!, id, input.approved, input.note);
  });

  app.post("/v1/computer-use/runs/:id/cancel", { preHandler: authGuard(database, "computer_use.execute") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return computerUse.cancelRun(request.actor!, id);
  });

  app.post("/v1/computer-use/runs/:id/retry", { preHandler: authGuard(database, "computer_use.execute") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return computerUse.retryRun(request.actor!, id);
  });

  app.get("/v1/computer-use/evidence/:eventId", { preHandler: authGuard(database, "computer_use.read") }, async (request, reply) => {
    const { eventId } = eventParams.parse(request.params);
    const storageKey = await computerUse.evidenceKey(request.actor!, eventId);
    const png = await evidenceStore.get(storageKey);
    return reply.header("content-type", "image/png").header("cache-control", "private, no-store").send(png);
  });

  app.post("/v1/node/computer-use/heartbeat", { preHandler: authGuard(database) }, async (request) => {
    return computerUse.heartbeat(request.actor!, computerNodeHeartbeatSchema.parse(request.body));
  });

  app.post("/v1/node/computer-use/claim", { preHandler: authGuard(database) }, async (request, reply) => {
    const run = await computerUse.claim(request.actor!);
    return run ? reply.send(run) : reply.code(204).send();
  });

  app.post("/v1/node/computer-use/runs/:id/events", { preHandler: authGuard(database) }, async (request) => {
    const { id } = idParams.parse(request.params);
    return computerUse.recordEvent(request.actor!, id, computerNodeEventSchema.parse(request.body));
  });

  app.post("/v1/node/computer-use/runs/:id/control", { preHandler: authGuard(database) }, async (request) => {
    const { id } = idParams.parse(request.params);
    const { claimToken } = computerNodeControlSchema.parse(request.body);
    return computerUse.control(request.actor!, id, claimToken);
  });

  app.post("/v1/node/computer-use/runs/:id/evidence", {
    preHandler: authGuard(database),
    bodyLimit: 9_000_000,
  }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const input = computerNodeEvidenceSchema.parse(request.body);
    await computerUse.authorizeEvidence(request.actor!, id, input.claimToken);
    const png = Buffer.from(input.pngBase64, "base64");
    const stored = await evidenceStore.putPng(request.actor!.tenantId, id, input.sequence, png);
    const event = await computerUse.recordEvidence(request.actor!, id, { sequence: input.sequence, label: input.label, ...stored });
    return reply.code(201).send(event);
  });

  app.post("/v1/node/computer-use/runs/:id/complete", { preHandler: authGuard(database) }, async (request) => {
    const { id } = idParams.parse(request.params);
    return computerUse.complete(request.actor!, id, computerNodeCompleteSchema.parse(request.body));
  });

  app.get("/v1/admin/pilots", { preHandler: authGuard(database, "pilot.manage") }, async () => repository.listPilots());

  app.post("/v1/admin/pilots", { preHandler: authGuard(database, "pilot.manage") }, async (request, reply) => {
    const input = invitePilotSchema.parse(request.body);
    const pilot = await repository.createPilot(request.actor!, input);
    await email.send({ to: input.email, ...invitationEmail(input.organizationName) });
    return reply.code(201).send(pilot);
  });

  app.post("/v1/admin/invitations/:id/resend", { preHandler: authGuard(database, "pilot.manage") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const invitation = await repository.getInvitation(id) as { email: string; status: string; organizationName: string } | null;
    if (!invitation || invitation.status !== "pending") throw new Error("INVITATION_NOT_PENDING");
    await email.send({ to: invitation.email, ...invitationEmail(invitation.organizationName) });
    return { sent: true };
  });

  app.delete("/v1/admin/invitations/:id", { preHandler: authGuard(database, "pilot.manage") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return repository.revokeInvitation(request.actor!, id);
  });

  app.get("/v1/admin/privacy/requests", { preHandler: authGuard(database, "pilot.manage") }, async () => {
    return repository.listPrivacyRequestsForAdmin();
  });

  app.post("/v1/admin/privacy/requests/:id/decision", { preHandler: authGuard(database, "pilot.manage") }, async (request) => {
    const { id } = idParams.parse(request.params);
    const input = privacyAdminDecisionSchema.parse(request.body);
    return repository.decidePrivacyRequest(request.actor!, id, input.approved, input.note);
  });

  app.get("/v1/privacy", { preHandler: authGuard(database, "privacy.manage") }, async (request) => repository.getPrivacy(request.actor!));

  app.put("/v1/privacy/preferences", { preHandler: authGuard(database, "privacy.manage") }, async (request) => {
    return repository.updatePrivacyPreferences(request.actor!, privacyPreferencesSchema.parse(request.body));
  });

  app.post("/v1/privacy/requests", { preHandler: authGuard(database, "privacy.manage") }, async (request, reply) => {
    const privacyRequest = await repository.createPrivacyRequest(request.actor!, privacyRequestSchema.parse(request.body));
    return reply.code(202).send(privacyRequest);
  });

  app.post("/v1/privacy/requests/:id/cancel", { preHandler: authGuard(database, "privacy.manage") }, async (request) => {
    const { id } = idParams.parse(request.params);
    return repository.cancelPrivacyRequest(request.actor!, id);
  });

  app.get("/v1/privacy/requests/:id/download", { preHandler: authGuard(database, "privacy.manage") }, async (request, reply) => {
    const { id } = idParams.parse(request.params);
    const storageKey = await repository.privacyExport(request.actor!, id);
    const file = await exportStore.get(storageKey);
    return reply
      .header("content-type", "application/json; charset=utf-8")
      .header("content-disposition", `attachment; filename="tablenow-export-${id}.json"`)
      .send(file);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.warn({ err: error, requestId: request.id }, "request failed");
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: { code: "INVALID_INPUT", message: "Certains champs sont invalides.", details: z.flattenError(error).fieldErrors } });
    }
    const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const known = errorMap[errorMessage];
    if (known) return reply.code(known.status).send({ error: { code: errorMessage, message: known.message } });
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Une erreur inattendue est survenue.", requestId: request.id } });
  });

  if (ownsDatabase) app.addHook("onClose", async () => database.end());
  return app;
}

const idParams = z.object({ id: z.uuid() });
const eventParams = z.object({ eventId: z.string().regex(/^\d+$/) });

const errorMap: Record<string, { status: number; message: string }> = {
  INVALID_CODE: { status: 400, message: "Code invalide ou expiré." },
  INVITATION_EXPIRED: { status: 403, message: "Cette invitation n'est plus valide." },
  ACCESS_REVOKED: { status: 403, message: "Cet accès a été révoqué." },
  NOT_FOUND: { status: 404, message: "Élément introuvable." },
  NOT_FOUND_OR_ALREADY_RESOLVED: { status: 409, message: "Cette décision a déjà été traitée." },
  NOT_FOUND_OR_ALREADY_DECIDED: { status: 409, message: "Cette action a déjà été traitée." },
  ONBOARDING_INCOMPLETE: { status: 409, message: "Complétez les informations essentielles avant de terminer." },
  LEGAL_ACCEPTANCE_REQUIRED: { status: 409, message: "L'acceptation des documents du pilote est requise." },
  HIGH_RISK_APPROVAL_REQUIRED: { status: 403, message: "Cette action nécessite la validation d'un propriétaire ou administrateur." },
  AI_DAILY_BUDGET_EXCEEDED: { status: 429, message: "Le budget quotidien du copilote est atteint." },
  EXPORT_NOT_AVAILABLE: { status: 404, message: "Cet export n'est pas disponible ou a expiré." },
  NOT_CANCELLABLE: { status: 409, message: "Cette demande ne peut plus être annulée." },
  INVITATION_NOT_PENDING: { status: 409, message: "Cette invitation n'est plus en attente." },
  PRIVACY_REQUEST_NOT_REVIEWABLE: { status: 409, message: "Cette demande ne peut plus être revue." },
  PROTECTED_ADMIN_ACCOUNT: { status: 409, message: "Le compte administrateur initial doit d'abord être transféré à un autre responsable." },
  RESTAURANT_NOT_FOUND: { status: 404, message: "Cet établissement est introuvable." },
  WORKFLOW_NOT_FOUND: { status: 404, message: "Ce protocole d'exécution est introuvable ou inactif." },
  HEALTH_WORKFLOW_NOT_FOUND: { status: 404, message: "Le protocole de vérification est introuvable." },
  COMPUTER_CONNECTION_NOT_READY: { status: 409, message: "Cette connexion doit d'abord être vérifiée." },
  COMPUTER_MODE_FORBIDS_ACTION: { status: 409, message: "Le mode actuel de la connexion interdit cette action." },
  COMPUTER_CRITICAL_FORBIDDEN: { status: 403, message: "TableNow n'exécute jamais cette action critique par contrôle d'écran." },
  COMPUTER_RUN_NOT_AWAITING_APPROVAL: { status: 409, message: "Cette exécution n'attend plus de validation." },
  COMPUTER_APPROVAL_FORBIDDEN: { status: 403, message: "Cette validation exige la direction de l'établissement." },
  COMPUTER_RUN_NOT_CANCELLABLE: { status: 409, message: "Cette exécution ne peut plus être annulée à ce stade." },
  COMPUTER_RUN_NOT_RETRYABLE: { status: 409, message: "Cette exécution ne peut pas être relancée." },
  COMPUTER_RUN_NOT_ACTIVE: { status: 409, message: "Cette exécution n'est plus active." },
  COMPUTER_CLAIM_EXPIRED: { status: 409, message: "Le bail d'exécution a expiré." },
  COMPUTER_CLAIM_INVALID: { status: 403, message: "Le jeton d'exécution est invalide." },
  NODE_ONLY: { status: 403, message: "Cette route est réservée au nœud TableNow local." },
  NODE_NOT_FOUND: { status: 404, message: "Le nœud local n'est pas reconnu." },
  EVIDENCE_NOT_FOUND: { status: 404, message: "Cette preuve n'est plus disponible." },
  INVALID_EVIDENCE_PNG: { status: 400, message: "La preuve visuelle transmise est invalide." },
};

function createEmailSender(): EmailSender {
  const config = getConfig();
  if (config.EMAIL_TRANSPORT === "log") return new LogEmailSender();
  return new SmtpEmailSender(config.EMAIL_FROM, {
    host: config.SMTP_HOST!,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { user: config.SMTP_USER } : {}),
    ...(config.SMTP_PASSWORD ? { password: config.SMTP_PASSWORD } : {}),
  });
}
