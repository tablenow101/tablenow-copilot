"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Clock3,
  ExternalLink,
  FileCheck2,
  Link2,
  LoaderCircle,
  MonitorCog,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { api, apiHref } from "@/lib/api";
import type { ComputerUseOverview, Role, Workspace } from "@/lib/types";
import { ModalFrame } from "./ModalFrame";

const methodLabels: Record<string, string> = {
  native: "TableNow natif",
  api: "API directe",
  mcp: "MCP",
  calendar: "Calendrier",
  browser: "Pilotage d’écran",
  desktop: "Application locale",
  manual: "Validation humaine",
};

const capabilityLabels: Record<string, string> = {
  "reservation.read": "Lire les réservations",
  "reservation.create": "Créer une réservation",
  "reservation.update": "Modifier une réservation",
  "reservation.cancel": "Annuler une réservation",
  "connection.health": "Vérifier une connexion",
};

const providerLabels: Record<string, string> = {
  tablenow: "TableNow",
  zenchef: "Zenchef",
  sevenrooms: "SevenRooms",
  thefork: "TheFork Manager",
  generic: "Autre interface",
  "tablenow-simulator": "Interface universelle de validation",
  google_calendar: "Google Calendar",
  outlook_calendar: "Outlook Calendar",
  paper: "Papier / cahier",
};

