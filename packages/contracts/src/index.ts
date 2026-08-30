import { z } from "zod";

export const uuidSchema = z.uuid();
export const emailSchema = z.email().transform((value) => value.trim().toLowerCase());

export const roleSchema = z.enum([
  "platform_admin",
  "owner",
  "group_admin",
  "manager",
  "operator",
  "viewer",
]);
export type Role = z.infer<typeof roleSchema>;

export const requestCodeSchema = z.object({
  email: emailSchema,
  tenantSlug: z.string().trim().min(2).max(80).optional(),
});

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
});

export const invitePilotSchema = z.object({
  email: emailSchema,
  organizationName: z.string().trim().min(2).max(120),
  restaurantName: z.string().trim().min(2).max(120).optional(),
  role: roleSchema.exclude(["platform_admin"]).default("owner"),
  locale: z.enum(["fr", "en"]).default("fr"),
});

export const operatingSetupSchema = z.object({
  reservationMode: z.enum(["tablenow", "software", "calendar", "paper", "hybrid"]),
  providers: z.array(z.enum(["zenchef", "sevenrooms", "thefork", "google_calendar", "outlook_calendar", "other"])).max(8),
  otherProvider: z.string().trim().max(120).optional(),
  keepPaperWorkflow: z.boolean().default(false),
}).superRefine((setup, context) => {
  if (["software", "calendar", "hybrid"].includes(setup.reservationMode) && setup.providers.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["providers"],
      message: "Indiquez au moins un outil déjà utilisé par le restaurant.",
    });
  }
  if (setup.providers.includes("other") && !setup.otherProvider) {
    context.addIssue({
      code: "custom",
      path: ["otherProvider"],
      message: "Indiquez le nom de l'autre outil.",
    });
  }
});

export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  restaurantName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  roleTitle: z.string().trim().max(120).default("Direction"),
  phone: z.string().trim().min(6).max(40),
  address: z.string().trim().min(5).max(300),
  timezone: z.string().trim().min(3).max(80).default("Europe/Paris"),
  serviceGoals: z.array(z.enum([
    "capture_demand",
    "reduce_no_shows",
    "improve_service",
    "optimize_staff",
    "control_inventory",
    "group_visibility",
  ])).min(1).max(4),
  operatingSetup: operatingSetupSchema.default({ reservationMode: "tablenow", providers: [], keepPaperWorkflow: false }),
  demoMode: z.boolean().default(true),
  acceptTerms: z.literal(true),
  acceptDpa: z.literal(true),
});

export const restaurantCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().min(3).max(80).default("Europe/Paris"),
  capacity: z.number().int().min(1).max(10_000),
  isDemo: z.boolean().default(true),
  operatingSetup: operatingSetupSchema.default({ reservationMode: "tablenow", providers: [], keepPaperWorkflow: false }),
});

export const reservationCreateSchema = z.object({
  restaurantId: z.uuid().optional(),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.email().optional().or(z.literal("")),
  guestPhone: z.string().trim().max(40).optional(),
  startsAt: z.iso.datetime(),
  partySize: z.number().int().min(1).max(100),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(["manual", "phone", "web", "copilot"]).default("manual"),
});

export const reservationUpdateSchema = z.object({
  status: z.enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]).optional(),
  startsAt: z.iso.datetime().optional(),
  partySize: z.number().int().min(1).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const decisionUpdateSchema = z.object({
  status: z.enum(["approved", "rejected", "snoozed"]),
  note: z.string().trim().max(500).optional(),
});

export const communicationUpdateSchema = z.object({
  status: z.enum(["open", "handled", "escalated"]),
});

export const taskUpdateSchema = z.object({
  status: z.enum(["open", "in_progress", "done", "cancelled"]),
});

export const taskCreateSchema = z.object({
  restaurantId: uuidSchema,
  title: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(80).default("service"),
  assigneeName: z.string().trim().max(120).optional(),
  dueAt: z.iso.datetime().optional(),
});

