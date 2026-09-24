import type { OnboardingPresentationStep } from "@tablenow/contracts";
import type { LocaleMode, SectionKey } from "./onboarding";

export interface OnboardingCopy {
  direction: "ltr";
  sections: Record<SectionKey, string>;
  steps: Record<OnboardingPresentationStep, string>;
  common: Record<CommonKey, string>;
  labels: Record<string, string>;
}

type CommonKey =
  | "brand" | "language" | "clearTheme" | "darkTheme" | "loading" | "loadFailed" | "retry"
  | "dirty" | "saving" | "saved" | "saveFailed" | "conflict" | "compare" | "back" | "continue"
  | "done" | "finish" | "preparing" | "saveForReview" | "composerPlaceholder" | "send" | "dictate" | "stop"
  | "listen" | "stopReading" | "useVoice" | "cancel" | "voiceIdle" | "voicePermission" | "voiceRecording"
  | "voiceTranscribing" | "voiceReview" | "voiceConfirmed" | "voiceCancelled" | "voiceDenied" | "voiceUnavailable"
  | "voiceFailed" | "establishmentEyebrow" | "welcome" | "establishmentSubtitle" | "promise" | "restaurantQuery"
  | "restaurantPlaceholder" | "addManually" | "searchRestaurant" | "searchUnavailable" | "restaurantName"
  | "cityCountry" | "cityPlaceholder" | "address" | "addressPlaceholder" | "phone" | "optional" | "timezone"
  | "timezonePlaceholder" | "found" | "manualToConfirm" | "confirmInformation" | "correct" | "siteCount"
  | "priorityEyebrow" | "priorityTitle" | "priorityQuestion" | "priorityPromise" | "otherSituation" | "desiredOutcomes"
    | "startWith" | "priorityInterpretation" | "confirm" | "interactionEyebrow" | "interactionTitle" | "interactionHelp" | "interactionInterpretation"
  | "spokenReplies" | "spokenRepliesHelp" | "reservationsEyebrow" | "reservationsTitle" | "otherTool"
  | "whereReservations" | "calendar" | "otherMethod" | "referenceSystem" | "referenceHelp" | "declared"
  | "notConnectedHelp" | "operationEyebrow" | "operationTitle" | "operationSubtitle" | "keepNumber"
  | "noForwarding" | "phoneOptional" | "overflowTriggers" | "humanReview" | "groupThreshold" | "defineLater"
  | "confirmationRule" | "confirmationRuleDetails" | "teamHeadcount" | "supplierProduct" | "quantity" | "unit"
  | "supplier" | "deliveryDate" | "deliveryTimezone" | "absoluteDateHelp" | "confirmExtraction" | "noExternalOrder"
  | "stockQuantity" | "reorderThreshold" | "nextService" | "serviceTimezone" | "scheduleStatus" | "targetServices"
  | "targetServicesPlaceholder" | "knownSources" | "globalSummary" | "authorityEyebrow" | "authorityTitle"
  | "authoritySubtitle" | "serverRole" | "roleHelp" | "authorityBlocked" | "jobTitle" | "validationRecipient"
  | "me" | "toAssign" | "rulesAcknowledged" | "rulesHelp" | "finalNoteEyebrow" | "finalNoteTitle"
  | "finalNoteSubtitle" | "note" | "notePlaceholder" | "understood" | "remove" | "whichCorrect"
  | "reviewEyebrow" | "reviewTitle" | "reviewSubtitle" | "edit" | "preparedFromAnswers" | "unknownRemain"
  | "acceptTermsPrefix" | "terms" | "acceptTermsSuffix" | "acceptDpaPrefix" | "dpa" | "acceptDpaSuffix"
  | "completeFailed" | "validationEstablishment" | "validationReservations" | "validationPriority" | "validationGeneric"
    | "validationInterpretation" | "interpretationSummary" | "capturedText" | "station"
    | "branchReset" | "multiRestaurant" | "selectRestaurant" | "restaurantChangeWarning" | "conflictTitle"
    | "changedField" | "thisScreen" | "serverVersion" | "keepMine" | "useServer" | "noConflictDifferences" | "statusDraft"
  | "statusAwaiting" | "statusCompleted";