export function SystemsCenter({ restaurants, role, activeRestaurantId }: { restaurants: Workspace["restaurants"]; role: Role; activeRestaurantId: string | null }) {
  const [overview, setOverview] = useState<ComputerUseOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [workflow, setWorkflow] = useState<ComputerUseOverview["workflows"][number] | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const canConfigure = ["platform_admin", "owner", "group_admin"].includes(role);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setOverview(await api<ComputerUseOverview>("/v1/computer-use"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de charger les systèmes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!overview?.runs.some((run) => ["queued", "claimed", "running"].includes(run.status))) return;
    const timer = window.setInterval(() => void refresh(true), 3_000);
    return () => window.clearInterval(timer);
  }, [overview?.runs, refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3_500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setSelectedRunId(null);
    setWorkflow(null);
    setConnectionOpen(false);
  }, [activeRestaurantId]);

  const act = async (key: string, path: string, body: unknown, success: string, method = "POST") => {
    setBusy(key);
    try {
      await api(path, { method, body: JSON.stringify(body) });
      await refresh(true);
      setToast(success);
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "L’action n’a pas abouti.");
    } finally {
      setBusy("");
    }
  };

  if (loading && !overview) return <SystemsLoading />;
  if (!overview) return <div className="inline-error"><AlertTriangle size={16} />{error}<button onClick={() => void refresh()}>Réessayer</button></div>;

  const displayedSystems = activeRestaurantId ? overview.systems.filter((system) => system.restaurantId === activeRestaurantId) : overview.systems;
  const displayedRoutes = activeRestaurantId ? overview.routes.filter((route) => route.restaurantId === activeRestaurantId) : overview.routes;
  const displayedConnections = activeRestaurantId ? overview.connections.filter((connection) => connection.restaurantId === activeRestaurantId) : overview.connections;
  const displayedConnectionIds = new Set(displayedConnections.map((connection) => connection.id));
  const displayedWorkflows = overview.workflows.filter((item) => displayedConnectionIds.has(item.connectionId));
  const displayedRuns = overview.runs.filter((run) => displayedConnectionIds.has(run.connectionId));
  const activeNode = overview.nodes.find((node) => node.healthStatus === "healthy");
  const selectedRun = displayedRuns.find((run) => run.id === selectedRunId) || displayedRuns[0] || null;
  const selectedEvents = selectedRun ? overview.events.filter((event) => event.runId === selectedRun.id) : [];
  const activeRestaurantName = restaurants.find((restaurant) => restaurant.id === activeRestaurantId)?.name;

  return <div className="view-stack systems-view">
    {error && <div className="inline-error"><AlertTriangle size={16} />{error}<button onClick={() => void refresh()}>Réessayer</button></div>}
    <section className="systems-hero">
      <div><span className="eyebrow"><Network size={13} /> Orchestration universelle · {activeRestaurantName || "Vue groupe"}</span><h2>TableNow agit avec ce que le restaurant utilise déjà.</h2><p>Logiciel métier, calendrier, cahier papier ou TableNow seul : chaque action suit le chemin le plus fiable et garde un secours compréhensible.</p></div>
      <div className={`runner-health ${activeNode ? "healthy" : "offline"}`}><span><i />{activeNode ? "Nœud local en ligne" : "Nœud local hors ligne"}</span><small>{activeNode ? `Vu ${relativeTime(activeNode.lastHeartbeatAt)}` : "Les actions d’écran restent en attente"}</small></div>
    </section>

    <section className="method-strip" aria-label="Ordre de préférence des méthodes">
      {["native", "api", "mcp", "calendar", "browser", "manual"].map((method, index) => <div key={method}><i>{index + 1}</i><span><strong>{methodLabels[method]}</strong><small>{methodDetail(method)}</small></span></div>)}
    </section>

    <div className="systems-grid">
      <section className="panel route-panel">
        <header className="systems-panel-head"><div><span>Chemins actifs</span><h3>Qui fait quoi ?</h3></div><button className="icon-button" onClick={() => void refresh()} aria-label="Actualiser les chemins" title="Actualiser"><RefreshCw size={16} /></button></header>
        <div className="route-list">{displayedRoutes.map((route) => <article key={route.id}><div className="route-capability"><span>{capabilityLabels[route.capability] || route.capability}</span><small>Risque maximum : {riskLabel(route.maximumRisk)}</small></div><div className="route-path"><span><strong>{route.primarySystemName}</strong><small>{methodLabels[route.primaryAccessMethod] || route.primaryAccessMethod}</small></span>{route.fallbackSystemName && <><ArrowRight size={14} /><span className="fallback"><strong>{route.fallbackSystemName}</strong><small>Secours · {methodLabels[route.fallbackAccessMethod || ""] || route.fallbackAccessMethod}</small></span></>}</div><StatusPill status={route.executionMode} /></article>)}{!displayedRoutes.length && <EmptySystems title="Aucun chemin configuré" text="Connectez un outil, un calendrier ou choisissez le fonctionnement manuel de cet établissement." />}</div>
      </section>

      <section className="panel systems-panel">
        <header className="systems-panel-head"><div><span>Sources de vérité</span><h3>Vos outils actuels</h3></div>{canConfigure && <button className="secondary-button compact" onClick={() => setConnectionOpen(true)}><Plus size={15} /> Connecter</button>}</header>
        <div className="system-list">{displayedSystems.map((system) => <article key={system.id}><span className={`system-icon method-${system.accessMethod}`}>{system.accessMethod === "calendar" ? <CalendarDays size={17} /> : system.accessMethod === "manual" ? <Smartphone size={17} /> : <MonitorCog size={17} />}</span><div><strong>{system.displayName}</strong><small>{providerLabels[system.provider] || system.provider} · {methodLabels[system.accessMethod] || system.accessMethod}</small></div>{system.isSourceOfTruth && <span className="truth-badge">Référence</span>}<StatusPill status={system.status} /></article>)}{!displayedSystems.length && <EmptySystems title="Aucun outil déclaré" text="TableNow peut aussi commencer seul, avec un calendrier ou avec le cahier papier existant." />}</div>
      </section>
    </div>

    <section className="panel connections-panel">
      <header className="systems-panel-head"><div><span>Connexions pilotables</span><h3>Tests et protocoles</h3></div><span className="quiet-label">{displayedConnections.length} connexion{displayedConnections.length > 1 ? "s" : ""}</span></header>
      <div className="connection-list">{displayedConnections.map((connection) => {
        const workflows = displayedWorkflows.filter((item) => item.connectionId === connection.id);
        return <article className="connection-card" key={connection.id}><header><div><span className="connection-logo"><Link2 size={18} /></span><span><strong>{connection.displayName}</strong><small>{providerLabels[connection.provider] || connection.provider} · {methodLabels[connection.surface] || connection.surface}</small></span></div><StatusPill status={connection.status} /></header><p>{connection.healthMessage || "La connexion doit être testée avant une action réelle."}</p><div className="workflow-list">{workflows.map((item) => <button key={item.id} onClick={() => setWorkflow(item)} disabled={connection.status !== "ready" && item.key !== "connection.health_check"}><span><strong>{item.name}</strong><small>{item.description}</small></span><span><RiskPill risk={item.risk} /><CirclePlay size={17} /></span></button>)}</div><footer><button onClick={() => void act(`test-${connection.id}`, `/v1/computer-use/connections/${connection.id}/test`, {}, "Test ajouté à la file d’exécution.")} disabled={busy === `test-${connection.id}`}><Activity size={14} />{busy === `test-${connection.id}` ? "Ajout…" : "Tester"}</button>{canConfigure && <button onClick={() => void act(`pause-${connection.id}`, `/v1/computer-use/connections/${connection.id}`, connection.mode === "paused" ? { mode: "assist", status: "ready" } : { mode: "paused", status: "paused" }, connection.mode === "paused" ? "Connexion reprise." : "Connexion mise en pause.", "PATCH")}><CirclePause size={14} />{connection.mode === "paused" ? "Reprendre" : "Mettre en pause"}</button>}<span>Domaines autorisés : {connection.allowedHosts.join(", ")}</span></footer></article>;
      })}{!displayedConnections.length && <EmptySystems title="Aucune connexion d’écran" text="Ce n’est pas un blocage : TableNow reste utilisable en natif, via calendrier ou en mode manuel." />}</div>
    </section>

    <div className="execution-grid">
      <section className="panel run-panel"><header className="systems-panel-head"><div><span>Exécutions</span><h3>À valider et en cours</h3></div></header><div className="run-list">{displayedRuns.length ? displayedRuns.map((run) => <button key={run.id} className={selectedRun?.id === run.id ? "active" : ""} onClick={() => setSelectedRunId(run.id)}><span className={`run-state status-${run.status}`}>{run.status === "running" ? <LoaderCircle className="spinning" size={15} /> : run.status === "succeeded" ? <CheckCircle2 size={15} /> : run.status === "failed" || run.status === "blocked" ? <XCircle size={15} /> : <Clock3 size={15} />}</span><span><strong>{run.workflowName}</strong><small>{run.connectionName} · {relativeTime(run.createdAt)}</small></span><StatusPill status={run.cancellationRequested ? "cancelling" : run.status} /></button>) : <EmptyRuns />}</div></section>

      <section className="panel run-detail">{selectedRun ? <><header className="systems-panel-head"><div><span>Détail vérifiable</span><h3>{selectedRun.workflowName}</h3></div><StatusPill status={selectedRun.cancellationRequested ? "cancelling" : selectedRun.status} /></header><div className="run-objective"><span>Objectif autorisé</span><p>{selectedRun.objective}</p>{selectedRun.summary && <><span>Résultat</span><p>{selectedRun.summary}</p></>}</div><div className="run-actions">{selectedRun.status === "awaiting_approval" && canApprove(role, selectedRun.risk) && <><button onClick={() => void act(`reject-${selectedRun.id}`, `/v1/computer-use/runs/${selectedRun.id}/decision`, { approved: false, note: "Refusé depuis le centre de contrôle" }, "Exécution refusée.")}><X size={14} /> Refuser</button><button className="approve" onClick={() => void act(`approve-${selectedRun.id}`, `/v1/computer-use/runs/${selectedRun.id}/decision`, { approved: true, note: "Validé depuis le centre de contrôle" }, "Exécution validée et mise en file.")}><Check size={14} /> Valider précisément cette action</button></>}{["awaiting_approval", "queued", "claimed", "running"].includes(selectedRun.status) && !selectedRun.cancellationRequested && <button onClick={() => void act(`cancel-${selectedRun.id}`, `/v1/computer-use/runs/${selectedRun.id}/cancel`, {}, "Arrêt demandé au nœud local.")}><CirclePause size={14} /> Arrêter</button>}{["failed", "blocked"].includes(selectedRun.status) && selectedRun.attempts < selectedRun.maxAttempts && <button onClick={() => void act(`retry-${selectedRun.id}`, `/v1/computer-use/runs/${selectedRun.id}/retry`, {}, "Nouvelle tentative mise en file.")}><RotateCcw size={14} /> Réessayer</button>}</div><div className="timeline">{selectedEvents.map((event) => <div key={event.id}><i className={`event-${event.status}`} /><span><strong>{event.message}</strong><small>{relativeTime(event.occurredAt)}</small></span>{event.hasEvidence && <a href={apiHref(`/v1/computer-use/evidence/${event.id}`)} target="_blank" rel="noreferrer">Preuve <ExternalLink size={12} /></a>}</div>)}{!selectedEvents.length && <p>Aucun événement enregistré pour le moment.</p>}</div></> : <div className="empty-run-detail"><FileCheck2 size={27} /><strong>Aucune exécution</strong><p>Lancez un protocole pour suivre chaque étape et sa preuve.</p></div>}</section>
    </div>

    <section className="safety-band"><ShieldCheck size={20} /><div><strong>Le téléphone pilote, le nœud exécute.</strong><p>Sur mobile, vous consultez et validez ; l’action reste isolée sur le serveur local ou cloud, même si vous fermez l’écran.</p></div><Bot size={20} /></section>

    {connectionOpen && <ConnectionModal restaurants={restaurants} activeRestaurantId={activeRestaurantId} onClose={() => setConnectionOpen(false)} onCreated={async () => { setConnectionOpen(false); await refresh(true); setToast("Connexion créée ; lancez maintenant son test."); }} />}
    {workflow && <RunModal workflow={workflow} onClose={() => setWorkflow(null)} onCreated={async () => { setWorkflow(null); await refresh(true); setToast("Action préparée dans le centre de contrôle."); }} />}
    {toast && <div className="toast" role="status"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}

