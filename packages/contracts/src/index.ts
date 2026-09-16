import { z } from "zod";

export const tableNowDeploymentTopology = {
  vercelProject: "tablenow-copilot-v2.vercel.app",
  preview: {
    environment: "preview",
    branch: "product/onboarding-owner",
    origin: "https://preview.tablenow.io",
    neonEndpoint: "ep-rapid-leaf-zas11naf",
  },
  production: {
    environment: "production",
    branch: "main",
    origin: "https://os.tablenow.io",
    neonEndpoint: "ep-crimson-sound-za2s6xo0",
  },
  database: "neondb",
} as const;

export type DeploymentEnvironment = Readonly<Record<string, string | undefined>>;

export function resolveVercelDeployment(environment: DeploymentEnvironment) {
  if (environment.VERCEL !== "1"
    || environment.VERCEL_PROJECT_PRODUCTION_URL?.toLowerCase() !== tableNowDeploymentTopology.vercelProject) return null;
  for (const target of [tableNowDeploymentTopology.preview, tableNowDeploymentTopology.production] as const) {
    if (environment.VERCEL_ENV === target.environment
      && environment.VERCEL_GIT_COMMIT_REF === target.branch
      && environment.PUBLIC_ORIGIN === target.origin) return target;
  }
  return null;
}

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

export const onboardingSectionOrder = [
  "priorities",
  "establishment",
  "interaction",
  "reservations",
  "operations",
  "authority",
  "final_note",
  "review",
] as const;
export const onboardingSectionSchema = z.enum(onboardingSectionOrder);
export type OnboardingSection = z.infer<typeof onboardingSectionSchema>;

export const onboardingSourceTypeSchema = z.enum(["user_form", "user_text", "user_voice", "public_suggestion", "connected_source"]);
export const onboardingConfirmationStatusSchema = z.enum(["suggested", "confirmed", "rejected", "unknown"]);
export const onboardingLegalVersions = {
  terms: "pilot-2026-08-23",
  dpa: "pilot-2026-08-23",
} as const;

const optionalText = (max = 500) => z.string().trim().max(max).optional();
const unknownableText = (max = 500) => z.union([z.string().trim().max(max), z.literal("unknown"), z.literal("not_applicable")]).optional();
const ianaTimezone = z.string().trim().min(3).max(80).refine((value) => {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Le fuseau horaire doit être un identifiant IANA valide.");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La date doit être absolue au format AAAA-MM-JJ.").refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}, "La date n'existe pas.");
const isoInstant = z.string().trim().max(80).refine((value) => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}, "La date et l'heure doivent être un instant ISO avec décalage horaire.");
const unknownableDate = z.union([isoDate, z.literal("unknown"), z.literal("not_applicable")]).optional();
const unknownableInstant = z.union([isoInstant, z.literal("unknown"), z.literal("not_applicable")]).optional();

