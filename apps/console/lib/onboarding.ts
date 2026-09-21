import type { OnboardingAnswers, OnboardingDraftView } from "@tablenow/contracts";

export type SectionKey = OnboardingDraftView["currentSection"];
export type LocaleMode = OnboardingAnswers["interaction"]["locale"];
export type PrimaryFocus = NonNullable<OnboardingAnswers["priorities"]["primaryFocus"]>;
export type StatementSource = "user_text" | "user_voice";
export type OnboardingProvenance = OnboardingDraftView["provenance"];
export type OnboardingSourceType = OnboardingProvenance[number]["sourceType"];

export function emptyOnboardingAnswers(): OnboardingAnswers {
  return {
    establishment: { identityConfirmed: false, siteCount: "unknown", sourceReferences: [] },
    priorities: { scope: "global", timeConsumers: [], outcomes: [] },
    interaction: { preferredMode: "mixed", preferredModeConfirmed: false, spokenReplies: false, locale: "fr", theme: "dark" },
    reservations: { providers: [], methods: [], authoritativeSystem: "unknown", connectionStatus: "declared" },
    operations: defaultOperations(),
    authority: { proposedRules: [], rulesAcknowledged: false },
    finalNote: { statements: [], conflicts: [], confirmedStatementIds: [] },
  };
}

export function defaultOperations(): OnboardingAnswers["operations"] {
  return {
    communications: { channels: [], peakContext: [], overflowTriggers: [], humanReviewCategories: [] },
    reservations: { friction: [], specialRequests: [] },
    team: { friction: [], stations: [] },
    suppliers: { items: [], unknownFields: [] },
    service: { checks: [] },
    business: { targetServices: [], knownDataSources: [] },
    global: {},
  };
}

export function mergeOnboardingAnswers(input: OnboardingAnswers): OnboardingAnswers {
  const empty = emptyOnboardingAnswers();
  return {
    ...empty,
    ...input,
    establishment: { ...empty.establishment, ...input.establishment },
    priorities: { ...empty.priorities, ...input.priorities },
    interaction: { ...empty.interaction, ...input.interaction },
    reservations: { ...empty.reservations, ...input.reservations },
    operations: {
      communications: { ...empty.operations.communications, ...input.operations.communications },
      reservations: { ...empty.operations.reservations, ...input.operations.reservations },
      team: { ...empty.operations.team, ...input.operations.team },
      suppliers: { ...empty.operations.suppliers, ...input.operations.suppliers },
      service: { ...empty.operations.service, ...input.operations.service },
      business: { ...empty.operations.business, ...input.operations.business },
      global: { ...empty.operations.global, ...input.operations.global },
    },
    authority: { ...empty.authority, ...input.authority },
    finalNote: { ...empty.finalNote, ...input.finalNote },
  };
}

export function setPrimaryFocus(answers: OnboardingAnswers, focus: PrimaryFocus): boolean {
  const changedBranch = answers.priorities.primaryFocus !== undefined && answers.priorities.primaryFocus !== focus;
  answers.priorities.primaryFocus = focus;
  // Switching the visible priority must not erase previously declared answers.
  return changedBranch;
}

export function setReservationProviders(
  answers: OnboardingAnswers,
  providers: OnboardingAnswers["reservations"]["providers"],
): void {
  answers.reservations.providers = providers;
  answers.reservations.methods = providers.length
    ? Array.from(new Set([...answers.reservations.methods.filter((method) => method !== "none"), "software" as const]))
    : answers.reservations.methods.filter((method) => method !== "software");
  reconcileReservationReference(answers);
}

export function setReservationMethods(
  answers: OnboardingAnswers,
  methods: OnboardingAnswers["reservations"]["methods"],
): void {
  answers.reservations.methods = methods.includes("none") ? ["none"] : methods;
  if (answers.reservations.methods.includes("none")) answers.reservations.providers = [];
  // Keep historical details so restoring a method restores its answers.
  reconcileReservationReference(answers);
}