function ConnectionModal({ restaurants, activeRestaurantId, onClose, onCreated }: { restaurants: Workspace["restaurants"]; activeRestaurantId: string | null; onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ restaurantId: activeRestaurantId || restaurants[0]?.id || "", provider: "generic", displayName: "", baseUrl: "", mode: "assist" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const host = useMemo(() => { try { return new URL(form.baseUrl).hostname; } catch { return ""; } }, [form.baseUrl]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await api("/v1/computer-use/connections", { method: "POST", body: JSON.stringify({ ...form, surface: "browser", allowedHosts: [host] }) });
      await onCreated();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Connexion impossible."); }
    finally { setBusy(false); }
  };
  return <ModalFrame title="Connecter une interface" eyebrow="Nouvelle source" onClose={onClose}><form onSubmit={submit}><label><span>Établissement</span><select value={form.restaurantId} onChange={(event) => setForm({ ...form, restaurantId: event.target.value })}>{restaurants.map((restaurant) => <option value={restaurant.id} key={restaurant.id}>{restaurant.name}</option>)}</select></label><div className="form-grid two"><label><span>Outil actuel</span><select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}><option value="generic">Autre interface web</option><option value="zenchef">Zenchef</option><option value="sevenrooms">SevenRooms</option><option value="thefork">TheFork Manager</option></select></label><label><span>Nom visible</span><input autoFocus required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Réservations principales" /></label></div><label><span>Adresse de connexion</span><input required type="url" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://…" /></label><label><span>Niveau d’autonomie</span><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="observe">Observer uniquement</option><option value="assist">Assister avec validation</option><option value="autonomous">Automatiser les actions à faible risque</option></select></label><p className="modal-note"><ShieldCheck size={14} />Seul le domaine affiché sera accessible ; les identifiants resteront sur le nœud local.</p>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy || !host}>{busy ? "Connexion…" : "Créer la connexion"}<ArrowRight size={15} /></button></footer></form></ModalFrame>;
}

