import { dayKey } from "./operating";
import { formatRestaurantTime } from "./timezone";
import type { Workspace } from "./types";

type Reservation = Pick<Workspace["reservations"][number], "startsAt" | "partySize" | "status">;
type Task = Pick<Workspace["tasks"][number], "status" | "category">;

export function summarizeToday(reservations: Reservation[], tasks: Task[], timeZone: string, now = new Date()) {
  const today = dayKey(now, timeZone);
  const recorded = reservations.filter(item => dayKey(item.startsAt, timeZone) === today && !["cancelled", "no_show"].includes(item.status));
  const upcoming = recorded.filter(item => ["pending", "confirmed"].includes(item.status) && new Date(item.startsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const byTime = new Map<string, number>();
  for (const item of [...recorded].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const label = formatRestaurantTime(item.startsAt, timeZone);
    byTime.set(label, (byTime.get(label) || 0) + item.partySize);
  }
  const preparation = tasks.filter(item => item.category !== "supplier" && item.status !== "cancelled");
  return {
    covers: recorded.reduce((sum, item) => sum + item.partySize, 0),
    completedCovers: recorded.filter(item => item.status === "completed").reduce((sum, item) => sum + item.partySize, 0),
    reservations: recorded.length,
    nextArrival: upcoming[0]?.startsAt || null,
    arrivals: [...byTime].map(([label, covers]) => ({ label, covers })),
    preparation: preparation.length ? { done: preparation.filter(item => item.status === "done").length, total: preparation.length } : null,
  };
}

export function ownerGreeting(displayName: string | null, timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  const firstName = displayName?.trim().split(/\s+/)[0];
  return `${hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour"}${firstName ? ` ${firstName}` : ""}`;
}


type Plan = Workspace["firstResults"][number];
type PlanPresentation = { recommendations?: string[]; title: string; summary: string; reason: string; action: string; href?: string; briefing?: boolean };
const planPresentations: Record<string, PlanPresentation> = {
  team: { title: "Préparez votre équipe pour le service", summary: "Vérifiez les postes, les horaires et les points à partager avec votre équipe.", reason: "Vous avez choisi de mieux organiser votre équipe.", action: "Organiser mon équipe", href: "/team" },
  customer_communication: { title: "Faites le point sur les demandes clients", summary: "Repérez les demandes à traiter et préparez une réponse avant de l’envoyer.", reason: "Vous avez choisi de mieux gérer les échanges avec vos clients.", action: "Voir les demandes clients", href: "/communications" },
  reservations: { title: "Préparez l’accueil de vos clients", summary: "Vérifiez les réservations enregistrées et les demandes particulières du prochain service.", reason: "Vous avez choisi de simplifier la gestion des réservations.", action: "Préparer les réservations", href: "/service" },
  supplier_order: { title: "Vérifiez les achats à préparer", summary: "Faites le point sur les produits et les quantités avant de préparer une commande.", reason: "Vous avez choisi de mieux préparer vos achats.", action: "Revoir mon plan d’achats", href: "/profile#tn-first-plan" },
  profitability: { title: "Préparez votre suivi de rentabilité", summary: "Reprenez les informations retenues et les coûts à renseigner. Sans ces données, TableNow ne peut pas calculer votre marge.", reason: "Vous avez choisi de mieux comprendre votre rentabilité.", action: "Revoir mon plan de rentabilité", href: "/profile#tn-first-plan" },
  occupancy: { title: "Faites le point sur le prochain service", summary: "Consultez les réservations enregistrées et les places disponibles dans votre plan de salle.", reason: "Vous avez choisi d’améliorer le remplissage.", action: "Voir mon service", href: "/service" },
  customer_loyalty: { title: "Préparez le prochain contact client", summary: "Reprenez les échanges déjà enregistrés pour décider qui recontacter et pourquoi.", reason: "Vous avez choisi de mieux suivre vos clients.", action: "Retrouver les échanges clients", href: "/communications" },
  service: { title: "Partagez l’essentiel avant le service", summary: "Les changements du jour, les points à surveiller et la personne à solliciter : trois repères pour votre équipe.", reason: "Vous avez choisi de mieux préparer le service.", action: "Préparer le briefing", briefing: true },
  global: { title: "Partagez l’essentiel avant le service", summary: "Les changements du jour, les points à surveiller et la personne à solliciter : trois repères pour votre équipe.", reason: "Vous avez choisi un accompagnement global.", action: "Préparer le briefing", briefing: true },
};
const artifactKinds: Record<string, string> = { team_briefing: "team", communication_protocol: "customer_communication", reservation_rules: "reservations", supplier_order_draft: "supplier_order", service_preparation: "service", measurement_plan: "profitability", occupancy_plan: "occupancy", loyalty_protocol: "customer_loyalty" };

const legacyTeamAdvice: Record<string, string> = {
  "Ouvrir le briefing et l'assigner à une personne réelle avant le service.": "Relisez le briefing et choisissez qui le partagera avec l’équipe avant le service.",
  "Aucun nom de salarié ni planning n'a été inventé.": "Complétez les personnes et les horaires utiles à votre équipe.",
  "Open the briefing and assign it to a real person before service.": "Review the briefing and choose who will share it with the team before service.",
  "No employee name or schedule was invented.": "Add the people and times relevant to your team.",
};

/** Presentation only: saved historical plans and their confirmed facts remain unchanged. */
export function firstPlanPresentation(plan: (Pick<Plan, "kind" | "businessArtifact"> & Partial<Pick<Plan, "recommendations">>) | undefined): PlanPresentation {
  const artifactType = plan?.businessArtifact.type;
  const kind = plan?.kind === "global" ? "global" : typeof artifactType === "string" ? artifactKinds[artifactType] || plan?.kind : plan?.kind;
  if (kind && planPresentations[kind]) return { ...planPresentations[kind]!, recommendations: (plan?.recommendations || []).map(text => kind === "team" ? legacyTeamAdvice[text.replace(/[’‘]/g, "'")] || text : text) };
  return { ...planPresentations.global!, reason: "Conseil métier général, à adapter à votre organisation." };
}

export function taskAssignmentLabel(task: Pick<Workspace["tasks"][number], "status" | "assigneeName">): string {
  if (task.status === "done") return task.assigneeName ? `Terminée · attribuée à ${task.assigneeName}` : "Terminée · auteur non renseigné";
  const status = task.status === "in_progress" ? "En cours" : task.status === "cancelled" ? "Annulée" : "À faire";
  return task.assigneeName ? `${status} · ${task.assigneeName}` : `À attribuer · ${status}`;
}