export function reservationReferences(answers: OnboardingAnswers): string[] {
  return Array.from(new Set([
    ...answers.reservations.providers.map((provider) => provider === "other" ? answers.reservations.otherProvider : provider),
    ...answers.reservations.methods.flatMap((method) => {
      if (method === "software") return [];
      if (method === "calendar") return answers.reservations.calendarProvider ? [answers.reservations.calendarProvider] : [];
      if (method === "other") return answers.reservations.otherMethod ? [answers.reservations.otherMethod] : [];
      return [method];
    }),
  ].filter((value): value is string => Boolean(value))));
}

export function reconcileReservationReference(answers: OnboardingAnswers): void {
  const references = reservationReferences(answers);
  if (references.length === 1) answers.reservations.authoritativeSystem = references[0]!;
  else if (!references.includes(answers.reservations.authoritativeSystem)) answers.reservations.authoritativeSystem = "unknown";
}

export function inferPriorityCandidates(text: string): PrimaryFocus[] {
  const normalized = normalizeText(text);
  const candidates: PrimaryFocus[] = [];
  const add = (focus: PrimaryFocus, pattern: RegExp) => { if (pattern.test(normalized)) candidates.push(focus); };
  add("supplier_orders", /commande|fournisseur|achat|stock|inventory|supplier|order/);
  add("customer_communication", /appel|telephone|whatsapp|message|client|customer|call/);
  add("reservations", /reservation|booking/);
  add("team", /equipe|planning|absence|staff|team|schedule/);
  add("operations", /service|mise en place|operation/);
  add("profitability", /rentabil|cout|marge|profit|cost/);
  add("occupancy", /remplissage|occupation|fill|occupancy/);
  add("customer_loyalty", /fidel|habitu|loyal|regular/);
  return Array.from(new Set(candidates));
}

export function inferReservationProviders(text: string): OnboardingAnswers["reservations"]["providers"] {
  const normalized = normalizeText(text);
  const providers: OnboardingAnswers["reservations"]["providers"] = [];
  if (/zenchef/.test(normalized)) providers.push("zenchef");
  if (/sevenrooms|seven rooms/.test(normalized)) providers.push("sevenrooms");
  if (/thefork|the fork|lafourchette/.test(normalized)) providers.push("thefork");
  return providers;
}

export function applyFreeText(
  input: OnboardingAnswers,
  section: SectionKey,
  rawText: string,
  source: StatementSource,
): OnboardingAnswers {
  const answers = structuredClone(input);
  const text = rawText.trim();
  if (section === "final_note" && !text) {
    answers.finalNote.text = "";
    answers.finalNote.statements = answers.finalNote.statements.filter((statement) => statement.source !== source || statement.status === "confirmed");
    answers.finalNote.conflicts = statementConflicts(answers.finalNote.statements);
    answers.finalNote.confirmedStatementIds = answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => statement.id);
    return answers;
  }
  if (!text) return answers;

  if (section === "establishment") {
    answers.establishment.query = text;
    if (!answers.establishment.restaurantName) answers.establishment.restaurantName = text.split(",")[0]?.trim() || text;
    if (!answers.establishment.cityCountry && text.includes(",")) answers.establishment.cityCountry = text.split(",").slice(1).join(",").trim();
    answers.establishment.identityConfirmed = false;
  } else if (section === "priorities") {
    answers.priorities.otherText = text;
  } else if (section === "interaction") {
    const normalized = normalizeText(text);
    const mode = /\b(les deux|both|mixed|ecrit et voix|text and voice)\b/.test(normalized) ? "mixed"
      : /\b(voix|vocal|voice|speak|parler)\b/.test(normalized) ? "voice"
      : /\b(ecrit|texte|text|write|writing)\b/.test(normalized) ? "text" : undefined;
    if (mode) {
      answers.interaction.preferredMode = mode;
      answers.interaction.preferredModeConfirmed = false;
    }
  } else if (section === "reservations") {
    answers.reservations.otherMethod = text;
    if (!answers.reservations.methods.includes("other")) answers.reservations.methods.push("other");
  } else if (section === "operations") {
    applyOperationText(answers, text);
  } else if (section === "authority") {
    answers.authority.station = text;
  } else if (section === "final_note") {
    answers.finalNote.text = text;
    answers.finalNote.statements = mergeStatements(answers.finalNote.statements, statementsFrom(text, source), source);
    answers.finalNote.conflicts = statementConflicts(answers.finalNote.statements);
    answers.finalNote.confirmedStatementIds = answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => statement.id);
  } else {
    answers.operations.global.confirmedSummary = text;
  }
  return answers;
}