function RunModal({ workflow, onClose, onCreated }: { workflow: ComputerUseOverview["workflows"][number]; onClose: () => void; onCreated: () => Promise<void> }) {
  const creatingReservation = workflow.key === "reservation.create";
  const cancellingReservation = workflow.key === "reservation.cancel";
  const [form, setForm] = useState({ guestName: "", guestPhone: "", partySize: 2, time: "19:30" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const objective = creatingReservation ? `Créer la réservation de ${form.guestName} pour ${form.partySize} personnes à ${form.time}.` : cancellingReservation ? `Annuler uniquement la réservation de ${form.guestName}.` : workflow.description;
    const inputs = creatingReservation ? form : cancellingReservation ? { guestName: form.guestName } : {};
    try {
      await api("/v1/computer-use/runs", { method: "POST", body: JSON.stringify({ workflowId: workflow.id, objective, inputs, idempotencyKey: `${workflow.key}-${Date.now()}` }) });
      await onCreated();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Action impossible."); }
    finally { setBusy(false); }
  };
  return <ModalFrame title={workflow.name} eyebrow="Action contrôlée" onClose={onClose}><form onSubmit={submit}>{(creatingReservation || cancellingReservation) && <label><span>Nom du client</span><input autoFocus required value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} /></label>}{creatingReservation && <><div className="form-grid two"><label><span>Téléphone</span><input value={form.guestPhone} onChange={(event) => setForm({ ...form, guestPhone: event.target.value })} /></label><label><span>Couverts</span><input type="number" min="1" max="30" value={form.partySize} onChange={(event) => setForm({ ...form, partySize: Number(event.target.value) })} /></label></div><label><span>Heure</span><input type="time" required value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></label></>}<div className="approval-summary"><RiskPill risk={workflow.risk} /><span><strong>{workflow.approvalRequired ? "Validation humaine requise" : "Exécution réversible"}</strong><small>{workflow.description}</small></span></div>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? "Préparation…" : "Préparer l’action"}<ArrowRight size={15} /></button></footer></form></ModalFrame>;
}

