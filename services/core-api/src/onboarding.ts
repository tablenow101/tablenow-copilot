import {
  onboardingAnswersSchema,
  onboardingSectionOrder as contractOnboardingSectionOrder,
  type OnboardingAnswers,
  type OnboardingDraftView,
  type OnboardingInput,
  type Role,
} from "@tablenow/contracts";

export interface OnboardingFirstResultDraft {
  kind: "supplier_order" | "customer_communication" | "reservations" | "team" | "service" | "profitability" | "occupancy" | "customer_loyalty" | "global";
  status: "draft" | "needs_information" | "ready_for_review";
  title: string;
  confirmedFacts: string[];
  recommendations: string[];
  unknownFields: string[];
  sourceFieldPaths: string[];
  businessArtifact: Record<string, unknown>;
}

type OnboardingLocale = OnboardingAnswers["interaction"]["locale"];

export class OnboardingIncompleteError extends Error {
  public constructor(public readonly fieldErrors: Record<string, string[]>) {
    super("ONBOARDING_INCOMPLETE");
  }
}

type OnboardingSection = OnboardingDraftView["currentSection"];
type ConfirmableSection = Exclude<OnboardingSection, "review">;

export const onboardingSectionOrder: OnboardingSection[] = [
  ...contractOnboardingSectionOrder,
];

export function initialOnboardingAnswers(input: {
  tenantName: string;
  restaurantName: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  interaction?: OnboardingAnswers["interaction"];
}): OnboardingAnswers {
  return onboardingAnswersSchema.parse({
    establishment: {
      query: input.restaurantName || input.tenantName,
      identificationMode: "manual",
      restaurantName: input.restaurantName,
      address: input.address || "unknown",
      phone: input.phone || "unknown",
      timezone: input.timezone,
      identityConfirmed: false,
      siteCount: "unknown",
      sourceReferences: [],
    },
    ...(input.interaction ? { interaction: input.interaction } : {}),
  });
}

export function normalizeOnboardingAnswers(input: OnboardingAnswers): OnboardingAnswers {
  // Stored answers are lossless. Selection only changes the active projection.
  return structuredClone(onboardingAnswersSchema.parse(input));
}

function activeOnboardingAnswers(input: OnboardingAnswers): OnboardingAnswers {
  const answers = structuredClone(onboardingAnswersSchema.parse(input));
  const defaults = onboardingAnswersSchema.parse({}).operations;
  const focus = answers.priorities.primaryFocus;
  const activeBranch = focus === "customer_communication" ? "communications"
    : focus === "reservations" ? "reservations"
    : focus === "team" ? "team"
    : focus === "supplier_orders" ? "suppliers"
    : focus === "operations" ? "service"
    : ["profitability", "occupancy", "customer_loyalty"].includes(focus || "") ? "business"
    : "global";

  for (const branch of ["communications", "reservations", "team", "suppliers", "service", "business", "global"] as const) {
    if (branch !== activeBranch) answers.operations[branch] = structuredClone(defaults[branch]) as never;
  }

  if (!answers.operations.communications.channels.includes("calls")) {
    delete answers.operations.communications.phoneNumber;
    answers.operations.communications.overflowTriggers = [];
  }
  if (!answers.operations.reservations.friction.includes("groups")) {
    delete answers.operations.reservations.groupApprovalThreshold;
  }
  if (!answers.operations.reservations.friction.includes("no_shows")) {
    delete answers.operations.reservations.confirmationRuleStatus;
    delete answers.operations.reservations.confirmationRuleText;
  } else if (answers.operations.reservations.confirmationRuleStatus !== "yes") {
    delete answers.operations.reservations.confirmationRuleText;
  }

  if (!answers.reservations.providers.includes("other")) delete answers.reservations.otherProvider;
  if (!answers.reservations.methods.includes("other")) delete answers.reservations.otherMethod;
  if (!answers.reservations.methods.includes("calendar")) delete answers.reservations.calendarProvider;
  if (answers.reservations.methods.includes("none")) {
    answers.reservations.providers = [];
    answers.reservations.methods = ["none"];
    answers.reservations.authoritativeSystem = "unknown";
  }
  const references = reservationReferences(answers);
  if (references.length === 1) answers.reservations.authoritativeSystem = references[0]!;
  else if (!references.includes(answers.reservations.authoritativeSystem)) answers.reservations.authoritativeSystem = "unknown";

  if (answers.operations.service.scheduleStatus && answers.operations.service.scheduleStatus !== "known") {
    answers.operations.service.nextServiceAt = answers.operations.service.scheduleStatus === "no_fixed_schedule" ? "not_applicable" : "unknown";
    delete answers.operations.service.timezone;
  }
  const confirmedIds = new Set(answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => statement.id));
  answers.finalNote.confirmedStatementIds = answers.finalNote.confirmedStatementIds.filter((id) => confirmedIds.has(id));
  return onboardingAnswersSchema.parse(answers);
}