export const onboardingAnswersSchema = z.object({
  establishment: z.object({
    query: optionalText(240),
    identificationMode: z.enum(["public_search", "manual"]).optional(),
    restaurantName: z.string().trim().min(2).max(120).optional(),
    cityCountry: z.string().trim().min(2).max(160).optional(),
    address: unknownableText(300),
    phone: unknownableText(40),
    timezone: ianaTimezone.optional(),
    identityConfirmed: z.boolean().default(false),
    siteCount: z.enum(["single", "multiple", "unknown"]).default("unknown"),
    sourceReferences: z.array(z.object({
      label: z.string().trim().min(1).max(120),
      value: z.string().trim().min(1).max(500),
      confirmationStatus: onboardingConfirmationStatusSchema.default("suggested"),
    }).strict()).max(12).default([]),
  }).strict().default({ identityConfirmed: false, siteCount: "unknown", sourceReferences: [] }),
  priorities: z.object({
    scope: z.enum(["global", "targeted"]).default("global"),
    timeConsumers: z.array(z.enum(["team", "reservations", "supplier_orders", "customer_communication", "operations", "other"])).max(8).default([]),
    otherText: optionalText(500),
    outcomes: z.array(z.enum(["profitability", "occupancy", "customer_requests", "team_coordination", "service_disruptions", "stock_control", "customer_loyalty"])).max(8).default([]),
    primaryFocus: z.enum(["team", "reservations", "supplier_orders", "customer_communication", "operations", "profitability", "occupancy", "customer_loyalty", "global", "other"]).optional(),
  }).strict().default({ scope: "global", timeConsumers: [], outcomes: [] }),
  interaction: z.object({
    preferredMode: z.enum(["text", "voice", "mixed"]).default("mixed"),
    preferredModeConfirmed: z.boolean().default(false),
    spokenReplies: z.boolean().default(false),
    locale: z.enum(["fr", "en"]).default("fr"),
    theme: z.enum(["dark", "clear"]).default("dark"),
  }).strict().default({ preferredMode: "mixed", preferredModeConfirmed: false, spokenReplies: false, locale: "fr", theme: "dark" }),
  reservations: z.object({
    providers: z.array(z.enum(["zenchef", "sevenrooms", "thefork", "other"])).max(6).default([]),
    otherProvider: optionalText(120),
    methods: z.array(z.enum(["software", "paper", "calendar", "messages", "none", "other"])).max(6).default([]),
    calendarProvider: z.enum(["google_calendar", "outlook", "other"]).optional(),
    otherMethod: optionalText(160),
    authoritativeSystem: z.string().trim().min(1).max(120).or(z.literal("unknown")).default("unknown"),
    connectionStatus: z.literal("declared").default("declared"),
  }).strict().default({ providers: [], methods: [], authoritativeSystem: "unknown", connectionStatus: "declared" }),
  operations: z.object({
    communications: z.object({
      channels: z.array(z.enum(["calls", "whatsapp", "emails", "instagram", "sms", "other"])).max(8).default([]),
      peakContext: z.array(z.enum(["during_service", "when_team_unavailable", "outside_hours", "other"])).max(6).default([]),
      phoneNumber: unknownableText(40),
      overflowTriggers: z.array(z.enum(["busy_line", "no_answer", "outside_hours"])).max(6).default([]),
      humanReviewCategories: z.array(z.enum(["groups", "allergies_sensitive", "privatizations", "complaints", "other"])).max(8).default([]),
      otherText: optionalText(500),
    }).strict().default({ channels: [], peakContext: [], overflowTriggers: [], humanReviewCategories: [] }),
    reservations: z.object({
      friction: z.array(z.enum(["taking_reservations", "changes_cancellations", "groups", "special_requests", "no_shows", "other"])).max(8).default([]),
      groupApprovalThreshold: z.number().int().min(1).max(100).or(z.literal("unknown")).optional(),
      confirmationRuleStatus: z.enum(["yes", "no", "to_define"]).optional(),
      confirmationRuleText: optionalText(500),
      specialRequests: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
      otherText: optionalText(500),
    }).strict().default({ friction: [], specialRequests: [] }),
    team: z.object({
      friction: z.array(z.enum(["planning", "absences", "tasks", "floor_kitchen_coordination", "other"])).max(8).default([]),
      stations: z.array(z.enum(["floor", "kitchen", "bar", "host_reservations", "other"])).max(8).default([]),
      headcount: z.number().int().positive().max(500).or(z.literal("unknown")).optional(),
      otherText: optionalText(500),
    }).strict().default({ friction: [], stations: [] }),
    suppliers: z.object({
      intent: z.enum(["prepare_order", "monitor_stock", "prepare_delivery", "other"]).optional(),
      items: z.array(z.object({
        name: z.string().trim().min(1).max(120).optional(),
        quantity: z.number().positive().max(1_000_000).optional(),
        unit: z.string().trim().min(1).max(40).optional(),
        stockQuantity: z.number().min(0).max(1_000_000).optional(),
        reorderThreshold: z.number().min(0).max(1_000_000).optional(),
      }).strict()).max(20).default([]),
      supplierName: unknownableText(160),
      deliveryDate: unknownableDate,
      deliveryTimeZone: ianaTimezone.optional(),
      unknownFields: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
      otherText: optionalText(500),
    }).strict().default({ items: [], unknownFields: [] }),
    service: z.object({
      phase: z.enum(["before_service", "during_service", "after_service", "other"]).optional(),
      checks: z.array(z.enum(["mise_en_place", "coordination", "special_requests", "closing", "other"])).max(8).default([]),
      nextServiceAt: unknownableInstant,
      timezone: ianaTimezone.optional(),
      scheduleStatus: z.enum(["known", "unknown", "no_fixed_schedule"]).optional(),
      otherText: optionalText(500),
    }).strict().default({ checks: [] }),
    business: z.object({
      focus: z.enum(["purchases", "team", "waste", "unknown", "regulars", "requests_followup", "next_contacts"]).optional(),
      targetServices: z.array(z.string().trim().min(1).max(120)).max(14).default([]),
      knownDataSources: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
      otherText: optionalText(500),
    }).strict().default({ targetServices: [], knownDataSources: [] }),
    global: z.object({
      startingMoment: z.enum(["before_service", "during_service", "after_service", "overview"]).optional(),
      otherSituation: optionalText(500),
      confirmedSummary: optionalText(800),
    }).strict().default({}),
  }).strict().default({
    communications: { channels: [], peakContext: [], overflowTriggers: [], humanReviewCategories: [] },
    reservations: { friction: [], specialRequests: [] },
    team: { friction: [], stations: [] },
    suppliers: { items: [], unknownFields: [] },
    service: { checks: [] },
    business: { targetServices: [], knownDataSources: [] },
    global: {},
  }),
  authority: z.object({
    declaredJobTitle: z.enum(["owner", "general_management", "station_manager", "team", "other"]).optional(),
    station: optionalText(120),
    approvalAssigneeUserId: z.uuid().or(z.literal("unknown")).optional(),
    proposedRules: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      label: z.string().trim().min(1).max(240),
      status: z.enum(["proposed", "confirmed", "rejected"]),
    }).strict()).max(20).default([]),
    rulesAcknowledged: z.boolean().default(false),
  }).strict().default({ proposedRules: [], rulesAcknowledged: false }),
  finalNote: z.object({
    text: optionalText(2000),
    statements: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      kind: z.enum(["fact", "preference", "proposed_rule", "unknown"]),
      fieldPath: z.string().trim().min(1).max(240),
      value: z.string().trim().min(1).max(800),
      source: onboardingSourceTypeSchema,
      status: z.enum(["proposed", "confirmed", "rejected", "needs_clarification"]),
    }).strict()).max(30).default([]),
    conflicts: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
    confirmedStatementIds: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  }).strict().default({ statements: [], conflicts: [], confirmedStatementIds: [] }),
}).strict().superRefine((answers, context) => {
  const { providers, methods, authoritativeSystem, otherProvider, otherMethod, calendarProvider } = answers.reservations;
  if (providers.length > 0 && !methods.includes("software")) {
    context.addIssue({ code: "custom", path: ["reservations", "methods"], message: "Un logiciel déclaré doit conserver la méthode software." });
  }
  if (providers.length === 0 && methods.includes("software")) {
    context.addIssue({ code: "custom", path: ["reservations", "methods"], message: "La méthode software exige un fournisseur déclaré." });
  }
  if (methods.includes("none") && methods.length > 1) {
    context.addIssue({ code: "custom", path: ["reservations", "methods"], message: "Je ne les note pas encore est exclusif des autres méthodes." });
  }
  const declaredSystems = new Set<string>([
    ...providers.filter((provider) => provider !== "other"),
    ...(providers.includes("other") && otherProvider ? [otherProvider] : []),
    ...methods.filter((method) => method !== "software" && method !== "other"),
    ...(methods.includes("other") && otherMethod ? [otherMethod] : []),
    ...(methods.includes("calendar") && calendarProvider ? [calendarProvider] : []),
  ]);
  if (authoritativeSystem !== "unknown" && !declaredSystems.has(authoritativeSystem)) {
    context.addIssue({ code: "custom", path: ["reservations", "authoritativeSystem"], message: "La source de référence doit être l'une des méthodes déclarées." });
  }
  if (answers.operations.reservations.confirmationRuleStatus !== "yes" && answers.operations.reservations.confirmationRuleText) {
    context.addIssue({ code: "custom", path: ["operations", "reservations", "confirmationRuleText"], message: "Une règle détaillée exige une réponse Oui." });
  }
  const confirmedIds = new Set(answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => statement.id));
  if (answers.finalNote.confirmedStatementIds.some((id) => !confirmedIds.has(id))) {
    context.addIssue({ code: "custom", path: ["finalNote", "confirmedStatementIds"], message: "Seule la version actuelle d'une proposition confirmée peut être référencée." });
  }
});

