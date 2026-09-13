/** Verifiable service rules. No provider calls, writes or authority delegation. */
export interface ServiceContext {
  restaurant: { id: string; name: string; timezone: string; capacity: number; is_demo: boolean };
  observedAt: string;
  reservations: { id: string; party_size: number; starts_at: string; status: string; updated_at: string }[];
  shifts: { id: string; status: string; starts_at: string; ends_at: string }[];
  decisions: { id: string; title: string; description: string; priority: string }[];
  tasks: { id: string; title: string; status: string }[];
  profile: { capacity?: number | null } | null;
  layoutSources: string[];
  restaurantRules: { id: string; confirmed_facts: string[]; unknown_fields: string[] }[];
  knowledge: { id: string; topic: string; source_uri: string; version: number; body: string }[];
}
export interface ServiceAssessment {
  version: 1;
  observedAt: string;
  specialists: string[];
  facts: { label: string; value: number | string; sourceIds: string[] }[];
  sources: { id: string; label: string; version?: number }[];
  uncertainties: string[];
  conflicts: string[];
  recommendations: string[];
  externalAction: false;
}
export function assessService(message: string, context: ServiceContext): ServiceAssessment {
  const active = context.reservations.filter(r => !['cancelled','no_show'].includes(r.status));
  const absences = context.shifts.filter(s => s.status === 'absent');
  const reservationsRelevant = /réserv|reserv|client|retard|couver|service|capacit/i.test(message);
  const operationsRelevant = /service|équipe|equipe|absen|salle|capacit/i.test(message) || absences.length > 0;
  const specialists = [...(reservationsRelevant ? ['reservations'] : []), ...(operationsRelevant ? ['operations'] : [])];
  if (!specialists.length) specialists.push('analysis');
  const uncertainties = ["La durée des réservations n’est pas renseignée : le total de couverts du jour ne mesure pas l’occupation simultanée."];
  if (!context.profile?.capacity) uncertainties.push("La capacité du plan de salle n’est pas renseignée ; la capacité par défaut du restaurant ne prouve pas sa disponibilité.");
  if (/retard/i.test(message)) uncertainties.push("Le retard mentionné dans votre message reste une déclaration à rapprocher de la réservation et de son heure d’arrivée.");
  if (!context.shifts.length) uncertainties.push("Aucun poste d’équipe n’est enregistré pour aujourd’hui ; cela ne prouve pas l’absence de personnel.");
  if (!context.knowledge.length) uncertainties.push("Aucune connaissance commune approuvée et valide n’a été retenue pour cette demande.");
  uncertainties.push(...context.restaurantRules.flatMap(r=>r.unknown_fields).slice(0,8));
  const conflicts: string[] = [];
  if (context.profile?.capacity && context.profile.capacity !== context.restaurant.capacity)
    conflicts.push(`La capacité du plan de salle (${context.profile.capacity}) diffère de celle du restaurant (${context.restaurant.capacity}). Faites confirmer la capacité applicable avant tout placement.`);
  const recommendations = [
    ...(conflicts.length ? ["Confirmer la capacité applicable avec le responsable du service."] : []),
    ...(absences.length ? ["Faire confirmer la répartition des postes avant d’accepter des couverts supplémentaires."] : []),
    ...(reservationsRelevant ? ["Rapprocher horaires d’arrivée, durées et tables disponibles avant de confirmer un nouveau placement ; conserver les réservations existantes pendant cette vérification."] : []),
    ...context.decisions.slice(0, 2).map(d => `Décision à examiner : ${d.title}`),
  ];
  if (!recommendations.length) recommendations.push("Préciser la situation à examiner avec les informations du restaurant.");
  const sources = [
    {id:`restaurants:${context.restaurant.id}`,label:'Restaurant sélectionné'},
    ...context.reservations.map(r=>({id:`reservations:${r.id}`,label:`Réservation mise à jour le ${r.updated_at}`})),
    ...context.shifts.map(s=>({id:`team_shifts:${s.id}`,label:'Poste du service'})),
    ...context.decisions.map(d=>({id:`decisions:${d.id}`,label:d.title})),
    ...context.layoutSources.map(id=>({id:`dining_tables:${id}`,label:'Capacité du plan de salle'})),
    ...context.restaurantRules.map(r=>({id:`onboarding_first_results:${r.id}`,label:'Synthèse du profil confirmée'})),
    ...context.knowledge.map(k=>({id:`knowledge:${k.id}`,label:k.source_uri,version:k.version})),
  ];
  return {version:1,observedAt:context.observedAt,specialists,
    facts:[{label:'Couverts enregistrés pour la journée (hors annulations et absents)',value:active.reduce((sum,r)=>sum+r.party_size,0),sourceIds:active.map(r=>`reservations:${r.id}`)},
      {label:'Postes signalés absents',value:absences.length,sourceIds:absences.map(s=>`team_shifts:${s.id}`)}],
    sources,uncertainties,conflicts,recommendations,externalAction:false};
}
export function serviceAssessmentText(report: ServiceAssessment): string {
  return [report.facts.map(f=>`${f.label} : ${f.value}.`).join('\n'),
    report.conflicts.join('\n'),report.recommendations.join('\n'),
    `À préciser :\n${report.uncertainties.join('\n')}`,
    "Le restaurateur décide. Aucune action externe n’a été exécutée."].filter(Boolean).join('\n\n');
}