function SystemsLoading() { return <div className="systems-loading"><LoaderCircle className="spinning" size={24} /><strong>Lecture des systèmes</strong><small>TableNow vérifie les chemins disponibles.</small></div>; }
function EmptyRuns() { return <div className="empty-runs"><FileCheck2 size={22} /><span><strong>Aucune exécution</strong><small>Les actions apparaîtront ici.</small></span></div>; }
function EmptySystems({ title, text }: { title: string; text: string }) { return <div className="empty-systems"><Network size={20} /><span><strong>{title}</strong><small>{text}</small></span></div>; }
function StatusPill({ status }: { status: string }) { return <span className={`status-badge status-${status}`}>{statusLabel(status)}</span>; }
function RiskPill({ risk }: { risk: string }) { return <span className={`risk-badge risk-${risk}`}>{riskLabel(risk)}</span>; }
function canApprove(role: Role, risk: string) { return risk === "high" || risk === "critical" ? ["platform_admin", "owner", "group_admin"].includes(role) : ["platform_admin", "owner", "group_admin", "manager"].includes(role); }
function methodDetail(method: string) { return ({ native: "Le plus robuste", api: "Échange structuré", mcp: "Outils standardisés", calendar: "Import et synchronisation", browser: "Pont visuel contrôlé", manual: "Toujours disponible" } as Record<string, string>)[method] || method; }
function riskLabel(risk: string) { return ({ low: "Faible", medium: "Modéré", high: "Élevé", critical: "Interdit" } as Record<string, string>)[risk] || risk; }
function statusLabel(status: string) { return ({ setup: "À configurer", ready: "Prêt", limited: "Limité", degraded: "Dégradé", offline: "Hors ligne", paused: "En pause", automatic: "Automatique", approval: "Validation", manual: "Manuel", awaiting_approval: "À valider", queued: "En attente", claimed: "Pris en charge", running: "En cours", succeeded: "Réussi", failed: "Échec", blocked: "Bloqué", cancelled: "Annulé", cancelling: "Arrêt demandé" } as Record<string, string>)[status] || status; }
function relativeTime(value: string | null) { if (!value) return "jamais"; const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000); if (Math.abs(minutes) < 1) return "à l’instant"; if (Math.abs(minutes) < 60) return minutes > 0 ? `dans ${minutes} min` : `il y a ${Math.abs(minutes)} min`; const hours = Math.round(minutes / 60); return hours > 0 ? `dans ${hours} h` : `il y a ${Math.abs(hours)} h`; }