export const onboardingProvenanceSchema = z.object({
  fieldPath: z.string().trim().min(1).max(240),
  sourceType: onboardingSourceTypeSchema,
  sourceReference: z.string().trim().max(500).optional(),
  observedAt: z.iso.datetime(),
  confirmationStatus: onboardingConfirmationStatusSchema,
  confirmedBy: z.uuid().optional(),
  confirmedAt: z.iso.datetime().optional(),
}).strict();

export const onboardingDraftSaveSchema = z.object({
  restaurantId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  currentSection: onboardingSectionSchema,
  answers: onboardingAnswersSchema,
  provenance: z.array(onboardingProvenanceSchema).max(80).default([]),
}).strict();

export const onboardingCompleteSchema = z.object({
  restaurantId: z.uuid(),
  expectedRevision: z.number().int().min(0),
  idempotencyKey: z.string().trim().min(12).max(120),
  termsVersion: z.literal(onboardingLegalVersions.terms),
  dpaVersion: z.literal(onboardingLegalVersions.dpa),
  acceptTerms: z.literal(true),
  acceptDpa: z.literal(true),
}).strict();

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
export type OnboardingAnswers = z.infer<typeof onboardingAnswersSchema>;
export type OnboardingDraftSaveInput = z.infer<typeof onboardingDraftSaveSchema>;
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;
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

export interface OnboardingDraftView {
  id: string;
  tenantId: string;
  restaurantId: string;
  schemaVersion: number;
  revision: number;
  status: "draft" | "awaiting_authority" | "completed";
  currentSection: z.infer<typeof onboardingSectionSchema>;
  confirmedSections: Array<Exclude<z.infer<typeof onboardingSectionSchema>, "review">>;
  answers: OnboardingAnswers;
  provenance: Array<z.infer<typeof onboardingProvenanceSchema>>;
  updatedAt: string;
  completedAt: string | null;
  firstResultId: string | null;
  restaurants: Array<{ id: string; name: string; cityCountry: string | null; timezone: string }>;
  legalVersions: typeof onboardingLegalVersions;
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
