"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Building2,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Euro,
  Gauge,
  Inbox,
  MapPin,
  MessageSquareText,
  Minus,
  Phone,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  Users,
  Utensils,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import type { Workspace } from "@/lib/types";
import { aggregateWorkspaceMetrics, scopeWorkspace } from "@/lib/workspace";
import { addLocalHours, formatRestaurantDate, formatRestaurantTime, nextServiceLocal, restaurantLocalToIso } from "@/lib/timezone";
import { useSession } from "@/hooks/useSession";
import { publicPilotSystems, publicPilotWorkspace } from "@/lib/public-pilot";
import { isPublicPilotRuntime } from "@/lib/public-pilot-host";
import { AppChrome } from "./AppChrome";
import { LoadingScreen } from "./LoadingScreen";
import { ModalFrame } from "./ModalFrame";
import { SystemsCenter } from "./SystemsCenter";

export type ProductSection = "today" | "communications" | "reservations" | "operations" | "team" | "inventory" | "performance" | "locations" | "systems" | "copilot";

const meta: Record<ProductSection, { title: string; subtitle: string }> = {
  today: { title: "Aujourd'hui", subtitle: "Le service, les signaux et les décisions qui comptent maintenant." },
  communications: { title: "Communications", subtitle: "Chaque demande comprise, classée et rendue actionnable." },
  reservations: { title: "Réservations", subtitle: "La demande réelle, les risques et les opportunités par créneau." },
  operations: { title: "Opérations", subtitle: "Le plan vivant du service — avant que les imprévus ne deviennent urgents." },
  team: { title: "Équipe", subtitle: "La présence et la charge, reliées à ce que le service exige vraiment." },
  inventory: { title: "Stocks", subtitle: "Voir les tensions suffisamment tôt pour toujours garder le choix." },
  performance: { title: "Performance", subtitle: "L'impact opérationnel de TableNow, sans graphiques décoratifs." },
  locations: { title: "Établissements", subtitle: "Un langage commun pour chaque adresse du groupe." },
  systems: { title: "Systèmes & actions", subtitle: "TableNow choisit le chemin le plus fiable, du logiciel métier au cahier papier." },
  copilot: { title: "TableNow Copilot", subtitle: "Questionnez vos opérations, comprenez les causes et validez les actions." },
};

export function ProductShell({ section }: { section: ProductSection }) {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [reservationOpen, setReservationOpen] = useState(false);
  const [restaurantOpen, setRestaurantOpen] = useState(false);
  const [manualEntry, setManualEntry] = useState<"task" | "shift" | "inventory" | null>(null);
  const [activeRestaurantId, setActiveRestaurantId] = useState<string | null>(null);
  const [restaurantContextReady, setRestaurantContextReady] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    if (isPublicPilotRuntime()) {
      setWorkspace(publicPilotWorkspace);
      setError("");
      setRefreshing(false);
      return;
    }
    try { setWorkspace(await api<Workspace>("/v1/workspace")); setError(""); }
    catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) router.replace("/login");
      else setError(caught instanceof Error ? caught.message : "Impossible de charger l'espace.");
    } finally { setRefreshing(false); }
  }, [router]);

  useEffect(() => { if (session) void refresh(true); }, [session, refresh]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 3200); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => {
    if (!session) return;
    try {
      const saved = JSON.parse(localStorage.getItem("tablenow.copilot.restaurant-context.v1") || "null") as { tenantId?: string; restaurantId?: string | null } | null;
      if (saved?.tenantId === session.tenant.id) setActiveRestaurantId(saved.restaurantId || null);
    } catch { localStorage.removeItem("tablenow.copilot.restaurant-context.v1"); }
    finally { setRestaurantContextReady(true); }
  }, [session]);
  const effectiveRestaurantId = activeRestaurantId && workspace?.restaurants.some((restaurant) => restaurant.id === activeRestaurantId) ? activeRestaurantId : null;
  const visibleWorkspace = useMemo(() => scopeWorkspace(workspace, effectiveRestaurantId), [workspace, effectiveRestaurantId]);

  const mutate = async (path: string, method: string, body: unknown, success: string) => {
    if (session?.membership.role === "viewer") {
      setToast("Version publique en lecture seule — aucune donnée n'a été modifiée.");
      return;
    }
    try { await api(path, { method, body: JSON.stringify(body) }); await refresh(true); setToast(success); }
    catch (caught) { setToast(caught instanceof Error ? caught.message : "L'action n'a pas abouti."); }
  };

  if (sessionLoading || !session || !workspace || !visibleWorkspace || !restaurantContextReady) return <LoadingScreen />;
  const pageMeta = meta[section];
  const publicPilot = isPublicPilotRuntime();
  const readOnly = session.membership.role === "viewer";
  const requestWriteAccess = () => setToast("Version publique en lecture seule — connectez un espace invité pour agir.");
  const selectRestaurant = (restaurantId: string | null) => {
    setActiveRestaurantId(restaurantId);
    try { localStorage.setItem("tablenow.copilot.restaurant-context.v1", JSON.stringify({ tenantId: session.tenant.id, restaurantId })); }
    catch { setToast("Le périmètre est actif pour cette page, mais le navigateur ne peut pas le mémoriser."); }
  };

  const notifications = visibleWorkspace.decisions.filter((item) => item.status === "open").slice(0, 4).map((item) => ({ id: item.id, title: item.title, detail: item.priority === "critical" ? "Décision critique" : "Décision à traiter", href: "/today" }));

  return <AppChrome session={session} active={section} title={pageMeta.title} subtitle={pageMeta.subtitle} refreshing={refreshing} onRefresh={() => void refresh()} notifications={notifications} restaurants={workspace.restaurants} activeRestaurantId={effectiveRestaurantId} onRestaurantChange={selectRestaurant}>
    {readOnly && <div className="public-pilot-banner"><ShieldCheck size={16} /><span><strong>Version pilote publique</strong> Données fictives, navigation complète, actions désactivées.</span></div>}
    {error && <div className="inline-error"><AlertTriangle size={16} />{error}<button onClick={() => void refresh()}>Réessayer</button></div>}
    {section === "today" && <TodayView workspace={visibleWorkspace} mutate={mutate} onNewReservation={readOnly ? requestWriteAccess : () => setReservationOpen(true)} />}
    {section === "communications" && <CommunicationsView workspace={visibleWorkspace} mutate={mutate} />}
    {section === "reservations" && <ReservationsView workspace={visibleWorkspace} mutate={mutate} onNew={readOnly ? requestWriteAccess : () => setReservationOpen(true)} />}
    {section === "operations" && <OperationsView workspace={visibleWorkspace} mutate={mutate} onNew={["platform_admin", "owner", "group_admin", "manager", "operator"].includes(session.membership.role) ? () => setManualEntry("task") : undefined} />}
    {section === "team" && <TeamView workspace={visibleWorkspace} onNew={["platform_admin", "owner", "group_admin", "manager"].includes(session.membership.role) ? () => setManualEntry("shift") : undefined} />}
    {section === "inventory" && <InventoryView workspace={visibleWorkspace} mutate={mutate} onNew={["platform_admin", "owner", "group_admin", "manager", "operator"].includes(session.membership.role) ? () => setManualEntry("inventory") : undefined} />}
    {section === "performance" && <PerformanceView workspace={visibleWorkspace} />}
    {section === "locations" && <LocationsView workspace={workspace} onOpen={selectRestaurant} onNew={() => setRestaurantOpen(true)} canManage={["platform_admin", "owner", "group_admin"].includes(session.membership.role)} />}
    {section === "systems" && <SystemsCenter restaurants={workspace.restaurants} role={session.membership.role} activeRestaurantId={effectiveRestaurantId} {...(publicPilot ? { publicOverview: publicPilotSystems } : {})} />}
    {section === "copilot" && <CopilotView key={effectiveRestaurantId || "group"} workspace={visibleWorkspace} activeRestaurantId={effectiveRestaurantId} mutate={mutate} refresh={() => refresh(true)} readOnly={publicPilot} />}
    {reservationOpen && <NewReservationModal restaurants={workspace.restaurants} activeRestaurantId={effectiveRestaurantId} onClose={() => setReservationOpen(false)} onCreated={async () => { setReservationOpen(false); await refresh(true); setToast("Réservation ajoutée au service."); }} />}
    {restaurantOpen && <NewRestaurantModal onClose={() => setRestaurantOpen(false)} onCreated={async (restaurantId) => { setRestaurantOpen(false); await refresh(true); selectRestaurant(restaurantId); setToast("Établissement créé et contexte activé."); }} />}
    {manualEntry && <ManualEntryModal kind={manualEntry} restaurants={workspace.restaurants} activeRestaurantId={effectiveRestaurantId} onClose={() => setManualEntry(null)} onCreated={async () => { const label = manualEntry === "task" ? "Tâche ajoutée aux opérations." : manualEntry === "shift" ? "Service ajouté au planning." : "Article ajouté au stock."; setManualEntry(null); await refresh(true); setToast(label); }} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
  </AppChrome>;
}