export function updateConfirmedSections(
  storedSection: OnboardingSection,
  targetSection: OnboardingSection,
  confirmedSections: ConfirmableSection[],
  answers: OnboardingAnswers,
  answersChanged = true,
): ConfirmableSection[] {
  const storedIndex = onboardingSectionOrder.indexOf(storedSection);
  const targetIndex = onboardingSectionOrder.indexOf(targetSection);
  if (storedIndex < 0 || targetIndex < 0) throw new Error("ONBOARDING_INVALID_TRANSITION");
  const groupedTransition = (storedSection === "establishment" && targetSection === "reservations")
    || (["operations", "authority"].includes(storedSection) && targetSection === "review");
  if (targetIndex > storedIndex + 1 && !groupedTransition) throw new Error("ONBOARDING_INVALID_TRANSITION");
  if (targetIndex < storedIndex) {
    return answersChanged
      ? confirmedSections.filter((section) => onboardingSectionOrder.indexOf(section) < targetIndex)
      : confirmedSections;
  }
  if (targetIndex === storedIndex) {
    return answersChanged
      ? confirmedSections.filter((section) => onboardingSectionOrder.indexOf(section) < storedIndex)
      : confirmedSections;
  }
  const retained = confirmedSections.filter((section) => onboardingSectionOrder.indexOf(section) <= storedIndex);
  for (const passed of onboardingSectionOrder.slice(storedIndex, targetIndex)) {
    // Authority remains explicitly required at final completion, never inferred from navigation.
    if (passed === "authority" && !answers.authority.rulesAcknowledged) continue;
    validateOnboardingSection(passed, answers);
    if (passed === "review" || (passed === "interaction" && !answers.interaction.preferredModeConfirmed)) continue;
    if (!retained.includes(passed)) retained.push(passed);
  }
  return retained;
}

export function validateOnboardingCompletion(
  role: Role,
  userId: string | null,
  input: OnboardingAnswers,
  currentSection: OnboardingSection,
  confirmedSections: ConfirmableSection[],
): OnboardingAnswers {
  if (!userId) throw new Error("USER_REQUIRED");
  if (!["platform_admin", "owner", "group_admin"].includes(role)) throw new Error("ONBOARDING_AUTHORITY_REQUIRED");
  const answers = normalizeOnboardingAnswers(input);
  if (currentSection !== "review") throw new Error("ONBOARDING_INVALID_TRANSITION");
  const requiredSections: ConfirmableSection[] = ["priorities", "establishment", "reservations"];
  if (requiredSections.some((section) => !confirmedSections.includes(section))) throw new Error("ONBOARDING_INVALID_TRANSITION");
  for (const section of [...requiredSections, "operations", "authority"] as const) validateOnboardingSection(section, answers);
  return answers;
}