export const shiftCreateSchema = z.object({
  restaurantId: uuidSchema,
  teamMemberName: z.string().trim().min(2).max(120),
  roleTitle: z.string().trim().min(2).max(120),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  status: z.enum(["planned", "confirmed"]).default("planned"),
}).refine((shift) => new Date(shift.endsAt) > new Date(shift.startsAt), { path: ["endsAt"], message: "La fin doit être postérieure au début." });

export const inventoryCreateSchema = z.object({
  restaurantId: uuidSchema,
  name: z.string().trim().min(2).max(120),
  unit: z.string().trim().min(1).max(40),
  quantity: z.number().min(0).max(1_000_000),
  reorderThreshold: z.number().min(0).max(1_000_000),
});

export const inventoryUpdateSchema = z.object({
  quantity: z.number().min(0).max(1_000_000),
  note: z.string().trim().max(300).optional(),
});

export const copilotMessageSchema = z.object({
  message: z.string().trim().min(2).max(4000),
  conversationId: uuidSchema.optional(),
  restaurantId: uuidSchema.optional(),
});

export const approvalSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const computerSurfaceSchema = z.enum(["browser", "desktop"]);
export const computerModeSchema = z.enum(["observe", "assist", "autonomous", "paused"]);
export const computerConnectionStatusSchema = z.enum(["setup", "ready", "degraded", "offline", "paused"]);
export const computerRiskSchema = z.enum(["low", "medium", "high", "critical"]);
export const computerRunStatusSchema = z.enum([
  "awaiting_approval",
  "queued",
  "claimed",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "cancelled",
]);

const hostnameSchema = z.string().trim().min(1).max(253).transform((value) => value.toLowerCase());

export const computerConnectionCreateSchema = z.object({
  restaurantId: uuidSchema,
  provider: z.enum(["zenchef", "sevenrooms", "thefork", "generic", "tablenow-simulator"]),
  displayName: z.string().trim().min(2).max(120),
  surface: computerSurfaceSchema.default("browser"),
  baseUrl: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "URL HTTP(S) requise"),
  allowedHosts: z.array(hostnameSchema).min(1).max(20),
  mode: computerModeSchema.default("assist"),
});

export const computerConnectionUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  baseUrl: z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "URL HTTP(S) requise").optional(),
  allowedHosts: z.array(hostnameSchema).min(1).max(20).optional(),
  mode: computerModeSchema.optional(),
  status: computerConnectionStatusSchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "Au moins un champ est requis");

export const computerLocatorSchema = z.union([
  z.object({ kind: z.literal("role"), role: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(160) }),
  z.object({ kind: z.literal("label"), value: z.string().trim().min(1).max(160) }),
  z.object({ kind: z.literal("text"), value: z.string().trim().min(1).max(240), exact: z.boolean().default(false) }),
  z.object({ kind: z.literal("testId"), value: z.string().trim().min(1).max(160) }),
  z.object({ kind: z.literal("css"), value: z.string().trim().min(1).max(500) }),
]);

export const computerWorkflowStepSchema = z.discriminatedUnion("action", [
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("goto"), url: z.string().trim().min(1).max(1000) }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("click"), locator: computerLocatorSchema }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("fill"), locator: computerLocatorSchema, value: z.string().max(2000), sensitive: z.boolean().default(false) }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("select"), locator: computerLocatorSchema, value: z.string().max(500) }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("press"), key: z.string().trim().min(1).max(80) }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("wait"), milliseconds: z.number().int().min(100).max(10_000) }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("verify"), locator: computerLocatorSchema, contains: z.string().trim().min(1).max(500).optional() }),
  z.object({ id: z.string().trim().min(1).max(80), action: z.literal("screenshot"), label: z.string().trim().min(1).max(120) }),
]);

export const computerWorkflowDefinitionSchema = z.object({
  engine: z.enum(["playwright", "openai-computer"]),
  startUrl: z.string().trim().min(1).max(1000),
  steps: z.array(computerWorkflowStepSchema).max(80).default([]),
  expectedOutcome: z.string().trim().min(2).max(1000),
  maxSteps: z.number().int().min(1).max(80).default(30),
  readOnly: z.boolean().default(false),
});

export const computerRunCreateSchema = z.object({
  workflowId: uuidSchema,
  objective: z.string().trim().min(3).max(2000),
  inputs: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).default({}),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export const computerRunDecisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().min(2).max(500),
});