function TodayView({ workspace, mutate, onNewReservation }: { workspace: Workspace; mutate: Mutation; onNewReservation: () => void }) {
  const { summary } = workspace;
  const openDecisions = workspace.decisions.filter((item) => item.status === "open");
  const recent = workspace.communications.slice(0, 4);
  const groupView = workspace.restaurants.length > 1;
  const hasReservations = workspace.reservations.length > 0;
  const hasInventory = workspace.inventory.length > 0;
  const hasMetrics = workspace.metrics.length > 0;
  return <div className="view-stack">
    <section className="command-brief">
      <div><span className="brief-kicker"><CircleDot size={13} /> Lecture du service</span><h2>{hasReservations ? <>Le service est rempli à <em>{summary.occupancyPercent} %</em>. {summary.openDecisions ? `${summary.openDecisions} décisions demandent votre attention.` : "Aucun blocage n'attend votre validation."}</> : <>Le cockpit est prêt, mais <em>aucune réservation</em> n’est encore renseignée.</>}</h2><p>{hasReservations ? `${summary.availableTables} tables restent mobilisables.` : "Ajoutez la première demande ou connectez la méthode déjà utilisée."} {hasInventory ? (summary.inventoryAlerts ? `${summary.inventoryAlerts} niveau de stock est à surveiller avant la mise en place.` : "Les articles renseignés sont au-dessus de leur seuil.") : "Aucun état de stock n’est encore connu."}</p></div>
      <div className="brief-actions"><button className="secondary-button" onClick={onNewReservation}><CalendarPlus size={16} /> Ajouter une réservation</button><Link className="primary-button" href="/copilot"><Sparkles size={16} /> Demander au Copilot</Link></div>
    </section>
    <section className="kpi-grid">
      <Kpi icon={<Gauge />} label="Occupation prévue" value={`${summary.occupancyPercent} %`} detail={`${summary.coversToday} couverts confirmés`} tone="lime" />
      <Kpi icon={<Euro />} label="Revenu capté" value={euro(summary.revenueCapturedToday)} detail={hasMetrics ? "attribué à TableNow aujourd'hui" : "mesure en attente"} />
      <Kpi icon={<Clock3 />} label="Temps rendu" value={`${Math.floor(summary.timeSavedMinutes / 60)} h ${summary.timeSavedMinutes % 60}`} detail={hasMetrics ? "demandes gérées automatiquement" : "mesure en attente"} />
      <Kpi icon={<Utensils />} label="Capacité encore libre" value={`${summary.availableTables} tables`} detail="réparties sur les créneaux du soir" />
    </section>
    <div className="dashboard-grid">
      <section className="panel decisions-panel"><PanelTitle eyebrow="À traiter maintenant" title="Décisions" count={openDecisions.length} />
        <div className="decision-list">{openDecisions.length ? openDecisions.map((decision) => <article className={`decision-card priority-${decision.priority}`} key={decision.id}><div className="priority-line"><span>{decision.priority === "critical" ? "Critique" : decision.priority === "high" ? "Prioritaire" : "À décider"}{groupView && <> · {restaurantName(workspace, decision.restaurantId)}</>}</span><small>{decision.dueAt ? relativeTime(decision.dueAt) : "Aujourd'hui"}</small></div><h3>{decision.title}</h3><p>{decision.description}</p>{decision.suggestedAction && <div className="suggestion"><Sparkles size={14} /><span><strong>Recommandation</strong>{decision.suggestedAction}</span></div>}<div className="decision-actions"><button onClick={() => void mutate(`/v1/decisions/${decision.id}`, "PATCH", { status: "rejected" }, "Décision écartée.")}><X size={15} /> Refuser</button><button className="approve" onClick={() => void mutate(`/v1/decisions/${decision.id}`, "PATCH", { status: "approved" }, "Décision validée et journalisée.")}><Check size={15} /> Valider</button></div></article>) : <Empty icon={<CheckCircle2 />} title="Rien à valider" text="TableNow n'a détecté aucun point bloquant." />}</div>
      </section>
      <section className="panel activity-panel"><PanelTitle eyebrow="Ce qui se passe" title="Activité en direct" /><div className="activity-list">{recent.length ? recent.map((item) => <article key={item.id}><i className={`channel-${item.channel}`}>{item.channel === "phone" ? <Phone size={14} /> : <MessageSquareText size={14} />}</i><div><span><strong>{item.contactName || "Client"}</strong><small>{relativeTime(item.occurredAt)}</small></span>{groupView && <small className="restaurant-context">{restaurantName(workspace, item.restaurantId)}</small>}<p>{item.summary}</p></div></article>) : <Empty icon={<Inbox />} title="Aucune activité reçue" text="Les appels, messages et saisies apparaîtront ici dès qu’une source sera active." />}</div><Link className="panel-link" href="/communications">Voir toutes les communications <ArrowRight size={14} /></Link></section>
    </div>
  </div>;
}