export function validateOnboardingSection(section: OnboardingSection, storedAnswers: OnboardingAnswers): void {
  const answers = activeOnboardingAnswers(storedAnswers);
  const errors: Record<string, string[]> = {};
  const requireField = (path: string, condition: boolean, message: string) => {
    if (!condition) errors[path] = [message];
  };

  if (section === "establishment") {
    requireField("answers.establishment.restaurantName", Boolean(answers.establishment.restaurantName), "Le nom de l'établissement est requis.");
    requireField("answers.establishment.cityCountry", Boolean(answers.establishment.cityCountry), "La ville et le pays sont requis.");
    requireField("answers.establishment.identityConfirmed", answers.establishment.identityConfirmed, "Confirmez l'identité de l'établissement.");
  } else if (section === "priorities") {
    requireField("answers.priorities.primaryFocus", Boolean(answers.priorities.primaryFocus), "Confirmez la priorité de départ.");
    if (answers.priorities.scope === "targeted") {
      requireField("answers.priorities.timeConsumers", Boolean(answers.priorities.timeConsumers.length || answers.priorities.otherText), "Choisissez ou décrivez une priorité ciblée.");
    }
  } else if (section === "interaction") {
    // Optional preference: passing through never confirms it on the owner's behalf.
  } else if (section === "reservations") {
    requireField("answers.systems.pointOfSale.name", answers.systems?.pointOfSale.status !== "declared" || Boolean(answers.systems.pointOfSale.name?.trim()), "Précisez le nom de votre logiciel de caisse ou choisissez À préciser.");
    requireField("answers.reservations.methods", Boolean(answers.reservations.methods.length || answers.reservations.providers.length), "Déclarez la méthode de réservation actuelle.");
    if (answers.reservations.providers.includes("other")) {
      requireField("answers.reservations.otherProvider", Boolean(answers.reservations.otherProvider), "Précisez l'autre outil déclaré.");
    }
    if (answers.reservations.methods.includes("other")) {
      requireField("answers.reservations.otherMethod", Boolean(answers.reservations.otherMethod), "Précisez l'autre méthode déclarée.");
    }
    if (answers.reservations.methods.includes("calendar")) {
      requireField("answers.reservations.calendarProvider", Boolean(answers.reservations.calendarProvider), "Précisez le calendrier déclaré.");
    }
    const pendingProviders = inferredReservationProviders(answers.reservations.otherMethod || "")
      .filter((provider) => !answers.reservations.providers.includes(provider));
    requireField("answers.reservations.otherMethod", pendingProviders.length === 0, "Confirmez les outils détectés dans votre réponse.");
    if (reservationReferences(answers).length > 1) {
      requireField("answers.reservations.authoritativeSystem", answers.reservations.authoritativeSystem !== "unknown", "Choisissez la source de réservation de référence.");
    }
  } else if (section === "operations") {
    validateOperations(answers, requireField);
  } else if (section === "authority") {
    requireField("answers.authority.rulesAcknowledged", answers.authority.rulesAcknowledged, "Confirmez le cadre de validation avant toute action extérieure.");
  }
  if (Object.keys(errors).length) throw new OnboardingIncompleteError(errors);
}

function inferredReservationProviders(text: string): OnboardingAnswers["reservations"]["providers"] {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const providers: OnboardingAnswers["reservations"]["providers"] = [];
  if (/zenchef/.test(normalized)) providers.push("zenchef");
  if (/sevenrooms|seven rooms/.test(normalized)) providers.push("sevenrooms");
  if (/thefork|the fork|lafourchette/.test(normalized)) providers.push("thefork");
  return providers;
}

function validateOperations(answers: OnboardingAnswers, requireField: (path: string, condition: boolean, message: string) => void): void {
  const focus = answers.priorities.primaryFocus;
  if (focus === "supplier_orders") {
    requireField("answers.operations.suppliers.unknownFields", !answers.operations.suppliers.unknownFields.includes("proposal_pending"), "Confirmez les informations extraites.");
    const deliveryDate = answers.operations.suppliers.deliveryDate;
    if (deliveryDate && !["unknown", "not_applicable"].includes(deliveryDate)) {
      requireField("answers.operations.suppliers.deliveryTimeZone", Boolean(answers.operations.suppliers.deliveryTimeZone), "Confirmez le fuseau de la livraison.");
    }
  } else if (focus === "operations") {
    const nextServiceAt = answers.operations.service.nextServiceAt;
    if (nextServiceAt && !["unknown", "not_applicable"].includes(nextServiceAt)) {
      requireField("answers.operations.service.timezone", Boolean(answers.operations.service.timezone), "Confirmez le fuseau du prochain service.");
    }
  }
}