export function confirmPriorityText(answers: OnboardingAnswers): PrimaryFocus[] {
  const candidates = inferPriorityCandidates(answers.priorities.otherText || "");
  if (!candidates.length) return [];
  answers.priorities.scope = "targeted";
  const timeConsumers = candidates.flatMap((focus) => {
    if (["team", "reservations", "supplier_orders", "customer_communication", "operations"].includes(focus)) return [focus as "team" | "reservations" | "supplier_orders" | "customer_communication" | "operations"];
    return [];
  });
  answers.priorities.timeConsumers = Array.from(new Set([...answers.priorities.timeConsumers, ...timeConsumers]));
  if (candidates.length === 1) setPrimaryFocus(answers, candidates[0]!);
  return candidates;
}

export function confirmReservationText(answers: OnboardingAnswers): string[] {
  const providers = inferReservationProviders(answers.reservations.otherMethod || "");
  if (providers.length) {
    answers.reservations.methods = answers.reservations.methods.filter((method) => method !== "other");
    delete answers.reservations.otherMethod;
    setReservationProviders(answers, Array.from(new Set([...answers.reservations.providers, ...providers])));
  }
  return reservationReferences(answers);
}

export function confirmStatement(answers: OnboardingAnswers, statementId: string): void {
  const selected = answers.finalNote.statements.find((statement) => statement.id === statementId);
  if (!selected) return;
  for (const statement of answers.finalNote.statements) {
    if (statement.id === statementId) statement.status = "confirmed";
    else if (answers.finalNote.conflicts.some(conflict => conflict === `${statement.id}:${selected.id}` || conflict === `${selected.id}:${statement.id}`)) statement.status = "rejected";
  }
  if (selected.kind === "proposed_rule") {
    answers.authority.proposedRules = [
      ...answers.authority.proposedRules.filter((rule) => rule.id !== selected.id),
      { id: selected.id, label: selected.value, status: "proposed" },
    ];
  }
  answers.finalNote.confirmedStatementIds = answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => statement.id);
  answers.finalNote.conflicts = statementConflicts(answers.finalNote.statements);
}

export function reviewableStatements(answers: OnboardingAnswers) {
  return answers.finalNote.statements.filter(statement => statement.status !== "rejected");
}

export function editStatement(answers: OnboardingAnswers, statementId: string, value: string): void {
  const selected = answers.finalNote.statements.find(statement => statement.id === statementId);
  const trimmed = value.trim();
  if (!selected || !trimmed || trimmed === selected.value) return;
  const parsed = statementsFrom(trimmed, "user_text")[0];
  if (!parsed) return;
  const text = answers.finalNote.text || "";
  answers.finalNote.text = text.includes(selected.value) ? text.replace(selected.value, trimmed) : [text, trimmed].filter(Boolean).join("\n\n");
  Object.assign(selected, { kind: parsed.kind, fieldPath: parsed.fieldPath, value: trimmed, source: "user_text", status: "proposed" });
  answers.authority.proposedRules = answers.authority.proposedRules.filter(rule => rule.id !== statementId);
  answers.finalNote.confirmedStatementIds = answers.finalNote.confirmedStatementIds.filter(id => id !== statementId);
  answers.finalNote.conflicts = statementConflicts(answers.finalNote.statements);
}

export function removeStatement(answers: OnboardingAnswers, statementId: string): void {
  const selected = answers.finalNote.statements.find(statement => statement.id === statementId);
  if (!selected) return;
  answers.finalNote.text = (answers.finalNote.text || "").replace(selected.value, "").replace(/\n{3,}/g, "\n\n").trim();
  answers.finalNote.statements = answers.finalNote.statements.filter((statement) => statement.id !== statementId);
  answers.authority.proposedRules = answers.authority.proposedRules.filter((rule) => rule.id !== statementId);
  answers.finalNote.confirmedStatementIds = answers.finalNote.confirmedStatementIds.filter((id) => id !== statementId);
  answers.finalNote.conflicts = statementConflicts(answers.finalNote.statements);
}