const labelsFr: Record<string, string> = {
  team: "L'équipe", reservations: "Les réservations", supplier_orders: "Les commandes fournisseurs",
  customer_communication: "La communication client", operations: "La gestion opérationnelle", other: "Autre",
  global: "Un accompagnement global", profitability: "Améliorer la rentabilité de mon établissement",
  occupancy: "Optimiser mon taux de remplissage", customer_requests: "Améliorer le traitement des demandes clients",
  team_coordination: "Mieux planifier et coordonner mes équipes", service_disruptions: "Anticiper et gérer les aléas du service",
  stock_control: "Maîtriser mes achats et mes stocks", customer_loyalty: "Mieux connaître et fidéliser ma clientèle",
  text: "Par écrit", voice: "À la voix", mixed: "Les deux", zenchef: "Zenchef", sevenrooms: "SevenRooms",
  thefork: "TheFork", opentable: "OpenTable", no_software: "Je n'en ai pas", paper: "Manuscrit", calendar: "Dans un calendrier",
  messages: "Dans des messages", none: "Je ne les note pas encore", software: "Logiciel", google_calendar: "Google Calendar",
  outlook: "Outlook", calls: "Appels", whatsapp: "WhatsApp", emails: "E-mails", instagram: "Instagram", messenger: "Messenger", sms: "SMS",
  during_service: "Pendant le service", when_team_unavailable: "Quand l'équipe ne répond pas", outside_hours: "Hors horaires",
  groups: "Groupes", allergies_sensitive: "Allergies et demandes sensibles", privatizations: "Privatisations",
  complaints: "Réclamations", taking_reservations: "Prendre les réservations", changes_cancellations: "Modifications et annulations",
  special_requests: "Demandes particulières", no_shows: "Absences clients", yes: "Oui", no: "Non", to_define: "À préciser",
  planning: "Préparer les plannings", absences: "Gérer les absences", tasks: "Répartir les tâches",
  floor_kitchen_coordination: "Coordonner salle et cuisine", floor: "Salle", kitchen: "Cuisine", bar: "Bar",
  host_reservations: "Accueil / réservations", prepare_order: "Préparer une commande", monitor_stock: "Surveiller un stock",
  prepare_delivery: "Préparer une réception", before_service: "Avant le service", after_service: "Après le service",
  mise_en_place: "Mise en place", coordination: "Coordination", closing: "Fermeture", overview: "Vue d'ensemble",
  purchases: "Achats", waste: "Gaspillage", unknown: "Je ne sais pas encore", regulars: "Reconnaître les habitués",
  requests_followup: "Mieux suivre les demandes", next_contacts: "Préparer les prochains contacts", known: "Horaire connu",
  no_fixed_schedule: "Nous n'avons pas d'horaire fixe", owner: "Propriétaire", general_management: "Direction générale",
  station_manager: "Responsable de poste", fact: "Fait", preference: "Préférence", proposed_rule: "Règle proposée",
  platform_admin: "Administrateur plateforme", group_admin: "Administrateur du groupe", manager: "Responsable",
  operator: "Opérateur", viewer: "Observateur", busy_line: "Ligne occupée", no_answer: "Absence de réponse",
};