export function buildOnboardingFirstResult(storedAnswers: OnboardingAnswers): OnboardingFirstResultDraft {
  const answers = activeOnboardingAnswers(storedAnswers);
  const focus = answers.priorities.primaryFocus || "global";
  const locale = answers.interaction.locale;
  const t = (fr: string, en: string) => locale === "en" ? en : fr;
  const baseFacts = [
    `${t("Établissement confirmé", "Confirmed restaurant")}: ${answers.establishment.restaurantName}`,
    `${t("Priorité de départ", "Starting priority")}: ${focusLabel(focus, locale)}`,
    `${t("Réservations", "Reservations")}: ${reservationSummary(answers, locale)}`,
  ];
  const sourceFieldPaths = ["answers.establishment", "answers.priorities", "answers.reservations"];

  if (focus === "supplier_orders") {
    const item = answers.operations.suppliers.items[0];
    const hasQuantity = Boolean(item?.name && item.quantity && item.unit);
    return firstResult("supplier_order", hasQuantity ? "ready_for_review" : "needs_information", hasQuantity ? t("Votre commande est préparée", "Your order is prepared") : t("Votre commande à compléter", "Your order needs completion"), [
      ...baseFacts,
      item?.name ? `${t("Produit", "Product")}: ${item.name}` : t("Produit à compléter", "Product to complete"),
    ], [
      hasQuantity ? t(`Préparer un brouillon de commande pour ${item!.quantity} ${item!.unit} de ${item!.name}.`, `Prepare an order draft for ${item!.quantity} ${item!.unit} of ${item!.name}.`) : t("Compléter le produit, la quantité et l'unité avant de chiffrer le brouillon.", "Complete the product, quantity and unit before quantifying the draft."),
      t("Aucun envoi fournisseur n'est autorisé pendant la configuration.", "No supplier submission is authorized during setup."),
    ], missing([
      [t("fournisseur", "supplier"), knownString(answers.operations.suppliers.supplierName)],
      [t("date de livraison", "delivery date"), knownString(answers.operations.suppliers.deliveryDate)],
      [t("quantité", "quantity"), hasQuantity ? "known" : null],
    ]), sourceFieldPaths.concat("answers.operations.suppliers"), compactObject({
      type: "supplier_order_draft",
      state: "draft",
      editable: true,
      item: item || null,
      supplierName: knownString(answers.operations.suppliers.supplierName),
      deliveryDate: knownString(answers.operations.suppliers.deliveryDate),
      deliveryTimeZone: answers.operations.suppliers.deliveryTimeZone,
    }));
  }
  if (focus === "customer_communication") {
    const communications = answers.operations.communications;
    const ready = communications.channels.length > 0 && communications.peakContext.length > 0;
    return firstResult("customer_communication", ready ? "ready_for_review" : "needs_information", t("Votre renfort client est défini", "Your customer response protocol is defined"), baseFacts.concat([
      `${t("Canaux retenus", "Selected channels")}: ${labels(communications.channels, locale) || t("à préciser", "to define")}`,
      `${t("Moment de renfort", "Support moment")}: ${labels(communications.peakContext, locale) || t("à préciser", "to define")}`,
    ]), [
      t("Vérifier le protocole de tri des demandes avant toute action extérieure.", "Review the request triage protocol before any external action."),
      t("Conserver le numéro actuel ; aucun renvoi n'est activé.", "Keep the current phone number; no forwarding is enabled."),
    ], missing([
      [t("canaux", "channels"), communications.channels.length ? "known" : null],
      [t("moment de renfort", "support moment"), communications.peakContext.length ? "known" : null],
    ]), sourceFieldPaths.concat("answers.operations.communications"), {
      type: "communication_protocol",
      externalAction: false,
      channels: communications.channels,
      peakContext: communications.peakContext,
      humanReviewCategories: communications.humanReviewCategories,
    });
  }
  if (focus === "reservations") {
    const reservationRules = answers.operations.reservations;
    const unknownFields = [
      ...(reservationRules.friction.includes("groups") && !reservationRules.groupApprovalThreshold ? [t("seuil de groupe", "group threshold")] : []),
      ...(reservationRules.friction.includes("no_shows") && !reservationRules.confirmationRuleStatus ? [t("règle de confirmation", "confirmation rule")] : []),
    ];
    return firstResult("reservations", reservationRules.friction.length ? "ready_for_review" : "needs_information", t("Vos règles de réservation sont préparées", "Your reservation rules are prepared"), baseFacts.concat([
      `${t("Ralentissement", "Main friction")}: ${labels(reservationRules.friction, locale) || t("à préciser", "to define")}`,
    ]), [
      t("Vérifier les règles déclarées avant de les utiliser au service.", "Review the declared rules before using them during service."),
      t("Le système déclaré reste non connecté.", "The declared system remains unconnected."),
    ], unknownFields, sourceFieldPaths.concat("answers.operations.reservations"), {
      type: "reservation_rules",
      connectionStatus: "declared",
      authoritativeSystem: answers.reservations.authoritativeSystem,
      friction: reservationRules.friction,
      groupApprovalThreshold: reservationRules.groupApprovalThreshold || "unknown",
      confirmationRuleStatus: reservationRules.confirmationRuleStatus || "to_define",
    });
  }
  if (focus === "team") {
    const team = answers.operations.team;
    const ready = team.friction.length > 0 && team.stations.length > 0;
    return firstResult("team", ready ? "ready_for_review" : "needs_information", t("Votre premier briefing est préparé", "Your first briefing is prepared"), baseFacts.concat([
      `${t("Difficulté", "Difficulty")}: ${labels(team.friction, locale) || t("à préciser", "to define")}`,
      `${t("Postes concernés", "Stations concerned")}: ${labels(team.stations, locale) || t("à préciser", "to define")}`,
    ]), [
      t("Relire le briefing et choisir qui le partagera avant le service.", "Review the briefing and choose who will share it before service."),
      t("Complétez les personnes concernées et les horaires avec votre équipe.", "Add the people involved and their working hours with your team."),
    ], missing([
      [t("difficulté d'organisation", "organization difficulty"), team.friction.length ? "known" : null],
      [t("postes", "stations"), team.stations.length ? "known" : null],
    ]), sourceFieldPaths.concat("answers.operations.team"), { type: "team_briefing", state: "draft", editable: true, friction: team.friction, stations: team.stations });
  }
  if (focus === "operations") {
    const service = answers.operations.service;
    const ready = Boolean(service.phase && service.checks.length);
    return firstResult("service", ready ? "ready_for_review" : "needs_information", t("Votre préparation de service est prête", "Your service preparation is ready"), baseFacts.concat([
      `${t("Moment ciblé", "Target moment")}: ${service.phase ? labels([service.phase], locale) : t("à préciser", "to define")}`,
      `${t("Premier contrôle", "First check")}: ${labels(service.checks, locale) || t("à préciser", "to define")}`,
    ]), [
      t("Vérifier la mise en place prioritaire.", "Review the priority mise en place."),
      t("Désigner la personne responsable des validations.", "Assign the person responsible for approvals."),
      t("Revoir les demandes particulières avant le service.", "Review special requests before service."),
    ], missing([
      [t("moment du service", "service moment"), service.phase || null],
      [t("contrôles", "checks"), service.checks.length ? "known" : null],
      [t("responsable", "approver"), knownAssignee(answers)],
    ]), sourceFieldPaths.concat("answers.operations.service"), compactObject({ type: "service_preparation", state: "draft", checks: service.checks, nextServiceAt: knownString(service.nextServiceAt), timezone: service.timezone }));
  }
  if (focus === "profitability") {
    return firstResult("profitability", "needs_information", t("Votre plan d'analyse est préparé", "Your analysis plan is prepared"), baseFacts.concat([
      `${t("Poste ciblé", "Target area")}: ${answers.operations.business.focus ? labels([answers.operations.business.focus], locale) : t("à préciser", "to define")}`,
    ]), [
      t("Lister les données nécessaires au poste choisi avant toute analyse chiffrée.", "List the data required for the selected area before any quantified analysis."),
      t("Aucun gain ni revenu n'est estimé sans source mesurée.", "No savings or revenue is estimated without a measured source."),
    ], answers.operations.business.knownDataSources.length ? [t("période de mesure", "measurement period")] : [t("sources de coûts", "cost sources"), t("période de mesure", "measurement period")], sourceFieldPaths.concat("answers.operations.business"), { type: "measurement_plan", state: "draft", focus: answers.operations.business.focus || "unknown", knownDataSources: answers.operations.business.knownDataSources });
  }
  if (focus === "occupancy") {
    const targets = answers.operations.business.targetServices;
    return firstResult("occupancy", targets.length ? "ready_for_review" : "needs_information", targets.length ? t("Vos services prioritaires sont identifiés", "Your priority services are identified") : t("Votre plan de remplissage à préciser", "Your occupancy plan needs detail"), baseFacts, [
      t("Travailler uniquement sur les services déclarés ou à identifier.", "Work only with declared services or services still to identify."),
      t("Aucun taux de remplissage n'est fabriqué.", "No occupancy rate is fabricated."),
    ], missing([[t("services ciblés", "target services"), targets.length ? "known" : null]]), sourceFieldPaths.concat("answers.operations.business"), { type: "occupancy_plan", state: "draft", targetServices: targets });
  }
  if (focus === "customer_loyalty") {
    return firstResult("customer_loyalty", "ready_for_review", t("Votre suivi client est préparé", "Your customer follow-up is prepared"), baseFacts.concat([
      `${t("Besoin", "Need")}: ${answers.operations.business.focus ? labels([answers.operations.business.focus], locale) : t("à préciser", "to define")}`,
    ]), [
      t("Vérifier le protocole de suivi avant tout contact client.", "Review the follow-up protocol before contacting any customer."),
      t("Aucun contact ni consentement n'est ajouté depuis une supposition.", "No contact or consent is added from an assumption."),
    ], [t("contacts autorisés", "authorized contacts"), t("base de consentement", "consent basis")], sourceFieldPaths.concat("answers.operations.business"), { type: "loyalty_protocol", state: "draft", externalAction: false, focus: answers.operations.business.focus || "unknown" });
  }
  return firstResult("global", "ready_for_review", t("Votre préparation de service est prête", "Your service preparation is ready"), baseFacts.concat([
    `${t("Moment ciblé", "Target moment")}: ${labels([answers.operations.global.startingMoment || "overview"], locale)}`,
  ]), [
    t("Vérifier la mise en place prioritaire.", "Review the priority mise en place."),
    t("Désigner la personne responsable des validations.", "Assign the person responsible for approvals."),
    t("Revoir les demandes particulières avant le service.", "Review special requests before service."),
  ], missing([[t("responsable", "approver"), knownAssignee(answers)]]), sourceFieldPaths.concat("answers.operations.global"), {
    type: "service_preparation",
    state: "draft",
    checks: ["mise_en_place", "approval_owner", "special_requests"],
    summary: answers.operations.global.confirmedSummary || null,
  });
}