export function statementsFrom(text: string, source: StatementSource): OnboardingAnswers["finalNote"]["statements"] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((value) => {
      const normalized = normalizeText(value);
      const kind = /je prefere|we prefer/.test(normalized) ? "preference"
        : /toujours|jamais|doit|doivent|must|always|never/.test(normalized) ? "proposed_rule"
        : /je ne sais|inconnu|unknown/.test(normalized) ? "unknown"
        : "fact";
      const fieldPath = kind === "proposed_rule" ? "answers.authority.proposedRules" : "answers.finalNote.text";
      return { id: `statement-${hashText(`${source}:${value}`)}`, kind, fieldPath, value, source, status: "proposed" as const };
    });
}

export function sectionValid(section: SectionKey, answers: OnboardingAnswers): boolean {
  if (section === "establishment") return Boolean(answers.establishment.restaurantName?.trim() && answers.establishment.cityCountry?.trim() && answers.establishment.identityConfirmed);
  if (section === "priorities") return Boolean(answers.priorities.primaryFocus) && (answers.priorities.scope === "global" || Boolean(answers.priorities.timeConsumers.length || answers.priorities.otherText?.trim()));
  if (section === "interaction") return true; // Preference can be completed later.
  if (section === "reservations") {
    const references = reservationReferences(answers);
    const pendingProviders = inferReservationProviders(answers.reservations.methods.includes("other") ? answers.reservations.otherMethod || "" : "")
      .filter((provider) => !answers.reservations.providers.includes(provider));
    return (answers.systems?.pointOfSale.status !== "declared" || Boolean(answers.systems.pointOfSale.name?.trim()))
      && Boolean(answers.reservations.methods.length || answers.reservations.providers.length)
      && (!answers.reservations.providers.includes("other") || Boolean(answers.reservations.otherProvider?.trim()))
      && (!answers.reservations.methods.includes("other") || Boolean(answers.reservations.otherMethod?.trim()))
      && (!answers.reservations.methods.includes("calendar") || Boolean(answers.reservations.calendarProvider))
      && pendingProviders.length === 0
      && (references.length <= 1 || answers.reservations.authoritativeSystem !== "unknown");
  }
  if (section === "operations") return true; // Optional details remain editable in Complements.
  if (section === "authority") return answers.authority.rulesAcknowledged;
  return true;
}

export function operationValid(answers: OnboardingAnswers): boolean {
  const focus = answers.priorities.primaryFocus;
  if (focus === "supplier_orders") {
    const deliveryDate = answers.operations.suppliers.deliveryDate;
    const deliveryTimeZoneReady = !deliveryDate || ["unknown", "not_applicable"].includes(deliveryDate) || Boolean(answers.operations.suppliers.deliveryTimeZone);
    return Boolean(answers.operations.suppliers.intent && !answers.operations.suppliers.unknownFields.includes("proposal_pending") && deliveryTimeZoneReady);
  }
  if (focus === "customer_communication") return Boolean(answers.operations.communications.channels.length && answers.operations.communications.peakContext.length);
  if (focus === "reservations") return Boolean(answers.operations.reservations.friction.length);
  if (focus === "team") return Boolean(answers.operations.team.friction.length && answers.operations.team.stations.length);
  if (focus === "operations") {
    const nextServiceAt = answers.operations.service.nextServiceAt;
    const serviceTimeZoneReady = !nextServiceAt || ["unknown", "not_applicable"].includes(nextServiceAt) || Boolean(answers.operations.service.timezone);
    return Boolean(answers.operations.service.phase && answers.operations.service.checks.length && serviceTimeZoneReady);
  }
  if (focus === "occupancy") return true;
  if (focus === "profitability" || focus === "customer_loyalty") return Boolean(answers.operations.business.focus);
  return Boolean(answers.operations.global.startingMoment || answers.operations.global.confirmedSummary);
}