export const computerNodeHeartbeatSchema = z.object({
  version: z.string().trim().min(1).max(40),
  platform: z.string().trim().min(1).max(80),
  capabilities: z.array(z.string().trim().min(1).max(80)).max(50),
  browserVersion: z.string().trim().max(120).optional(),
});

export const computerNodeEventSchema = z.object({
  claimToken: z.string().min(32).max(512),
  sequence: z.number().int().min(1).max(10_000),
  kind: z.enum(["run_started", "step_started", "step_completed", "navigation", "verification", "evidence", "security_block", "warning"]),
  status: z.enum(["info", "succeeded", "failed", "blocked"]).default("info"),
  message: z.string().trim().min(1).max(1000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const computerNodeEvidenceSchema = z.object({
  claimToken: z.string().min(32).max(512),
  sequence: z.number().int().min(1).max(10_000),
  label: z.string().trim().min(1).max(120),
  pngBase64: z.string().min(16).max(8_500_000),
});

export const computerNodeCompleteSchema = z.object({
  claimToken: z.string().min(32).max(512),
  status: z.enum(["succeeded", "failed", "blocked", "cancelled"]),
  summary: z.string().trim().min(1).max(2000),
  output: z.record(z.string(), z.unknown()).default({}),
  errorCode: z.string().trim().min(1).max(120).optional(),
});

export const computerNodeControlSchema = z.object({
  claimToken: z.string().min(32).max(512),
});

export const privacyPreferencesSchema = z.object({
  productEmails: z.boolean(),
  usageAnalytics: z.boolean(),
  modelImprovement: z.boolean(),
});

export const privacyRequestSchema = z.object({
  type: z.enum(["access", "export", "rectification", "deletion", "restriction", "objection"]),
  details: z.string().trim().max(2000).optional(),
});

export const privacyAdminDecisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().trim().min(3).max(1000),
});

export const syncEventSchema = z.object({
  id: uuidSchema,
  type: z.string().trim().min(2).max(120),
  aggregateType: z.string().trim().min(2).max(80),
  aggregateId: uuidSchema,
  occurredAt: z.iso.datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export const syncPushSchema = z.object({
  nodeId: uuidSchema,
  events: z.array(syncEventSchema).max(250),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type InvitePilotInput = z.infer<typeof invitePilotSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type RestaurantCreateInput = z.infer<typeof restaurantCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type ShiftCreateInput = z.infer<typeof shiftCreateSchema>;
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;
export type CopilotMessageInput = z.infer<typeof copilotMessageSchema>;
export type PrivacyRequestInput = z.infer<typeof privacyRequestSchema>;
export type SyncEvent = z.infer<typeof syncEventSchema>;
export type ComputerConnectionCreateInput = z.infer<typeof computerConnectionCreateSchema>;
export type ComputerConnectionUpdateInput = z.infer<typeof computerConnectionUpdateSchema>;
export type ComputerWorkflowDefinition = z.infer<typeof computerWorkflowDefinitionSchema>;
export type ComputerWorkflowStep = z.infer<typeof computerWorkflowStepSchema>;
export type ComputerRunCreateInput = z.infer<typeof computerRunCreateSchema>;
export type ComputerNodeHeartbeatInput = z.infer<typeof computerNodeHeartbeatSchema>;
export type ComputerNodeEventInput = z.infer<typeof computerNodeEventSchema>;
export type ComputerNodeCompleteInput = z.infer<typeof computerNodeCompleteSchema>;

export interface SessionView {
  user: { id: string; email: string; displayName: string | null };
  tenant: { id: string; name: string; slug: string; onboardingComplete: boolean };
  membership: { role: Role };
  csrfToken: string | null;
}

export interface CopilotReply {
  conversationId: string;
  answer: string;
  evidence: Array<{ label: string; value: string }>;
  proposedAction: null | {
    id: string;
    tool: string;
    title: string;
    rationale: string;
    risk: "low" | "medium" | "high" | "critical";
    approvalRequired: boolean;
    status: "proposed" | "approved" | "rejected" | "executed" | "failed";
  };
}
