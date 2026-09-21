import { declaredIntegrationGuides } from "./integration-guidance";
import type { OnboardingAnswers } from "@tablenow/contracts";

export interface SetupChecklistItem {
  id: string;
  title: string;
  reason: string;
  complete: boolean;
  section: "priorities" | "establishment" | "reservations" | "review";
  step?: "connections";
}

const providerLabels: Record<string, string> = { zenchef: "Zenchef", sevenrooms: "SevenRooms", thefork: "TheFork", opentable: "OpenTable" };

/** Read-only projection of saved answers. A declaration never proves a connection. */
export function onboardingChecklist(answers: OnboardingAnswers): SetupChecklistItem[] {
  const providers = answers.reservations.providers.flatMap(provider => {
    const label = provider === "other" ? answers.reservations.otherProvider?.trim() : providerLabels[provider];
    return label ? [{ id: `reservation-${provider}`, label }] : [];
  });
  const inventoryKnown = providers.length > 0 || answers.reservations.methods.length > 0;
  const pos = answers.systems?.pointOfSale;
  return [
    { id: "priorities", title: answers.priorities.primaryFocus ? "Votre priorité est enregistrée" : "Choisir votre première priorité", reason: "TableNow part de ce qui vous prend du temps.", complete: Boolean(answers.priorities.primaryFocus), section: "priorities" },
    { id: "establishment", title: answers.establishment.identityConfirmed ? "Votre établissement est confirmé" : "Confirmer votre établissement", reason: answers.establishment.restaurantName || "Pour rattacher les informations au bon restaurant.", complete: answers.establishment.identityConfirmed, section: "establishment" },
    { id: "reservation-inventory", title: inventoryKnown ? "Votre organisation des réservations est renseignée" : "Indiquer comment vous prenez les réservations", reason: inventoryKnown ? "D’après vos réponses, avec ou sans logiciel." : "Logiciel, téléphone, calendrier ou papier : votre fonctionnement suffit.", complete: inventoryKnown, section: "reservations" },
    ...providers.map(({ id, label }): SetupChecklistItem => ({ id, title: `${label} : voir comment le raccorder`, reason: declaredIntegrationGuides(answers).find(tool => tool.name === label)?.blocker.fr || "Consultez les étapes nécessaires pour raccorder cet outil.", complete: false, section: "reservations", step: "connections" })),
    ...declaredIntegrationGuides(answers).filter(tool => tool.category === "calendar" || tool.category === "communications").map((tool): SetupChecklistItem => ({ id: `integration-${tool.id}`, title: `${tool.name} : voir comment le raccorder`, reason: tool.blocker.fr, complete: false, section: "reservations", step: "connections" })),
    { id: "pos-inventory", title: pos?.status === "none" ? "Aucun logiciel de caisse déclaré" : pos?.status === "declared" && pos.name?.trim() ? `Caisse : ${pos.name.trim()}` : "Indiquer votre fonctionnement en caisse", reason: pos?.status === "none" ? "Votre réponse est conservée ; aucun logiciel n’est imposé." : pos?.status === "declared" && pos.name?.trim() ? "Outil déclaré par vous. La connexion reste à préparer, sans bloquer votre accompagnement." : "Vous pourrez le préciser plus tard.", complete: pos?.status === "none", section: "reservations", ...(pos?.status === "declared" && pos.name?.trim() ? { step: "connections" as const } : {}) },
  ];
}