export function updateProvenanceForAnswerChange(
  existing: OnboardingProvenance,
  before: OnboardingAnswers,
  after: OnboardingAnswers,
  sourceType: OnboardingSourceType,
  confirmationStatus: OnboardingProvenance[number]["confirmationStatus"],
  sourceReference?: string,
): OnboardingProvenance {
  const changedPaths = changedAnswerPaths(before, after).filter((fieldPath) => ![
    "answers.finalNote.statements",
    "answers.finalNote.conflicts",
    "answers.finalNote.confirmedStatementIds",
  ].includes(fieldPath));
  if (!changedPaths.length) return existing;
  const changed = new Set(changedPaths);
  const retained = existing.filter((entry) => !changed.has(entry.fieldPath));
  const observedAt = new Date().toISOString();
  const additions = changedPaths.flatMap((fieldPath) => {
    const value = answerPathValue(after, fieldPath);
    if (!hasMeaningfulValue(value)) return [];
    return [{
      fieldPath,
      sourceType,
      ...(sourceReference ? { sourceReference: sourceReference.trim().slice(0, 500) } : {}),
      observedAt,
      confirmationStatus,
    }];
  });
  return [...retained, ...additions].slice(-80);
}

export function confirmProvenanceForSection(existing: OnboardingProvenance, section: SectionKey): OnboardingProvenance {
  return existing.map((entry) => entry.confirmationStatus === "suggested" && provenanceSection(entry.fieldPath) === section
    ? { ...entry, confirmationStatus: "confirmed" as const }
    : entry);
}

export function hasPendingProvenance(existing: OnboardingProvenance, section: SectionKey): boolean {
  if (section === "final_note") return false;
  return existing.some((entry) => entry.confirmationStatus === "suggested"
    && ["user_text", "user_voice", "public_suggestion"].includes(entry.sourceType)
    && provenanceSection(entry.fieldPath) === section);
}

export function provenanceFor(answers: OnboardingAnswers, existing: OnboardingProvenance = []): OnboardingProvenance {
  const observedAt = new Date().toISOString();
  const retained = existing.filter((entry) => {
    if (entry.fieldPath === "answers.establishment") return answers.establishment.identityConfirmed;
    if (entry.fieldPath === "answers.finalNote.text") return answers.finalNote.statements.some((statement) => statement.value.slice(0, 500) === entry.sourceReference);
    return hasMeaningfulValue(answerPathValue(answers, entry.fieldPath));
  });
  const entries: OnboardingProvenance = [...retained];
  if (answers.establishment.identityConfirmed && !entries.some((entry) => entry.fieldPath === "answers.establishment" && entry.confirmationStatus === "confirmed")) {
    entries.push({ fieldPath: "answers.establishment", sourceType: "user_form", observedAt, confirmationStatus: "confirmed" });
  }
  for (const statement of answers.finalNote.statements) {
    const sourceReference = statement.value.slice(0, 500);
    const confirmationStatus = statement.status === "confirmed" ? "confirmed" as const : statement.status === "rejected" ? "rejected" as const : "suggested" as const;
    const existingIndex = entries.findIndex((entry) => entry.fieldPath === statement.fieldPath && entry.sourceType === statement.source && entry.sourceReference === sourceReference);
    const entry = { fieldPath: statement.fieldPath, sourceType: statement.source, sourceReference, observedAt: existingIndex >= 0 ? entries[existingIndex]!.observedAt : observedAt, confirmationStatus };
    if (existingIndex >= 0) entries[existingIndex] = { ...entries[existingIndex]!, ...entry };
    else entries.push(entry);
  }
  return entries.slice(-80);
}