export function declaredOperatingSetup(answers: OnboardingAnswers): OnboardingInput["operatingSetup"] {
  const providers = answers.reservations.providers.flatMap((provider) => provider === "other" ? ["other" as const] : [provider]);
  const calendarProviders = answers.reservations.calendarProvider === "google_calendar" ? ["google_calendar" as const]
    : answers.reservations.calendarProvider === "outlook" ? ["outlook_calendar" as const] : [];
  const reservationMode = answers.reservations.methods.includes("paper") && providers.length ? "hybrid"
    : answers.reservations.methods.includes("calendar") ? "calendar"
    : answers.reservations.methods.includes("paper") ? "paper"
    : providers.length ? "software" : "tablenow";
  return {
    reservationMode,
    providers: [...providers, ...calendarProviders],
    ...(answers.reservations.otherProvider ? { otherProvider: answers.reservations.otherProvider } : {}),
    keepPaperWorkflow: answers.reservations.methods.includes("paper"),
  };
}

export function displayRole(answers: OnboardingAnswers): string {
  const labelsByRole: Record<OnboardingLocale, Record<string, string>> = {
    fr: {
      owner: "Propriétaire",
      general_management: "Direction générale",
      station_manager: "Responsable de poste",
      team: "Équipe",
      other: "Autre",
    },
    en: {
      owner: "Owner",
      general_management: "General management",
      station_manager: "Station manager",
      team: "Team",
      other: "Other",
    },
  };
  return labelsByRole[answers.interaction.locale][answers.authority.declaredJobTitle || "owner"]
    || (answers.interaction.locale === "en" ? "Management" : "Direction");
}