const labelsEn: Record<string, string> = {
  team: "The team", reservations: "Reservations", supplier_orders: "Supplier orders", customer_communication: "Customer communication",
  operations: "Operations", other: "Other", global: "Overall support", profitability: "Improve the restaurant's profitability",
  occupancy: "Improve occupancy", customer_requests: "Handle customer requests better", team_coordination: "Plan and coordinate the team",
  service_disruptions: "Anticipate service disruptions", stock_control: "Control purchasing and stock", customer_loyalty: "Know and retain customers",
  text: "In writing", voice: "By voice", mixed: "Both", zenchef: "Zenchef", sevenrooms: "SevenRooms", thefork: "TheFork", opentable: "OpenTable",
  no_software: "I do not use one", paper: "In a notebook", calendar: "In a calendar", messages: "In messages",
  none: "We do not record them yet", software: "Software", google_calendar: "Google Calendar", outlook: "Outlook",
  calls: "Calls", whatsapp: "WhatsApp", emails: "Emails", instagram: "Instagram", messenger: "Messenger", sms: "SMS", during_service: "During service",
  when_team_unavailable: "When the team cannot answer", outside_hours: "Outside opening hours", groups: "Groups",
  allergies_sensitive: "Allergies and sensitive requests", privatizations: "Private events", complaints: "Complaints",
  taking_reservations: "Taking reservations", changes_cancellations: "Changes and cancellations", special_requests: "Special requests",
  no_shows: "No-shows", yes: "Yes", no: "No", to_define: "To define", planning: "Prepare schedules", absences: "Manage absences",
  tasks: "Assign tasks", floor_kitchen_coordination: "Coordinate floor and kitchen", floor: "Floor", kitchen: "Kitchen", bar: "Bar",
  host_reservations: "Host / reservations", prepare_order: "Prepare an order", monitor_stock: "Monitor stock",
  prepare_delivery: "Prepare a delivery", before_service: "Before service", after_service: "After service", mise_en_place: "Mise en place",
  coordination: "Coordination", closing: "Closing", overview: "Overview", purchases: "Purchasing", waste: "Waste",
  unknown: "I do not know yet", regulars: "Recognize regulars", requests_followup: "Follow requests better",
  next_contacts: "Prepare the next contacts", known: "Known schedule", no_fixed_schedule: "We do not have a fixed schedule",
  owner: "Owner", general_management: "General management", station_manager: "Station manager", fact: "Fact",
  preference: "Preference", proposed_rule: "Proposed rule", platform_admin: "Platform administrator",
  group_admin: "Group administrator", manager: "Manager", operator: "Operator", viewer: "Viewer",
  busy_line: "Busy line", no_answer: "No answer",
};