export function firstResultTitle(answers: OnboardingAnswers): string {
  const focus = answers.priorities.primaryFocus;
  if (focus === "supplier_orders") return answers.operations.suppliers.items[0]?.quantity ? "Votre commande est préparée" : "Votre commande à compléter";
  if (focus === "customer_communication") return "Votre renfort client est défini";
  if (focus === "reservations") return "Vos règles de réservation sont préparées";
  if (focus === "team") return "Votre premier briefing est préparé";
  if (focus === "profitability") return "Votre plan d'analyse est préparé";
  if (focus === "occupancy") return answers.operations.business.targetServices.length ? "Vos services prioritaires sont identifiés" : "Votre plan de remplissage à préciser";
  if (focus === "customer_loyalty") return "Votre suivi client est préparé";
  return "Votre préparation de service est prête";
}

function mergeStatements(
  existing: OnboardingAnswers["finalNote"]["statements"],
  incoming: OnboardingAnswers["finalNote"]["statements"],
  source: StatementSource,
): OnboardingAnswers["finalNote"]["statements"] {
  const retained = existing.filter((statement) => statement.source !== source || statement.status === "confirmed");
  const byId = new Map(retained.map((statement) => [statement.id, statement]));
  for (const statement of incoming) byId.set(statement.id, statement);
  return Array.from(byId.values()).slice(0, 30);
}