const resultLabels: Record<OnboardingLocale, Record<string, string>> = {
  fr: {
    owner: "Propriétaire",
    team: "équipe", reservations: "réservations", supplier_orders: "commandes fournisseurs",
    customer_communication: "communication client", operations: "gestion opérationnelle",
    profitability: "rentabilité", occupancy: "remplissage", customer_loyalty: "fidélisation",
    global: "accompagnement global", other: "autre situation", paper: "cahier", calendar: "calendrier",
    messages: "messages", none: "aucune saisie", calls: "appels", whatsapp: "WhatsApp", emails: "e-mails",
    instagram: "Instagram", sms: "SMS", during_service: "pendant le service",
    when_team_unavailable: "quand l'équipe ne répond pas", outside_hours: "hors horaires",
    taking_reservations: "prise des réservations", changes_cancellations: "modifications et annulations",
    groups: "groupes", special_requests: "demandes particulières", no_shows: "absences clients",
    planning: "plannings", absences: "absences", tasks: "répartition des tâches",
    floor_kitchen_coordination: "coordination salle et cuisine", floor: "salle", kitchen: "cuisine",
    bar: "bar", host_reservations: "accueil et réservations", before_service: "avant le service",
    after_service: "après le service", mise_en_place: "mise en place", coordination: "coordination",
    closing: "fermeture", overview: "vue d'ensemble", purchases: "achats", waste: "gaspillage",
    regulars: "habitués", requests_followup: "suivi des demandes", next_contacts: "prochains contacts",
    unknown: "à préciser",
  },
  en: {
    team: "team", reservations: "reservations", supplier_orders: "supplier orders",
    customer_communication: "customer communication", operations: "operations", profitability: "profitability",
    occupancy: "occupancy", customer_loyalty: "customer loyalty", global: "overall support", other: "other situation",
    paper: "notebook", calendar: "calendar", messages: "messages", none: "no current record", calls: "calls",
    whatsapp: "WhatsApp", emails: "emails", instagram: "Instagram", sms: "SMS", during_service: "during service",
    when_team_unavailable: "when the team cannot answer", outside_hours: "outside opening hours",
    taking_reservations: "taking reservations", changes_cancellations: "changes and cancellations", groups: "groups",
    special_requests: "special requests", no_shows: "no-shows", planning: "schedules", absences: "absences",
    tasks: "task assignment", floor_kitchen_coordination: "floor and kitchen coordination", floor: "floor",
    kitchen: "kitchen", bar: "bar", host_reservations: "host and reservations", before_service: "before service",
    after_service: "after service", mise_en_place: "mise en place", coordination: "coordination", closing: "closing",
    overview: "overview", purchases: "purchasing", waste: "waste", regulars: "regulars",
    requests_followup: "request follow-up", next_contacts: "next contacts", unknown: "to define",
  },
};