export const onboardingCopy: Record<LocaleMode, OnboardingCopy> = {
  fr: {
    direction: "ltr",
    steps: { priorities: "Priorités", establishment: "Établissement", systems: "Systèmes", connections: "Connexions", complements: "Compléments", review: "Synthèse" },
    sections: { establishment: "Établissement", priorities: "Priorités", interaction: "Priorités", reservations: "Réservations", operations: "Fonctionnement", authority: "Validation", final_note: "Validation", review: "Votre plan" },
    labels: labelsFr,
    common: {
      brand: "Onboarding", language: "Langue", clearTheme: "Passer en clair", darkTheme: "Passer en sombre", loading: "Préparation de votre brouillon d'onboarding",
      loadFailed: "Impossible de charger votre brouillon.", retry: "Réessayer", dirty: "Modifications non enregistrées", saving: "Enregistrement…", saved: "Votre progression a été enregistrée.",
      saveFailed: "Enregistrement impossible. Vos réponses restent dans cet écran.", conflict: "Ces réponses ont été modifiées dans une autre session.", compare: "Comparer les réponses",
      back: "Retour", continue: "Continuer", done: "J’ai terminé", finish: "Voir mon premier résultat", preparing: "Préparation de votre plan…", saveForReview: "Enregistrer pour validation",
      composerPlaceholder: "Écrivez ou parlez…", send: "Envoyer", dictate: "Dicter", stop: "Arrêter", listen: "Écouter la question", stopReading: "Arrêter la lecture",
      useVoice: "Utiliser cette réponse", cancel: "Annuler", voiceIdle: "Dicter", voicePermission: "Autorisez le micro pour dicter", voiceRecording: "Je vous écoute…", voiceTranscribing: "Transcription…",
      voiceReview: "Vérifiez votre réponse", voiceConfirmed: "Réponse utilisée", voiceCancelled: "Dictée annulée", voiceDenied: "Le micro n'est pas autorisé dans ce navigateur.",
      voiceUnavailable: "La dictée n'est pas disponible sur cet environnement.", voiceFailed: "La transcription n'a pas abouti.", establishmentEyebrow: "Établissement", welcome: "Bonjour et bienvenue, comment puis-je vous aider ?",
      establishmentSubtitle: "Commençons par votre établissement.", promise: "TableNow apprend comment fonctionne votre restaurant.", restaurantQuery: "Nom du restaurant, ville ou adresse",
      restaurantPlaceholder: "Maison Rivage, Paris", addManually: "Ajouter mon établissement manuellement", searchRestaurant: "Rechercher mon établissement",
      searchUnavailable: "La recherche publique n'est pas disponible dans cet environnement. Vous pouvez renseigner l'établissement manuellement.", restaurantName: "Nom de l'établissement",
      cityCountry: "Ville et pays", cityPlaceholder: "Paris, France", address: "Adresse détaillée", addressPlaceholder: "Facultatif ou inconnu", phone: "Téléphone", optional: "Facultatif",
      timezone: "Fuseau horaire confirmé", timezonePlaceholder: "Exemple : Europe/Paris", found: "Voici ce que j'ai trouvé.", manualToConfirm: "Saisie manuelle, à confirmer par vous.",
      confirmInformation: "Confirmer ces informations", correct: "Corriger", siteCount: "Nombre d'établissements", priorityEyebrow: "Priorités", priorityTitle: "Comment puis-je vous aider ?",
      priorityQuestion: "Qu'est-ce qui vous prend le plus de temps aujourd'hui ?", priorityPromise: "Choisissez ce qui compte maintenant. Toutes les capacités de TableNow restent accessibles.",
      otherSituation: "Décrivez votre situation", desiredOutcomes: "Préciser les résultats souhaités", startWith: "Par quoi commençons-nous ?", priorityInterpretation: "J'ai retenu ces priorités. Confirmez-les avant de continuer.",
      confirm: "Confirmer", interactionEyebrow: "Interaction", interactionTitle: "Comment préférez-vous utiliser TableNow ?", interactionHelp: "Vous pourrez toujours écrire, parler ou sélectionner une réponse.",
      interactionInterpretation: "Préférence proposée, à confirmer.",
      spokenReplies: "Écouter les questions à la demande", spokenRepliesHelp: "Aucune lecture ne démarre sans geste explicite.", reservationsEyebrow: "Réservations", reservationsTitle: "Solution de réservation",
      otherTool: "Quel outil utilisez-vous ?", whereReservations: "Où notez-vous les réservations ?", calendar: "Calendrier", otherMethod: "Quelle autre méthode utilisez-vous ?",
      referenceSystem: "Où l'équipe vérifie-t-elle la réservation définitive ?", referenceHelp: "Choisissez uniquement parmi les méthodes déclarées.", declared: "Déclaré — non connecté",
      notConnectedHelp: "Aucun accès à votre outil n'est activé ici.", operationEyebrow: "Fonctionnement", operationTitle: "Préparons votre première aide.", operationSubtitle: "Quelques précisions pour produire quelque chose d'utile dès maintenant.",
      keepNumber: "Vous conservez votre numéro actuel.", noForwarding: "Aucun renvoi n'est activé.", phoneOptional: "Numéro facultatif", overflowTriggers: "Quand proposer un renfort ?",
      humanReview: "Quelles demandes doivent toujours vous être transmises ?", groupThreshold: "À partir de combien de personnes souhaitez-vous valider vous-même ?", defineLater: "À définir",
      confirmationRule: "Avez-vous une règle de confirmation ?", confirmationRuleDetails: "Décrivez la règle confirmée", teamHeadcount: "Effectif concerné", supplierProduct: "Produit",
      quantity: "Quantité", unit: "Unité", supplier: "Fournisseur", deliveryDate: "Livraison souhaitée", deliveryTimezone: "Fuseau de livraison", absoluteDateHelp: "Utilisez une date absolue ; un jour relatif reste à clarifier.",
      confirmExtraction: "Confirmer les informations extraites", noExternalOrder: "Aucune commande, invitation ni communication externe n'est créée par l'onboarding.", stockQuantity: "Quantité actuelle", reorderThreshold: "Seuil",
      nextService: "Prochain service (ISO avec décalage)", serviceTimezone: "Fuseau du service", scheduleStatus: "Horaire", targetServices: "Quels services souhaitez-vous mieux remplir ?",
      targetServicesPlaceholder: "Jeudi soir, dimanche midi, à identifier", knownSources: "Sources de données réellement disponibles", globalSummary: "Résumé confirmé", authorityEyebrow: "Validation",
      authorityTitle: "Qui valide les décisions ?", authoritySubtitle: "TableNow prépare. La personne autorisée garde la décision.", serverRole: "Rôle accordé à la session", roleHelp: "Ce rôle vient du serveur. Le champ ci-dessous ne change aucun droit.",
      authorityBlocked: "Ces réglages doivent être confirmés par une personne autorisée.", jobTitle: "Votre fonction dans l'établissement", validationRecipient: "Qui doit recevoir les demandes de validation pour cette mission ?",
      me: "Moi", toAssign: "À désigner", rulesAcknowledged: "Préparer un brouillon, faire valider avant envoi", rulesHelp: "Ne pas exécuter d'action extérieure pendant la configuration.", finalNoteEyebrow: "Dernière précision",
      finalNoteTitle: "Avons-nous oublié quelque chose ?", finalNoteSubtitle: "Vos habitudes, vos exceptions ou une consigne importante.", note: "Note", notePlaceholder: "Exemple : le chef valide toujours les groupes et les allergies.",
      understood: "Voici ce que j'ai compris.", remove: "Retirer", whichCorrect: "Quelle information est correcte ?", reviewEyebrow: "Votre plan", reviewTitle: "Voici votre point de départ.",
      reviewSubtitle: "Vérifiez chaque fait avant de créer le premier résultat.", edit: "Modifier", preparedFromAnswers: "Préparé à partir de vos réponses.", unknownRemain: "Les informations inconnues restent marquées à compléter.",
      acceptTermsPrefix: "J'accepte les", terms: "conditions d'utilisation", acceptTermsSuffix: ".", acceptDpaPrefix: "Je confirme être autorisé à configurer cet établissement et j'accepte l'", dpa: "accord de traitement des données", acceptDpaSuffix: ".",
      completeFailed: "Votre plan n'a pas pu être enregistré. Vos réponses sont conservées.", validationEstablishment: "Confirmez le nom de l'établissement et sa ville pour continuer.", validationReservations: "Indiquez votre solution ou votre méthode de réservation.",
      validationPriority: "Confirmez une priorité de départ.", validationGeneric: "Complétez les informations nécessaires pour continuer.", validationInterpretation: "Confirmez ou corrigez les informations interprétées avant de continuer.",
      interpretationSummary: "Voici ce que j'ai compris. Confirmez ou corrigez.", capturedText: "Précision saisie", station: "Poste ou zone concernée", branchReset: "Votre priorité a changé. Vos réponses précédentes sont conservées.",
      multiRestaurant: "Je gère plusieurs établissements", selectRestaurant: "Établissement à configurer", restaurantChangeWarning: "Le brouillon de l'établissement choisi est chargé séparément.", conflictTitle: "Comparer les réponses",
      changedField: "Champ modifié", thisScreen: "Cet écran", serverVersion: "Version enregistrée", keepMine: "Conserver mes réponses", useServer: "Utiliser la version enregistrée", noConflictDifferences: "Aucune différence visible.", statusDraft: "Brouillon", statusAwaiting: "En attente de validation", statusCompleted: "Terminé",
    },
  },
  en: {
    direction: "ltr",
    steps: { priorities: "Priorities", establishment: "Restaurant", systems: "Systems", connections: "Connections", complements: "Additional details", review: "Summary" },
    sections: { establishment: "Restaurant", priorities: "Priorities", interaction: "Priorities", reservations: "Reservations", operations: "Operations", authority: "Approval", final_note: "Approval", review: "Your plan" },
    labels: labelsEn,
    common: {
      brand: "Onboarding", language: "Language", clearTheme: "Use light mode", darkTheme: "Use dark mode", loading: "Preparing your onboarding draft", loadFailed: "Your draft could not be loaded.", retry: "Try again",
      dirty: "Unsaved changes", saving: "Saving…", saved: "Saved", saveFailed: "Saving failed. Your answers remain on this screen.", conflict: "These answers were changed in another session.", compare: "Compare answers",
      back: "Back", continue: "Continue", done: "I’m done", finish: "See my first result", preparing: "Preparing your plan…", saveForReview: "Save for approval", composerPlaceholder: "Write or tell us how your restaurant works…", send: "Send", dictate: "Dictate",
      stop: "Stop", listen: "Listen to the question", stopReading: "Stop reading", useVoice: "Use this answer", cancel: "Cancel", voiceIdle: "Dictate", voicePermission: "Allow microphone access to dictate",
      voiceRecording: "I am listening…", voiceTranscribing: "Transcribing…", voiceReview: "Review your answer", voiceConfirmed: "Answer used", voiceCancelled: "Dictation cancelled", voiceDenied: "The microphone is not allowed in this browser.",
      voiceUnavailable: "Dictation is not available in this environment.", voiceFailed: "Transcription failed.", establishmentEyebrow: "Restaurant", welcome: "Welcome.", establishmentSubtitle: "Let us start with your restaurant.",
      promise: "TableNow learns how your restaurant works.", restaurantQuery: "Restaurant name, city or address", restaurantPlaceholder: "Maison Rivage, Paris", addManually: "Add my restaurant manually", searchRestaurant: "Search for my restaurant",
      searchUnavailable: "Public search is not available in this environment. You can enter the restaurant manually.", restaurantName: "Restaurant name", cityCountry: "City and country", cityPlaceholder: "Paris, France", address: "Full address",
      addressPlaceholder: "Optional or unknown", phone: "Phone", optional: "Optional", timezone: "Confirmed time zone", timezonePlaceholder: "Example: Europe/Paris", found: "Here is what I found.", manualToConfirm: "Manual entry, waiting for your confirmation.",
      confirmInformation: "Confirm this information", correct: "Correct", siteCount: "Number of restaurants", priorityEyebrow: "Priorities", priorityTitle: "How can I help?", priorityQuestion: "What takes most of your time today?",
      priorityPromise: "Choose what matters now. All TableNow capabilities remain available.", otherSituation: "Describe your situation", desiredOutcomes: "Specify desired outcomes", startWith: "Where should we start?",
      priorityInterpretation: "I identified these priorities. Confirm them before continuing.", confirm: "Confirm", interactionEyebrow: "Interaction", interactionTitle: "How would you like to use TableNow?", interactionHelp: "You can always write, speak or select an answer.",
      interactionInterpretation: "Suggested preference, awaiting confirmation.",
      spokenReplies: "Listen to questions on demand", spokenRepliesHelp: "Reading never starts without an explicit action.", reservationsEyebrow: "Reservations", reservationsTitle: "Reservation solution", otherTool: "Which tool do you use?",
      whereReservations: "Where do you record reservations?", calendar: "Calendar", otherMethod: "Which other method do you use?", referenceSystem: "Where does the team verify the final reservation?", referenceHelp: "Choose only from the methods you declared.",
      declared: "Declared — not connected", notConnectedHelp: "No access to your tool is enabled here.", operationEyebrow: "Operations", operationTitle: "Let us prepare your first practical result.", operationSubtitle: "A few details will make it useful right away.",
      keepNumber: "You keep your current number.", noForwarding: "No forwarding is enabled.", phoneOptional: "Optional phone number", overflowTriggers: "When should assistance be proposed?", humanReview: "Which requests must always be passed to you?",
      groupThreshold: "From how many guests do you want to approve the booking yourself?", defineLater: "Define later", confirmationRule: "Do you have a confirmation rule?", confirmationRuleDetails: "Describe the confirmed rule", teamHeadcount: "Team size concerned",
      supplierProduct: "Product", quantity: "Quantity", unit: "Unit", supplier: "Supplier", deliveryDate: "Requested delivery", deliveryTimezone: "Delivery time zone", absoluteDateHelp: "Use an absolute date; a relative weekday remains to clarify.",
      confirmExtraction: "Confirm extracted information", noExternalOrder: "Onboarding creates no order, invitation or external communication.", stockQuantity: "Current quantity", reorderThreshold: "Threshold", nextService: "Next service (ISO with offset)",
      serviceTimezone: "Service time zone", scheduleStatus: "Schedule", targetServices: "Which services would you like to fill better?", targetServicesPlaceholder: "Thursday evening, Sunday lunch, to identify", knownSources: "Actually available data sources",
      globalSummary: "Confirmed summary", authorityEyebrow: "Approval", authorityTitle: "Who approves decisions?", authoritySubtitle: "TableNow prepares. The authorized person keeps control.", serverRole: "Role granted to this session", roleHelp: "This role comes from the server. The field below changes no permission.",
      authorityBlocked: "These settings must be confirmed by an authorized person.", jobTitle: "Your role in the restaurant", validationRecipient: "Who should receive approval requests for this mission?", me: "Me", toAssign: "To assign",
      rulesAcknowledged: "Prepare a draft and request approval before sending", rulesHelp: "Do not perform any external action during setup.", finalNoteEyebrow: "Final detail", finalNoteTitle: "Anything else we should know?", finalNoteSubtitle: "Your habits, exceptions or an important instruction.",
      note: "Note", notePlaceholder: "Example: the chef always approves groups and allergies.", understood: "Here is what I understood.", remove: "Remove", whichCorrect: "Which information is correct?", reviewEyebrow: "Your plan", reviewTitle: "Here is your starting point.",
      reviewSubtitle: "Review every fact before creating the first result.", edit: "Edit", preparedFromAnswers: "Prepared from your answers.", unknownRemain: "Unknown information remains marked for completion.", acceptTermsPrefix: "I accept the", terms: "terms of use",
      acceptTermsSuffix: ".", acceptDpaPrefix: "I confirm I am authorized to configure this restaurant and accept the", dpa: "data processing agreement", acceptDpaSuffix: ".", completeFailed: "Your plan could not be saved. Your answers are preserved.",
      validationEstablishment: "Confirm the restaurant name and city to continue.", validationReservations: "Provide your reservation tool or method.", validationPriority: "Confirm a starting priority.", validationGeneric: "Complete the required information to continue.",
      validationInterpretation: "Confirm or correct the interpreted information before continuing.", interpretationSummary: "Here is what I understood. Confirm or correct it.", capturedText: "Captured detail", station: "Station or area concerned",
      branchReset: "Your priority has changed. Your previous answers are preserved.", multiRestaurant: "I manage several restaurants", selectRestaurant: "Restaurant to configure", restaurantChangeWarning: "The selected restaurant has a separate draft.", conflictTitle: "Compare answers",
      changedField: "Changed field", thisScreen: "This screen", serverVersion: "Saved version", keepMine: "Keep my answers", useServer: "Use saved version", noConflictDifferences: "No visible difference.", statusDraft: "Draft", statusAwaiting: "Awaiting approval", statusCompleted: "Completed",
    },
  },
};

export function labelFor(locale: LocaleMode, value: string): string {
  return onboardingCopy[locale].labels[value] || value.replaceAll("_", " ");
}
