export interface ServiceTable {
  id: string;
  restaurantId: string;
  name: string;
  area: string;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "blocked";
  revision: number;
}
export interface OutgoingMessage {
  id: string;
  restaurantId: string;
  recipient: string;
  subject: string;
  body: string;
  status: "draft" | "queued" | "sent" | "failed";
  createdAt: string;
}
export interface ChatEntry {
  id: string;
  restaurantId: string;
  role: "user" | "assistant";
  body: string;
  mode: string;
  createdAt: string;
}
export interface OperatingState {
  tables: ServiceTable[];
  outgoing: OutgoingMessage[];
  chat: ChatEntry[];
  pausedShiftIds: string[];
  capabilities: {
    email: boolean;
    ai: boolean;
    sms: boolean;
    phone: boolean;
    whatsapp: boolean;
  };
}
export const emptyOperating: OperatingState = {
  tables: [],
  outgoing: [],
  chat: [],
  pausedShiftIds: [],
  capabilities: {
    email: false,
    ai: false,
    sms: false,
    phone: false,
    whatsapp: false,
  },
};
export function dayKey(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function initials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}
export function statusLabel(value: string): string {
  return (
    (
      {
        available: "Libre",
        occupied: "Occupée",
        reserved: "Réservée",
        blocked: "Indisponible",
        pending: "À confirmer",
        confirmed: "Confirmé",
        seated: "Installé",
        completed: "Terminé",
        cancelled: "Annulé",
        no_show: "Absent",
        open: "À traiter",
        handled: "Traité",
        escalated: "À valider",
        approved: "Validée",
        rejected: "Refusée",
        snoozed: "Reportée",
        resolved: "Résolue",
        planned: "Planifié",
        absent: "Absent",
        on_break: "En pause",
        in_progress: "En cours",
        done: "Fait",
        draft: "Brouillon",
        queued: "Envoi à vérifier",
        sent: "Accepté par le service mail",
        failed: "Échec d’envoi",
        low: "Faible",
        medium: "Normale",
        high: "Prioritaire",
        critical: "Urgente",
      } as Record<string, string>
    )[value] || value
  );
}
export function channelLabel(channel: string): string {
  return (
    (
      {
        phone: "Appel",
        email: "E-mail",
        sms: "SMS",
        whatsapp: "WhatsApp",
        web: "Site web",
        instagram: "Instagram",
        messenger: "Messenger",
      } as Record<string, string>
    )[channel] || channel
  );
}
