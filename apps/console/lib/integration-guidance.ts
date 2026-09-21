import type { OnboardingAnswers } from "@tablenow/contracts";

type Copy = { fr: string; en: string };
export interface IntegrationGuide {
  id: string;
  name: string;
  category: "reservations" | "calendar" | "pos" | "communications";
  status: "to_connect";
  blocker: Copy;
  next: Copy;
  source?: string;
  sourceLabel?: string;
}
const copy = (fr: string, en: string): Copy => ({ fr, en });
const guide = (id: string, name: string, category: IntegrationGuide["category"], blocker: Copy, next: Copy, source?: string): IntegrationGuide => ({ id, name, category, status: "to_connect", blocker, next, ...(source ? { source, sourceLabel: name } : {}) });

/** Guidance, not executable adapters. An inventory declaration cannot verify an external connection. */
export const integrationGuides: readonly IntegrationGuide[] = [
  guide("zenchef", "Zenchef", "reservations", copy("La connexion Zenchef attend l’autorisation du fournisseur pour TableNow.", "TableNow partner access is not enabled yet."), copy("L’équipe TableNow doit obtenir la documentation et un accès API autorisé. Zenchef demande une offre compatible ou un accord spécifique ; votre restaurant devra ensuite autoriser l’accès.", "The TableNow team needs the documentation and approved API access. Zenchef requires an eligible plan or a specific agreement; your restaurant must then authorize access."), "https://help.zenchef.com/hc/en-gb/articles/27690768125597-Zenchef-API"),
  guide("sevenrooms", "SevenRooms", "reservations", copy("L’accès partenaire et la documentation privée restent à obtenir.", "Partner access and private documentation are still required."), copy("L’équipe TableNow doit demander l’accès partenaire à SevenRooms, puis faire vérifier les droits de votre établissement avant toute lecture.", "The TableNow team must request SevenRooms partner access, then verify your venue permissions before reading any data."), "https://sevenrooms.com/partnership-opportunities/"),
  guide("thefork", "TheFork", "reservations", copy("Les accès API TheFork dédiés à TableNow ne sont pas configurés.", "Dedicated TableNow credentials for TheFork API are not configured."), copy("L’équipe TableNow doit obtenir l’accès adapté auprès de TheFork. L’autorisation et l’identifiant de votre établissement seront ensuite vérifiés. Votre mot de passe TheFork ne doit jamais être transmis à TableNow.", "The TableNow team must obtain the appropriate access from TheFork, then verify authorization and your restaurant identifier. Never send your TheFork password to TableNow."), "https://docs.thefork.io/preliminary-steps"),
  guide("opentable", "OpenTable", "reservations", copy("Le partenariat et les identifiants API ne sont pas activés.", "The partnership and API credentials are not enabled."), copy("L’équipe TableNow doit obtenir l’accès au programme partenaire OpenTable et vérifier les droits sur votre restaurant.", "The TableNow team must obtain OpenTable partner access and verify permissions for your restaurant."), "https://www.opentable.com/restaurant-solutions/api-partners/become-a-partner/"),
  guide("google_calendar", "Google Calendar", "calendar", copy("La connexion à votre agenda n’est pas encore configurée.", "Calendar connection is not configured yet."), copy("Se connecter à TableNow avec Google ne donne aucun accès à votre agenda. Une autorisation Agenda distincte, limitée à la lecture nécessaire, doit être préparée puis vérifiée par TableNow.", "Signing in to TableNow with Google does not grant calendar access. TableNow must prepare and verify a separate Calendar authorization limited to the necessary read access."), "https://developers.google.com/workspace/calendar/api/auth"),
  guide("outlook", "Outlook", "calendar", copy("L’application Microsoft de connexion aux agendas n’est pas configurée.", "The Microsoft calendar connection application is not configured."), copy("TableNow doit préparer l’autorisation Microsoft, puis vous demander l’accès en lecture à l’agenda choisi. Votre compte doit être vérifié avant toute synchronisation.", "TableNow must prepare Microsoft authorization, then request read access to your chosen calendar. Your account must be verified before synchronization."), "https://learn.microsoft.com/en-us/graph/api/user-list-calendars?view=graph-rest-1.0"),
  ...([ ["whatsapp", "WhatsApp"], ["instagram", "Instagram"], ["messenger", "Messenger"] ] as const).map(([id, name]) => guide(id, name, "communications", copy("L’intégration Meta n’est pas disponible dans cette Preview.", "Meta integration is not available in this Preview."), copy("TableNow doit préparer l’application Meta, les permissions métier et leur validation. Aucun message ne sera lu ou envoyé sans une connexion autorisée et testée.", "TableNow must prepare the Meta application, business permissions and their validation. No message will be read or sent without an authorized, tested connection."))),
  guide("emails", "E-mail", "communications", copy("Votre boîte de réception n’est pas connectée.", "Your inbox is not connected."), copy("L’envoi des codes de connexion TableNow ne donne pas accès à votre boîte mail. Le fournisseur de votre boîte et les droits nécessaires doivent être précisés avant de préparer sa connexion.", "TableNow sign-in emails do not grant access to your inbox. Your mailbox provider and required permissions must be identified before preparing its connection.")),
  guide("sms", "SMS", "communications", copy("Aucun fournisseur SMS n’est raccordé.", "No SMS provider is connected."), copy("Le fournisseur, le numéro et l’autorisation d’envoi doivent être définis. Aucun SMS ne partira sans connexion vérifiée et confirmation de l’action.", "The provider, phone number and sending permission must be defined. No SMS will be sent without a verified connection and confirmation of the action.")),
  guide("calls", "Téléphone", "communications", copy("Aucun accès téléphonique n’est activé.", "No telephone access is enabled."), copy("Le numéro et votre opérateur doivent être confirmés avant de préparer un raccordement. TableNow ne modifie ni votre ligne ni son renvoi d’appel.", "Your number and carrier must be confirmed before preparing a connection. TableNow does not change your line or call forwarding.")),
];