export function reservationReferences(answers: OnboardingAnswers): string[] {
  return Array.from(new Set([
    ...answers.reservations.providers.map((provider) => provider === "other" ? answers.reservations.otherProvider : provider),
    ...answers.reservations.methods.flatMap((method) => {
      if (method === "software") return [];
      if (method === "calendar") return answers.reservations.calendarProvider ? [answers.reservations.calendarProvider] : ["calendar"];
      if (method === "other") return answers.reservations.otherMethod ? [answers.reservations.otherMethod] : ["other"];
      return [method];
    }),
  ].filter((value): value is string => Boolean(value))));
}

function firstResult(
  kind: OnboardingFirstResultDraft["kind"],
  status: OnboardingFirstResultDraft["status"],
  title: string,
  confirmedFacts: string[],
  recommendations: string[],
  unknownFields: string[],
  sourceFieldPaths: string[],
  businessArtifact: Record<string, unknown>,
): OnboardingFirstResultDraft {
  return { kind, status, title, confirmedFacts, recommendations, unknownFields, sourceFieldPaths, businessArtifact };
}

function knownString(value: string | undefined): string | null {
  if (!value || value === "unknown" || value === "not_applicable") return null;
  return value;
}

function knownAssignee(answers: OnboardingAnswers): string | null {
  const assignee = answers.authority.approvalAssigneeUserId;
  return assignee && assignee !== "unknown" ? assignee : null;
}

function missing(fields: Array<[string, string | null]>): string[] {
  return fields.filter(([, value]) => !value).map(([field]) => field);
}

function labels(values: string[], locale: OnboardingLocale): string {
  return values.map((value) => resultLabels[locale][value] || value.replaceAll("_", " ")).join(", ");
}

function focusLabel(focus: string, locale: OnboardingLocale): string {
  return resultLabels[locale][focus] || focus;
}

function reservationSummary(answers: OnboardingAnswers, locale: OnboardingLocale): string {
  const declared = locale === "en" ? "declared, not connected" : "déclaré, non connecté";
  if (answers.reservations.providers.length) return `${labels(answers.reservations.providers, locale)} (${declared})`;
  if (answers.reservations.methods.includes("none")) return locale === "en" ? "no tool declared" : "aucun outil déclaré";
  return `${labels(answers.reservations.methods, locale) || (locale === "en" ? "to define" : "à préciser")} (${declared})`;
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