function CommunicationsView({ workspace, mutate }: { workspace: Workspace; mutate: Mutation }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const rows = workspace.communications.filter((item) => (filter === "all" || item.status === filter) && `${item.contactName} ${item.subject} ${item.summary}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="view-stack"><div className="toolbar"><div className="segmented" aria-label="Filtrer les communications"><button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Toutes</button><button aria-pressed={filter === "open"} className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>À traiter</button><button aria-pressed={filter === "escalated"} className={filter === "escalated" ? "active" : ""} onClick={() => setFilter("escalated")}>Escaladées</button><button aria-pressed={filter === "handled"} className={filter === "handled" ? "active" : ""} onClick={() => setFilter("handled")}>Gérées</button></div><label className="search-field"><Search size={15} /><span className="sr-only">Rechercher une communication</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, sujet, demande…" /></label></div>
    <section className="panel table-panel" aria-label="Communications"><div className="communication-table table-head" aria-hidden="true"><span>Canal</span><span>Contact et demande</span><span>Moment</span><span>État</span><span /></div>{rows.map((item) => <article className="communication-table table-row" key={item.id}><span className="mobile-channel"><i className={`channel-icon channel-${item.channel}`}>{item.channel === "phone" ? <Phone size={15} /> : <MessageSquareText size={15} />}</i><small>{item.channel}</small></span><span className="table-primary"><strong>{item.contactName || "Non identifié"}</strong><small>{workspace.restaurants.length > 1 && `${restaurantName(workspace, item.restaurantId)} · `}{item.subject || "Demande client"}</small><p>{item.summary}</p></span><span className="table-moment">{relativeTime(item.occurredAt)}</span><span className="table-status"><StatusBadge status={item.status} /></span><span className="table-action">{item.status !== "handled" ? <button className="row-action" onClick={() => void mutate(`/v1/communications/${item.id}`, "PATCH", { status: "handled" }, "Communication classée comme traitée.")}>Traiter <ChevronRight size={14} /></button> : <span className="completed-label"><CheckCircle2 size={17} className="success-icon" /> Traitée</span>}</span></article>)}{!rows.length && <Empty icon={<Inbox />} title="Aucune communication" text={workspace.communications.length ? "Modifiez vos filtres pour retrouver une demande." : "Connectez un canal ou attendez la première demande entrante."} />}</section>
  </div>;
}

function ReservationsView({ workspace, mutate, onNew }: { workspace: Workspace; mutate: Mutation; onNew: () => void }) {
  const [filter, setFilter] = useState("active");
  const rows = workspace.reservations.filter((item) => filter === "all" || (filter === "active" ? !["cancelled", "completed", "no_show"].includes(item.status) : item.status === filter));
  const nextReservation = workspace.reservations.filter((item) => !["cancelled", "completed", "no_show"].includes(item.status) && new Date(item.startsAt) >= new Date()).sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())[0];
  const nextTimezone = nextReservation ? restaurantTimezone(workspace, nextReservation.restaurantId) : "Europe/Paris";
  return <div className="view-stack"><div className="toolbar"><div className="segmented" aria-label="Filtrer les réservations"><button aria-pressed={filter === "active"} className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Service à venir</button><button aria-pressed={filter === "pending"} className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>À confirmer</button><button aria-pressed={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Toutes</button></div><button className="primary-button compact" onClick={onNew}><Plus size={16} /> Nouvelle réservation</button></div>
    <section className="service-band"><div><span>Prochaine arrivée</span><strong>{nextReservation ? formatRestaurantTime(nextReservation.startsAt, nextTimezone) : "Non calculable"}</strong><small>{nextReservation ? `${nextReservation.guestName} · ${nextReservation.partySize} couverts` : "Aucune réservation à venir"}</small></div><div className="capacity-meter"><i style={{ width: `${workspace.summary.occupancyPercent}%` }} /></div><div><span>Encore disponible</span><strong>{workspace.summary.availableTables} tables</strong><small>selon la capacité renseignée</small></div></section>
    <section className="panel table-panel" aria-label="Réservations"><div className="reservation-table table-head" aria-hidden="true"><span>Heure</span><span>Client</span><span>Couverts</span><span>Origine</span><span>Attention</span><span>État</span><span /></div>{rows.map((item) => { const timezone = restaurantTimezone(workspace, item.restaurantId); return <article className="reservation-table table-row" key={item.id}><span className="reservation-time"><strong className="time-cell">{formatRestaurantTime(item.startsAt, timezone)}</strong><small>{formatRestaurantDate(item.startsAt, timezone)}</small></span><span className="table-primary"><strong>{item.guestName}</strong><small>{workspace.restaurants.length > 1 && `${restaurantName(workspace, item.restaurantId)} · `}{item.guestPhone || item.guestEmail || "Coordonnées non renseignées"}</small></span><span className="reservation-party" aria-label={`${item.partySize} couverts`}><strong>{item.partySize}</strong><small>couverts</small></span><span className="reservation-source"><SourceBadge source={item.source} /></span><span className="reservation-note">{item.notes ? <small className="attention-note"><AlertTriangle size={13} />{item.notes}</small> : <small>Aucune attention particulière</small>}</span><span className="table-status"><StatusBadge status={item.status} /></span><span className="table-action"><ReservationAction reservation={item} mutate={mutate} /></span></article>; })}{!rows.length && <Empty icon={<CalendarPlus />} title="Aucune réservation sur ce filtre" text="Ajoutez une réservation manuellement ou connectez la source utilisée par cet établissement." />}</section></div>;
}

function OperationsView({ workspace, mutate, onNew }: { workspace: Workspace; mutate: Mutation; onNew: (() => void) | undefined }) {
  const columns = [["open", "À faire"], ["in_progress", "En cours"], ["done", "Terminé"]] as const;
  return <div className="view-stack">{onNew && <div className="toolbar manual-toolbar"><span>Saisie directe pour les équipes sans logiciel connecté.</span><button className="primary-button compact" onClick={onNew}><Plus size={16} /> Nouvelle tâche</button></div>}<section className="operations-summary"><div><Zap size={18} /><span><strong>{workspace.tasks.filter((task) => task.status !== "done").length} actions ouvertes</strong><small>{workspace.tasks.length ? "selon les tâches saisies ou importées" : "aucune tâche enregistrée"}</small></span></div><div><ShieldCheck size={18} /><span><strong>Les actions sensibles restent bloquées</strong><small>jusqu'à validation d'un responsable</small></span></div></section>{workspace.tasks.length ? <div className="kanban">{columns.map(([status, label]) => <section key={status}><header><span>{label}</span><i>{workspace.tasks.filter((task) => task.status === status).length}</i></header><div>{workspace.tasks.filter((task) => task.status === status).map((task) => <article className="task-card" key={task.id}><span className="task-category">{task.category}</span><h3>{task.title}</h3><p>{workspace.restaurants.length > 1 && `${restaurantName(workspace, task.restaurantId)} · `}{task.assigneeName || "Non assigné"}</p>{task.dueAt && <small><Clock3 size={13} />{relativeTime(task.dueAt)}</small>}<div className="task-progress">{status === "open" && <button onClick={() => void mutate(`/v1/tasks/${task.id}`, "PATCH", { status: "in_progress" }, "Action démarrée.")}>Commencer <ArrowRight size={14} /></button>}{status === "in_progress" && <button onClick={() => void mutate(`/v1/tasks/${task.id}`, "PATCH", { status: "done" }, "Action terminée.")}><Check size={14} /> Terminer</button>}{status === "done" && <span><CheckCircle2 size={14} /> Journalisée</span>}</div></article>)}</div></section>)}</div> : <section className="panel"><Empty icon={<Zap />} title="Aucune tâche pour le moment" text="Ajoutez une tâche manuellement ou connectez votre outil actuel." /></section>}</div>;
}

function TeamView({ workspace, onNew }: { workspace: Workspace; onNew: (() => void) | undefined }) {
  const confirmed = workspace.shifts.filter((shift) => shift.status === "confirmed").length;
  return <div className="view-stack">{onNew && <div className="toolbar manual-toolbar"><span>Planning TableNow ou saisie rapide depuis le planning papier.</span><button className="primary-button compact" onClick={onNew}><Plus size={16} /> Ajouter un service</button></div>}<section className="team-brief"><div><Users size={23} /><span><strong>{workspace.shifts.length ? `${confirmed} personnes confirmées ce soir` : "Planning non renseigné"}</strong><p>{workspace.shifts.length ? `La couverture est rapprochée des ${workspace.summary.coversToday} couverts prévus.` : "Ajoutez les présences pour que TableNow puisse calculer la charge sans inventer de données."}</p></span></div><span className="coverage-badge">Couverture <strong>{workspace.shifts.length ? "à surveiller" : "inconnue"}</strong></span></section><section className="panel"><PanelTitle eyebrow="Service du soir" title="Présences et charge" /><div className="shift-list">{workspace.shifts.map((shift) => { const timezone = restaurantTimezone(workspace, shift.restaurantId); return <article key={shift.id}><div className="avatar">{initials(shift.teamMemberName)}</div><div><strong>{shift.teamMemberName}</strong><small>{shift.roleTitle}{workspace.restaurants.length > 1 && ` · ${restaurantName(workspace, shift.restaurantId)}`}</small></div><span>{formatRestaurantTime(shift.startsAt, timezone)} <i /> {formatRestaurantTime(shift.endsAt, timezone)}</span><StatusBadge status={shift.status} /></article>; })}{!workspace.shifts.length && <Empty icon={<Users />} title="Aucune présence saisie" text="Le planning peut être ajouté manuellement depuis un ordinateur ou un mobile." />}</div></section>{workspace.shifts.length > 0 && <section className="insight-row"><div><TrendingUp size={17} /><span><strong>Charge attendue</strong><small>calculée depuis les réservations</small></span><em>{workspace.summary.occupancyPercent} %</em></div><div><UserRoundCheck size={17} /><span><strong>Équipe confirmée</strong><small>personnes prévues au service</small></span><em>{confirmed}</em></div><div><Clock3 size={17} /><span><strong>Créneau couvert</strong><small>selon le planning saisi</small></span><em>{shiftCoverageHours(workspace.shifts)} h</em></div></section>}</div>;
}

function InventoryView({ workspace, mutate, onNew }: { workspace: Workspace; mutate: Mutation; onNew: (() => void) | undefined }) {
  return <div className="view-stack">{onNew && <div className="toolbar manual-toolbar"><span>Inventaire connecté ou relevé manuel depuis la réserve.</span><button className="primary-button compact" onClick={onNew}><Plus size={16} /> Ajouter un article</button></div>}<section className="inventory-alert"><AlertTriangle size={20} /><div><strong>{workspace.inventory.length ? `${workspace.summary.inventoryAlerts} produit à sécuriser avant le service` : "Aucun inventaire encore renseigné"}</strong><p>TableNow ne passe aucune commande sans validation et ne déclare jamais un stock sain sans données.</p></div><Link href="/copilot">Analyser avec Copilot <ArrowRight size={14} /></Link></section>{workspace.inventory.length ? <div className="inventory-grid">{workspace.inventory.map((item) => { const ratio = Math.min(100, Math.round(item.quantity / Math.max(item.reorderThreshold * 2, 1) * 100)); return <article className={`inventory-card ${item.status}`} key={item.id}><header><div><span className="stock-status">{item.status === "alert" ? "À surveiller" : "Niveau sain"}</span><h3>{item.name}</h3>{workspace.restaurants.length > 1 && <small className="restaurant-context">{restaurantName(workspace, item.restaurantId)}</small>}</div><span>{item.quantity}<small>{item.unit}</small></span></header><div className="stock-meter"><i style={{ width: `${ratio}%` }} /></div><p>Seuil d'alerte : {item.reorderThreshold} {item.unit}</p><div className="stock-controls"><button aria-label={`Retirer une unité de ${item.name}`} onClick={() => void mutate(`/v1/inventory/${item.id}`, "PATCH", { quantity: Math.max(0, item.quantity - 1), note: "Ajustement manuel" }, `${item.name} mis à jour.`)}><Minus size={14} /></button><span>Ajuster le niveau</span><button aria-label={`Ajouter une unité de ${item.name}`} onClick={() => void mutate(`/v1/inventory/${item.id}`, "PATCH", { quantity: item.quantity + 1, note: "Ajustement manuel" }, `${item.name} mis à jour.`)}><Plus size={14} /></button></div></article>; })}</div> : <section className="panel"><Empty icon={<Inbox />} title="Inventaire vide" text="Ajoutez le premier article ou connectez votre système de stock." /></section>}</div>;
}

function PerformanceView({ workspace }: { workspace: Workspace }) {
  const metrics = (workspace.restaurants.length > 1 ? aggregateWorkspaceMetrics(workspace.metrics) : workspace.metrics).slice(-14);
  const maxRevenue = Math.max(...metrics.map((metric) => metric.revenueCaptured), 1);
  const totalRevenue = metrics.reduce((sum, metric) => sum + metric.revenueCaptured, 0);
  const totalMinutes = metrics.reduce((sum, metric) => sum + metric.timeSavedMinutes, 0);
  const avgConversion = metrics.length ? metrics.reduce((sum, metric) => sum + metric.conversionRate, 0) / metrics.length : 0;
  return <div className="view-stack"><section className="impact-hero"><span className="eyebrow">Impact des 14 derniers jours</span><div><strong>{euro(totalRevenue)}</strong><p>{metrics.length ? "de revenu lié aux demandes captées et converties par TableNow." : "Aucune mesure n’est encore connectée ; TableNow n’invente pas d’impact."}</p></div></section><section className="kpi-grid three"><Kpi icon={<Clock3 />} label="Temps économisé" value={`${Math.round(totalMinutes / 60)} h`} detail={metrics.length ? "rendu aux équipes" : "mesure en attente"} /><Kpi icon={<TrendingUp />} label="Conversion moyenne" value={`${avgConversion.toFixed(1)} %`} detail={metrics.length ? "demande vers réservation" : "mesure en attente"} /><Kpi icon={<Phone />} label="Demandes traitées" value={String(metrics.reduce((sum, item) => sum + item.callsHandled, 0))} detail={metrics.length ? "sur la période" : "mesure en attente"} /></section><section className="panel chart-panel"><PanelTitle eyebrow="Revenu capté" title="Chaque jour, pas une moyenne abstraite" />{metrics.length ? <div className="bar-chart" role="img" aria-label="Revenu capté sur les quatorze derniers jours">{metrics.map((metric) => <div key={metric.date} title={`${formatRestaurantDate(metric.date, "UTC")} — ${euro(metric.revenueCaptured)}`}><span style={{ height: `${Math.max(8, metric.revenueCaptured / maxRevenue * 100)}%` }} /><small>{new Date(`${metric.date}T12:00:00.000Z`).toLocaleDateString("fr-FR", { weekday: "narrow", timeZone: "UTC" })}</small></div>)}</div> : <Empty icon={<TrendingUp />} title="Aucune série mesurée" text="Les indicateurs apparaîtront après saisie ou connexion d’une source vérifiée." />}</section></div>;
}

function LocationsView({ workspace, onOpen, onNew, canManage }: { workspace: Workspace; onOpen: (restaurantId: string) => void; onNew: () => void; canManage: boolean }) {
  return <div className="view-stack"><section className="group-overview"><div><span className="eyebrow">Vue groupe</span><h2>{workspace.restaurants.length} établissement{workspace.restaurants.length > 1 ? "s" : ""}, un seul langage opérationnel.</h2></div><div className="group-actions"><Link className="secondary-button" href="/systems"><ShieldCheck size={16} /> Configurer les systèmes</Link>{canManage && <button className="primary-button" onClick={onNew}><Plus size={16} /> Ajouter un établissement</button>}</div></section><div className="location-grid">{workspace.restaurants.map((restaurant) => { const summary = workspace.restaurantSummaries.find((item) => item.restaurantId === restaurant.id); return <article className="location-card" key={restaurant.id}><header><div className="location-monogram">{initials(restaurant.name)}</div><span className="live-badge"><i /> En direct</span></header><h3>{restaurant.name}</h3><p><MapPin size={14} />{restaurant.address || "Adresse à compléter"}</p><div className="location-stats"><span><small>Occupation</small><strong>{summary?.occupancyPercent || 0} %</strong></span><span><small>Décisions</small><strong>{summary?.openDecisions || 0}</strong></span><span><small>Capacité</small><strong>{restaurant.capacity}</strong></span></div><footer><span>{restaurant.isDemo ? "Données de démonstration" : "Données réelles"}</span><Link href="/today" onClick={() => onOpen(restaurant.id)}>Ouvrir <ArrowUpRight size={14} /></Link></footer></article>; })}</div><section className="panel local-panel"><div><ShieldCheck size={21} /><span><strong>Installation locale disponible</strong><p>Cette console et son API peuvent fonctionner sur le réseau de l'établissement. La synchronisation vers le cloud reste désactivable.</p></span></div><span className="node-pill">LOCAL-FIRST · CONFIGURABLE</span></section></div>;
}

function CopilotView({ workspace, activeRestaurantId, mutate, refresh, readOnly }: { workspace: Workspace; activeRestaurantId: string | null; mutate: Mutation; refresh: () => Promise<void>; readOnly: boolean }) {
  const contextLabel = activeRestaurantId ? workspace.restaurants[0]?.name || "Établissement sélectionné" : "Vue groupe";
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; evidence?: Array<{ label: string; value: string }>; action?: { id: string; title: string; rationale: string; risk: string; status: string } }>>([{ role: "assistant", text: activeRestaurantId ? `J’analyse uniquement ${contextLabel}. Le service est chargé à ${workspace.summary.occupancyPercent} %. Je peux expliquer un écart, repérer un risque ou préparer une action — elle restera bloquée jusqu'à votre validation.` : `J’analyse la vue groupe, soit ${workspace.restaurants.length} établissements. Je peux comparer les signaux ; sélectionnez une adresse avant de préparer une action.` }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = ["Pourquoi le service est-il sous tension ?", "Que dois-je traiter avant 18 h ?", "Surveille le stock de saumon", "Ouvre un créneau supplémentaire"];
  const send = async (text = input) => {
    if (!text.trim() || busy) return;
    setMessages((current) => [...current, { role: "user", text }]); setInput(""); setBusy(true);
    if (readOnly) {
      setMessages((current) => [...current, { role: "assistant", text: "La version publique montre le contexte et les garde-fous sans exécuter d’analyse ni d’action. Un espace invité active le Copilot sur les données isolées du restaurant." }]);
      setBusy(false);
      return;
    }
    try {
      const reply = await api<{ answer: string; evidence: Array<{ label: string; value: string }>; proposedAction: null | { id: string; title: string; rationale: string; risk: string; status: string } }>("/v1/copilot/messages", { method: "POST", body: JSON.stringify({ message: text, ...(activeRestaurantId ? { restaurantId: activeRestaurantId } : {}) }) });
      setMessages((current) => [...current, { role: "assistant", text: reply.answer, evidence: reply.evidence, ...(reply.proposedAction ? { action: reply.proposedAction } : {}) }]);
      await refresh();
    } catch (caught) { setMessages((current) => [...current, { role: "assistant", text: caught instanceof Error ? caught.message : "Je n'ai pas pu analyser cette demande." }]); }
    finally { setBusy(false); }
  };
  const decide = async (messageIndex: number, actionId: string, approved: boolean) => {
    await mutate(`/v1/copilot/actions/${actionId}/decision`, "POST", { approved }, approved ? "Action validée. Le worker la traite de façon idempotente." : "Action refusée.");
    setMessages((current) => current.map((message, index) => index === messageIndex && message.action ? { ...message, action: { ...message.action, status: approved ? "approved" : "rejected" } } : message));
  };
  return <div className="copilot-layout"><section className="copilot-thread"><div className="copilot-context"><Sparkles size={15} /><span>{contextLabel} · contexte vérifié</span><small>{workspace.summary.openDecisions} décisions · {workspace.summary.inventoryAlerts} alerte stock</small></div><div className="messages">{messages.map((message, index) => <article key={index} className={`message ${message.role}`}><div className="message-avatar">{message.role === "assistant" ? <Bot size={17} /> : <span>Vous</span>}</div><div className="message-body"><p>{message.text}</p>{message.evidence && <div className="evidence-grid">{message.evidence.map((item) => <span key={item.label}><small>{item.label}</small><strong>{item.value}</strong></span>)}</div>}{message.action && <div className={`action-proposal ${message.action.status}`}><header><span><ShieldCheck size={15} /> Action proposée</span><RiskBadge risk={message.action.risk} /></header><h3>{message.action.title}</h3><p>{message.action.rationale}</p>{message.action.status === "proposed" ? <div><button onClick={() => void decide(index, message.action!.id, false)}><X size={14} /> Refuser</button><button className="approve" onClick={() => void decide(index, message.action!.id, true)}><Check size={14} /> Valider l'action</button></div> : <strong className="decision-result">{message.action.status === "approved" ? "✓ Validation enregistrée" : "Action refusée"}</strong>}</div>}</div></article>)}{busy && <article className="message assistant"><div className="message-avatar"><Bot size={17} /></div><div className="thinking"><i /><i /><i /></div></article>}</div><div className="copilot-composer"><div className="suggestion-chips">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => void send(suggestion)}>{suggestion}</button>)}</div><div className="composer-box"><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Demandez ce qui se passe, pourquoi, ou préparez une action…" rows={2} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><button disabled={busy || !input.trim()} onClick={() => void send()} aria-label="Envoyer"><Send size={17} /></button></div><p><ShieldCheck size={12} /> TableNow cite ses signaux et demande une validation avant toute action sensible.</p></div></section><aside className="copilot-aside"><PanelTitle eyebrow="Garde-fous actifs" title="Contrôle humain" /><ul><li><CheckCircle2 size={15} /><span><strong>Lecture libre</strong>Les analyses n'agissent jamais seules.</span></li><li><CheckCircle2 size={15} /><span><strong>Validation par rôle</strong>Le risque détermine qui peut approuver.</span></li><li><CheckCircle2 size={15} /><span><strong>Journal immuable</strong>Proposition, accord et résultat sont tracés.</span></li><li><CheckCircle2 size={15} /><span><strong>Budget quotidien</strong>Les modèles externes ne peuvent pas dériver.</span></li></ul><div className="model-state"><span><i /> Modèle actif</span><strong>TableNow local-first</strong><small>Bascule fournisseur disponible</small></div></aside></div>;
}

type LocationMode = "tablenow" | "software" | "calendar" | "paper" | "hybrid";
type LocationProvider = "zenchef" | "sevenrooms" | "thefork" | "google_calendar" | "outlook_calendar" | "other";

const locationProviders: Array<{ key: LocationProvider; label: string; kind: "software" | "calendar" | "both" }> = [
  { key: "zenchef", label: "Zenchef", kind: "software" },
  { key: "sevenrooms", label: "SevenRooms", kind: "software" },
  { key: "thefork", label: "TheFork Manager", kind: "software" },
  { key: "google_calendar", label: "Google Calendar", kind: "calendar" },
  { key: "outlook_calendar", label: "Outlook Calendar", kind: "calendar" },
  { key: "other", label: "Autre outil", kind: "both" },
];

function NewRestaurantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (restaurantId: string) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", address: "", phone: "", timezone: "Europe/Paris", capacity: 60, isDemo: true, reservationMode: "tablenow" as LocationMode, otherProvider: "", keepPaperWorkflow: false });
  const [selectedProviders, setSelectedProviders] = useState<LocationProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = locationProviderOptions(form.reservationMode);
  const changeMode = (reservationMode: LocationMode) => {
    const nextOptions = locationProviderOptions(reservationMode);
    setForm((current) => ({ ...current, reservationMode, keepPaperWorkflow: reservationMode === "paper" || reservationMode === "hybrid" }));
    setSelectedProviders((current) => current.filter((provider) => nextOptions.some((option) => option.key === provider)));
    setError("");
  };
  const toggleProvider = (provider: LocationProvider) => setSelectedProviders((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (["software", "calendar", "hybrid"].includes(form.reservationMode) && !selectedProviders.length) {
      setError("Indiquez au moins un outil actuellement utilisé.");
      return;
    }
    if (selectedProviders.includes("other") && form.otherProvider.trim().length < 2) {
      setError("Indiquez le nom de l’autre outil.");
      return;
    }
    setBusy(true); setError("");
    try {
      const restaurant = await api<{ id: string }>("/v1/restaurants", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          address: form.address,
          phone: form.phone,
          timezone: form.timezone,
          capacity: Number(form.capacity),
          isDemo: form.isDemo,
          operatingSetup: {
            reservationMode: form.reservationMode,
            providers: selectedProviders,
            ...(form.otherProvider ? { otherProvider: form.otherProvider } : {}),
            keepPaperWorkflow: form.reservationMode === "paper" || form.keepPaperWorkflow,
          },
        }),
      });
      await onCreated(restaurant.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer l’établissement.");
    } finally { setBusy(false); }
  };
  return <ModalFrame title="Ajouter un établissement" eyebrow="Nouveau périmètre isolé" onClose={onClose}><form onSubmit={submit}><div className="form-grid two"><label><span>Nom de l’établissement</span><input autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Rivage — Lyon" /></label><label><span>Capacité maximale</span><input required type="number" min="1" max="10000" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label></div><label><span>Adresse</span><input required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="12 rue de la République, Lyon" autoComplete="street-address" /></label><div className="form-grid two"><label><span>Téléphone</span><input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+33…" /></label><label><span>Fuseau horaire</span><select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}><option value="Europe/Paris">Paris / Bruxelles</option><option value="Europe/London">Londres</option><option value="Europe/Madrid">Madrid</option><option value="America/New_York">New York</option><option value="America/Montreal">Montréal</option><option value="Asia/Dubai">Dubaï</option></select></label></div><label><span>Gestion actuelle des réservations</span><select value={form.reservationMode} onChange={(event) => changeMode(event.target.value as LocationMode)}><option value="tablenow">Aucun outil — commencer avec TableNow</option><option value="software">Logiciel de réservation</option><option value="calendar">Calendrier</option><option value="paper">Papier ou cahier</option><option value="hybrid">Plusieurs méthodes combinées</option></select></label>{options.length > 0 && <div className="provider-section location-provider-section"><span className="field-label">Outils réellement utilisés</span><div className="provider-grid">{options.map((provider) => <button type="button" key={provider.key} className={selectedProviders.includes(provider.key) ? "selected" : ""} aria-pressed={selectedProviders.includes(provider.key)} onClick={() => toggleProvider(provider.key)}><i>{selectedProviders.includes(provider.key) && <Check size={12} />}</i>{provider.label}</button>)}</div>{selectedProviders.includes("other") && <label><span>Nom de l’autre outil</span><input required value={form.otherProvider} onChange={(event) => setForm({ ...form, otherProvider: event.target.value })} placeholder="Nom du logiciel ou de la méthode" /></label>}</div>}{form.reservationMode === "hybrid" && <label className="paper-choice"><input type="checkbox" checked={form.keepPaperWorkflow} onChange={(event) => setForm({ ...form, keepPaperWorkflow: event.target.checked })} /><span><Building2 size={18} /><span><strong>Conserver le parcours papier</strong><small>Le personnel pourra continuer à saisir depuis un cahier pendant la transition.</small></span></span></label>}<label className="paper-choice demo-choice"><input type="checkbox" checked={form.isDemo} onChange={(event) => setForm({ ...form, isDemo: event.target.checked })} /><span><Sparkles size={18} /><span><strong>Préparer des données de démonstration</strong><small>{form.isDemo ? "Le nouvel espace sera immédiatement testable avec des données fictives clairement identifiées." : "Le cockpit commencera vide, prêt à recevoir les données réelles de cette adresse."}</small></span></span></label>{error && <p className="form-error" role="alert">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? "Création…" : "Créer l’établissement"}<ArrowRight size={15} /></button></footer></form></ModalFrame>;
}

function locationProviderOptions(mode: LocationMode) {
  if (mode === "software") return locationProviders.filter((provider) => provider.kind !== "calendar");
  if (mode === "calendar") return locationProviders.filter((provider) => provider.kind !== "software");
  if (mode === "hybrid") return locationProviders;
  return [];
}

function ManualEntryModal({ kind, restaurants, activeRestaurantId, onClose, onCreated }: { kind: "task" | "shift" | "inventory"; restaurants: Workspace["restaurants"]; activeRestaurantId: string | null; onClose: () => void; onCreated: () => Promise<void> }) {
  const initialRestaurantId = activeRestaurantId || restaurants[0]?.id || "";
  const shiftStart = nextServiceLocal(restaurants.find((restaurant) => restaurant.id === initialRestaurantId)?.timezone || "Europe/Paris");
  const [restaurantId, setRestaurantId] = useState(initialRestaurantId);
  const [task, setTask] = useState({ title: "", category: "service", assigneeName: "", dueAt: shiftStart });
  const [shift, setShift] = useState({ teamMemberName: "", roleTitle: "", startsAt: shiftStart, endsAt: addLocalHours(shiftStart, 6), status: "planned" });
  const [inventory, setInventory] = useState({ name: "", unit: "unités", quantity: 0, reorderThreshold: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const title = kind === "task" ? "Ajouter une tâche" : kind === "shift" ? "Ajouter un service" : "Ajouter un article de stock";
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const timezone = restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone || "Europe/Paris";
      if (kind === "task") await api("/v1/tasks", { method: "POST", body: JSON.stringify({ restaurantId, title: task.title, category: task.category, ...(task.assigneeName ? { assigneeName: task.assigneeName } : {}), ...(task.dueAt ? { dueAt: restaurantLocalToIso(task.dueAt, timezone) } : {}) }) });
      else if (kind === "shift") await api("/v1/team/shifts", { method: "POST", body: JSON.stringify({ restaurantId, ...shift, startsAt: restaurantLocalToIso(shift.startsAt, timezone), endsAt: restaurantLocalToIso(shift.endsAt, timezone) }) });
      else await api("/v1/inventory", { method: "POST", body: JSON.stringify({ restaurantId, ...inventory, quantity: Number(inventory.quantity), reorderThreshold: Number(inventory.reorderThreshold) }) });
      await onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’enregistrer cette saisie.");
    } finally { setBusy(false); }
  };
  return <ModalFrame title={title} eyebrow="Saisie manuelle universelle" onClose={onClose}><form onSubmit={submit}><label><span>Établissement</span><select required value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>{kind === "task" && <><label><span>Tâche</span><input autoFocus required value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="Préparer la terrasse" /></label><div className="form-grid two"><label><span>Catégorie</span><select value={task.category} onChange={(event) => setTask({ ...task, category: event.target.value })}><option value="service">Service</option><option value="opening">Ouverture</option><option value="closing">Fermeture</option><option value="supplier">Fournisseur</option><option value="maintenance">Maintenance</option></select></label><label><span>Responsable</span><input value={task.assigneeName} onChange={(event) => setTask({ ...task, assigneeName: event.target.value })} placeholder="Nom ou équipe" /></label></div><label><span>Échéance</span><input type="datetime-local" value={task.dueAt} onChange={(event) => setTask({ ...task, dueAt: event.target.value })} /></label></>}{kind === "shift" && <><div className="form-grid two"><label><span>Personne</span><input autoFocus required value={shift.teamMemberName} onChange={(event) => setShift({ ...shift, teamMemberName: event.target.value })} placeholder="Prénom et nom" /></label><label><span>Rôle</span><input required value={shift.roleTitle} onChange={(event) => setShift({ ...shift, roleTitle: event.target.value })} placeholder="Chef de rang" /></label></div><div className="form-grid two"><label><span>Début</span><input required type="datetime-local" value={shift.startsAt} onChange={(event) => setShift({ ...shift, startsAt: event.target.value })} /></label><label><span>Fin</span><input required type="datetime-local" value={shift.endsAt} onChange={(event) => setShift({ ...shift, endsAt: event.target.value })} /></label></div><label><span>Confirmation</span><select value={shift.status} onChange={(event) => setShift({ ...shift, status: event.target.value })}><option value="planned">À confirmer</option><option value="confirmed">Confirmée</option></select></label></>}{kind === "inventory" && <><div className="form-grid two"><label><span>Article</span><input autoFocus required value={inventory.name} onChange={(event) => setInventory({ ...inventory, name: event.target.value })} placeholder="Saumon frais" /></label><label><span>Unité</span><input required value={inventory.unit} onChange={(event) => setInventory({ ...inventory, unit: event.target.value })} placeholder="kg, bouteilles, unités…" /></label></div><div className="form-grid two"><label><span>Quantité actuelle</span><input required type="number" min="0" step="0.001" value={inventory.quantity} onChange={(event) => setInventory({ ...inventory, quantity: Number(event.target.value) })} /></label><label><span>Seuil d’alerte</span><input required type="number" min="0" step="0.001" value={inventory.reorderThreshold} onChange={(event) => setInventory({ ...inventory, reorderThreshold: Number(event.target.value) })} /></label></div><p className="modal-note"><ShieldCheck size={14} />Un article portant le même nom sera mis à jour, jamais dupliqué silencieusement.</p></>}{error && <p className="form-error" role="alert">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy || !restaurantId}>{busy ? "Enregistrement…" : "Enregistrer"}<ArrowRight size={15} /></button></footer></form></ModalFrame>;
}

function NewReservationModal({ restaurants, activeRestaurantId, onClose, onCreated }: { restaurants: Workspace["restaurants"]; activeRestaurantId: string | null; onClose: () => void; onCreated: () => Promise<void> }) {
  const initialRestaurantId = activeRestaurantId || restaurants[0]?.id || "";
  const initialTimezone = restaurants.find((restaurant) => restaurant.id === initialRestaurantId)?.timezone || "Europe/Paris";
  const [form, setForm] = useState({ restaurantId: initialRestaurantId, guestName: "", guestEmail: "", guestPhone: "", startsAt: nextServiceLocal(initialTimezone), partySize: 2, notes: "", source: "manual" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { const timezone = restaurants.find((restaurant) => restaurant.id === form.restaurantId)?.timezone || "Europe/Paris"; await api("/v1/reservations", { method: "POST", body: JSON.stringify({ ...form, startsAt: restaurantLocalToIso(form.startsAt, timezone), partySize: Number(form.partySize) }) }); await onCreated(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Impossible d'ajouter la réservation."); } finally { setBusy(false); } };
  return <ModalFrame title="Nouvelle réservation" eyebrow="Ajout manuel" onClose={onClose}><form onSubmit={submit}>{restaurants.length > 1 && <label><span>Établissement</span><select required value={form.restaurantId} onChange={(event) => setForm({ ...form, restaurantId: event.target.value })}>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}<label><span>Nom du client</span><input required value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} autoFocus /></label><div className="form-grid two"><label><span>E-mail</span><input type="email" value={form.guestEmail} onChange={(e) => setForm({ ...form, guestEmail: e.target.value })} /></label><label><span>Téléphone</span><input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} /></label></div><div className="form-grid two"><label><span>Date et heure</span><input required type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label><label><span>Couverts</span><input required type="number" min="1" max="100" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })} /></label></div><label><span>Notes utiles au service</span><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Allergie, anniversaire, préférence…" /></label>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy || !form.restaurantId}>{busy ? "Ajout…" : "Ajouter au service"}<ArrowRight size={15} /></button></footer></form></ModalFrame>;
}

type Mutation = (path: string, method: string, body: unknown, success: string) => Promise<void>;

function ReservationAction({ reservation, mutate }: { reservation: Workspace["reservations"][number]; mutate: Mutation }) {
  const update = (status: string, message: string) => mutate(`/v1/reservations/${reservation.id}`, "PATCH", { status }, message);
  if (reservation.status === "pending") {
    return <div className="reservation-actions"><button className="row-action" onClick={() => void update("confirmed", "Réservation confirmée.")}>Confirmer</button><button className="icon-button tiny danger" aria-label={`Annuler la réservation de ${reservation.guestName}`} title="Annuler" onClick={() => void update("cancelled", "Réservation annulée.")}><X size={14} /></button></div>;
  }
  if (reservation.status === "confirmed") {
    return <div className="reservation-actions"><button className="row-action" onClick={() => void update("seated", `${reservation.guestName} est installé.`)}>Installer</button><button className="icon-button tiny danger" aria-label={`Annuler la réservation de ${reservation.guestName}`} title="Annuler" onClick={() => void update("cancelled", "Réservation annulée.")}><X size={14} /></button></div>;
  }
  if (reservation.status === "seated") {
    return <button className="row-action" onClick={() => void update("completed", "Table libérée et réservation terminée.")}>Terminer</button>;
  }
  return <span className="completed-label"><CheckCircle2 size={15} /> Clôturée</span>;
}

function Kpi({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone?: string }) { return <article className={`kpi-card ${tone || ""}`}><header><span>{icon}</span><small>{label}</small></header><strong>{value}</strong><p>{detail}</p></article>; }
function PanelTitle({ eyebrow, title, count }: { eyebrow: string; title: string; count?: number }) { return <header className="panel-title"><div><span>{eyebrow}</span><h2>{title}</h2></div>{count !== undefined && <i>{count}</i>}</header>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>; }
function StatusBadge({ status }: { status: string }) { const label = ({ open: "Ouverte", handled: "Gérée", escalated: "Escaladée", pending: "À confirmer", confirmed: "Confirmée", seated: "À table", completed: "Terminée", cancelled: "Annulée", no_show: "No-show", planned: "Planifiée", absent: "Absente", approved: "Validée", rejected: "Refusée", in_progress: "En cours", done: "Terminée" } as Record<string, string>)[status] || status; return <span className={`status-badge status-${status}`}>{label}</span>; }
function SourceBadge({ source }: { source: string }) { return <span className="source-badge">{source === "phone" ? <Phone size={12} /> : source === "copilot" ? <Sparkles size={12} /> : <UserRoundCheck size={12} />}{({ phone: "Téléphone IA", web: "Web", manual: "Manuel", copilot: "Copilot" } as Record<string, string>)[source] || source}</span>; }
function RiskBadge({ risk }: { risk: string }) { return <span className={`risk-badge risk-${risk}`}>{({ low: "Faible", medium: "Modéré", high: "Élevé", critical: "Critique" } as Record<string, string>)[risk] || risk}</span>; }
function euro(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0); }
function relativeTime(value: string) { const diff = new Date(value).getTime() - Date.now(); const minutes = Math.round(diff / 60000); if (Math.abs(minutes) < 60) return minutes >= 0 ? `dans ${minutes} min` : `il y a ${Math.abs(minutes)} min`; const hours = Math.round(minutes / 60); return hours >= 0 ? `dans ${hours} h` : `il y a ${Math.abs(hours)} h`; }
function initials(value: string) { return value.split(" ").slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""); }
function shiftCoverageHours(shifts: Workspace["shifts"]) { if (!shifts.length) return 0; const starts = shifts.map((shift) => new Date(shift.startsAt).getTime()); const ends = shifts.map((shift) => new Date(shift.endsAt).getTime()); return Math.max(0, Math.round((Math.max(...ends) - Math.min(...starts)) / 3_600_000)); }
function restaurantTimezone(workspace: Workspace, restaurantId: string) { return workspace.restaurants.find((restaurant) => restaurant.id === restaurantId)?.timezone || "Europe/Paris"; }
function restaurantName(workspace: Workspace, restaurantId: string) { return workspace.restaurants.find((restaurant) => restaurant.id === restaurantId)?.name || "Établissement inconnu"; }