function applyOperationText(answers: OnboardingAnswers, text: string): void {
  const normalized = normalizeText(text);
  const focus = answers.priorities.primaryFocus || "global";
  if (focus === "supplier_orders") {
    const branch = answers.operations.suppliers;
    branch.otherText = text;
    if (/\b(command|commande|order|acheter|buy)\w*\b/.test(normalized)) branch.intent = "prepare_order";
    else if (/\b(stock|inventaire|inventory)\w*\b/.test(normalized)) branch.intent = "monitor_stock";
    else if (/\b(livraison|reception|delivery|receiv)\w*\b/.test(normalized)) branch.intent = "prepare_delivery";
    const match = text.match(/([\d,.]+)\s*(kg|g|l|ml|unités?|unites?|units?|bouteilles?|bottles?)\s+(?:de\s+|of\s+)?(.+?)(?:\s+(?:livraison|delivery)\s+(.+))?$/i);
    if (match) {
      branch.items[0] = {
        name: match[3]!.trim(),
        quantity: Number(match[1]!.replace(",", ".")),
        unit: match[2]!.trim(),
      };
      branch.unknownFields = Array.from(new Set([...branch.unknownFields, "proposal_pending"]));
    }
    const relativeDate = text.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|demain|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0];
    if (relativeDate) {
      branch.deliveryDate = "unknown";
      branch.unknownFields = Array.from(new Set([...branch.unknownFields, `deliveryDate:${relativeDate}`]));
    }
    return;
  }
  if (focus === "customer_communication") {
    const branch = answers.operations.communications;
    branch.otherText = text;
    branch.channels = unionMatches(branch.channels, normalized, [
      ["calls", /\b(appel|telephone|phone|call)\w*\b/], ["whatsapp", /\bwhatsapp\b/],
      ["emails", /\b(e-?mail|courriel)\w*\b/], ["instagram", /\binstagram\b/], ["sms", /\bsms\b/],
    ]);
    branch.peakContext = unionMatches(branch.peakContext, normalized, [
      ["during_service", /pendant le service|during service/], ["when_team_unavailable", /equipe ne repond|team (?:cannot|can't) answer|indisponible/],
      ["outside_hours", /hors horaires|outside (?:opening )?hours|apres la fermeture/],
    ]);
    return;
  }
  if (focus === "reservations") {
    const branch = answers.operations.reservations;
    branch.otherText = text;
    branch.friction = unionMatches(branch.friction, normalized, [
      ["taking_reservations", /prendre les reservations|prise des reservations|taking reservations/],
      ["changes_cancellations", /modification|annulation|chang|cancel/], ["groups", /\b(group|groupe)\w*\b/],
      ["special_requests", /demande particuliere|special request|allerg/], ["no_shows", /no.?show|absence client/],
    ]);
    return;
  }
  if (focus === "team") {
    const branch = answers.operations.team;
    branch.otherText = text;
    branch.friction = unionMatches(branch.friction, normalized, [
      ["planning", /planning|schedule|rota/], ["absences", /absence/], ["tasks", /tache|task|repartir/],
      ["floor_kitchen_coordination", /salle.*cuisine|cuisine.*salle|floor.*kitchen|kitchen.*floor/],
    ]);
    branch.stations = unionMatches(branch.stations, normalized, [
      ["floor", /\b(salle|floor)\b/], ["kitchen", /\b(cuisine|kitchen)\b/], ["bar", /\bbar\b/],
      ["host_reservations", /accueil|host|reservation/],
    ]);
    return;
  }
  if (focus === "operations") {
    const branch = answers.operations.service;
    branch.otherText = text;
    branch.phase = firstMatch(normalized, [
      ["before_service", /avant le service|before service/], ["during_service", /pendant le service|during service/],
      ["after_service", /apres le service|after service/],
    ]) || branch.phase;
    branch.checks = unionMatches(branch.checks, normalized, [
      ["mise_en_place", /mise en place/], ["coordination", /coordination/], ["special_requests", /demande particuliere|special request|allerg/], ["closing", /fermeture|closing/],
    ]);
    return;
  }
  if (["profitability", "occupancy", "customer_loyalty"].includes(focus)) {
    const branch = answers.operations.business;
    branch.otherText = text;
    if (focus === "profitability") branch.focus = firstMatch(normalized, [["purchases", /achat|purchas/], ["team", /equipe|team|staff/], ["waste", /gaspillage|waste/]]) || branch.focus;
    else if (focus === "customer_loyalty") branch.focus = firstMatch(normalized, [["regulars", /habitue|regular/], ["requests_followup", /suivi.*demande|request.*follow/], ["next_contacts", /prochain.*contact|next.*contact/]]) || branch.focus;
    else if (text.trim()) branch.targetServices = Array.from(new Set([...branch.targetServices, text.trim()]));
    return;
  }
  answers.operations.global.otherSituation = text;
  answers.operations.global.confirmedSummary = text;
}

function unionMatches<T extends string>(current: T[], text: string, candidates: Array<[T, RegExp]>): T[] {
  return Array.from(new Set([...current, ...candidates.filter(([, pattern]) => pattern.test(text)).map(([value]) => value)]));
}

function firstMatch<T extends string>(text: string, candidates: Array<[T, RegExp]>): T | undefined {
  return candidates.find(([, pattern]) => pattern.test(text))?.[0];
}

function statementConflicts(statements: OnboardingAnswers["finalNote"]["statements"]): string[] {
  const active = statements.filter((statement) => statement.status !== "rejected");
  const conflicts: string[] = [];
  for (let left = 0; left < active.length; left += 1) {
    for (let right = left + 1; right < active.length; right += 1) {
      if (active[left]!.fieldPath === active[right]!.fieldPath && active[left]!.value !== active[right]!.value && active[left]!.source !== active[right]!.source) {
        conflicts.push(`${active[left]!.id}:${active[right]!.id}`);
      }
    }
  }
  return conflicts.slice(0, 12);
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function hashText(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

function changedAnswerPaths(before: unknown, after: unknown, prefix = "answers"): string[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) || Array.isArray(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [prefix];
  }
  if (before === null || after === null || typeof before !== "object" || typeof after !== "object") {
    return [prefix];
  }
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  return Array.from(new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]))
    .flatMap((key) => changedAnswerPaths(beforeRecord[key], afterRecord[key], `${prefix}.${key}`));
}

function answerPathValue(answers: OnboardingAnswers, fieldPath: string): unknown {
  const segments = fieldPath.replace(/^answers\.?/, "").split(".").filter(Boolean);
  let value: unknown = answers;
  for (const segment of segments) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function provenanceSection(fieldPath: string): SectionKey | undefined {
  if (fieldPath.startsWith("answers.establishment")) return "establishment";
  if (fieldPath.startsWith("answers.priorities")) return "priorities";
  if (fieldPath.startsWith("answers.interaction")) return "interaction";
  if (fieldPath.startsWith("answers.reservations")) return "reservations";
  if (fieldPath.startsWith("answers.operations")) return "operations";
  if (fieldPath.startsWith("answers.authority")) return "authority";
  if (fieldPath.startsWith("answers.finalNote")) return "final_note";
  return undefined;
}