const byId = new Map(integrationGuides.map(item => [item.id, item]));
const unknown = (id: string, name: string, category: IntegrationGuide["category"]) => guide(id, name, category,
  copy("La compatibilité de cet outil reste à vérifier.", "Compatibility with this tool still needs verification."),
  copy("Conservez le nom exact de votre outil. TableNow doit vérifier son API officielle, les permissions et l’accès adapté avant de proposer une connexion ; vous pouvez continuer maintenant.", "Keep the exact tool name. TableNow must verify its official API, permissions and appropriate access before offering a connection; you can continue now."));

/** Pure, deterministic projection. Only explicit answers create inventory rows; no fuzzy inference. */
export function declaredIntegrationGuides(answers: OnboardingAnswers): IntegrationGuide[] {
  const result: IntegrationGuide[] = [];
  for (const provider of answers.reservations.providers) {
    const named = provider === "other" ? answers.reservations.otherProvider?.trim() : undefined;
    const known = provider === "other" ? integrationGuides.find(item => item.category === "reservations" && item.name.toLowerCase() === named?.toLowerCase()) : byId.get(provider);
    if (known) result.push(known);
    else if (named) result.push(unknown("reservation-other", named, "reservations"));
  }
  if (answers.reservations.methods.includes("calendar") && answers.reservations.calendarProvider) {
    const id = answers.reservations.calendarProvider;
    result.push(byId.get(id) ?? unknown("calendar-other", "Autre agenda", "calendar"));
  }
  const pos = answers.systems?.pointOfSale;
  if (pos?.status === "declared" && pos.name?.trim()) result.push(unknown("pos", pos.name.trim(), "pos"));
  for (const channel of answers.operations.communications.channels) {
    const item = byId.get(channel);
    if (item) result.push(item);
    else if (channel === "other") result.push(unknown("communication-other", "Autre canal", "communications"));
  }
  return Array.from(new Map(result.map(item => [item.id, item])).values());
}
