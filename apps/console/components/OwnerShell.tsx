"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Coffee,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  LogOut,
  Mail,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { useDictation } from "@/hooks/useDictation";
import { scopeWorkspace } from "@/lib/workspace";
import {
  addLocalHours,
  formatRestaurantTime,
  nextServiceLocal,
  restaurantLocalToIso,
} from "@/lib/timezone";
import {
  channelLabel,
  dayKey,
  emptyOperating,
  initials,
  statusLabel,
  type OperatingState,
  type ServiceTable,
} from "@/lib/operating";
import type { Workspace } from "@/lib/types";
import { Brand } from "./Brand";
import { OwnerDialog } from "./OwnerDialog";
import { ConversationInput } from "./ConversationInput";

const mainNav = [
  { key: "today", label: "Aujourd’hui", icon: Activity },
  { key: "decisions", label: "Décisions", icon: ListChecks },
  { key: "communications", label: "Communications", icon: MessageSquareText },
  { key: "service", label: "Service & salle", icon: UtensilsCrossed },
  { key: "team", label: "Équipe", icon: Users },
];
const mobileNav = [
  mainNav[0]!,
  mainNav[1]!,
  { key: "profile", label: "Profil", icon: Settings2 },
  { key: "service", label: "Métiers", icon: LayoutGrid },
  mainNav[4]!,
];
type Decision = Workspace["decisions"][number];
type Reservation = Workspace["reservations"][number];
type Modal =
  | { kind: "reservation"; item?: Reservation }
  | {
      kind: "decision";
      item: Decision;
      status: "approved" | "rejected" | "snoozed";
    }
  | { kind: "task" }
  | { kind: "shift"; item?: Workspace["shifts"][number] }
  | { kind: "table"; item?: ServiceTable }
  | {
      kind: "message";
      recipient?: string | undefined;
      subject?: string | undefined;
    }
  | { kind: "send"; id: string; recipient: string; body: string };
const titles: Record<string, [string, string]> = {
  today: [
    "Le service, sous contrôle.",
    "Vos priorités. Les bonnes décisions. Au bon moment.",
  ],
  decisions: [
    "Les décisions qui comptent.",
    "TableNow prépare. Vous gardez la main.",
  ],
  communications: [
    "Chaque échange compte.",
    "Appels, messages et demandes clients, au même endroit.",
  ],
  service: [
    "La salle, en un regard.",
    "Vos tables, vos arrivées, le rythme du service.",
  ],
  team: [
    "La bonne équipe. Au bon endroit.",
    "Postes, horaires et pauses — une organisation lisible.",
  ],
  profile: [
    "Votre TableNow.",
    "Votre établissement, vos préférences et vos connexions.",
  ],
  copilot: [
    "On en parle ?",
    "Votre partenaire pour préparer, comprendre et décider.",
  ],
};

export function OwnerShell({ section }: { section: string }) {
  const active =
    (
      {
        reservations: "service",
        operations: "today",
        performance: "today",
        locations: "profile",
        systems: "profile",
      } as Record<string, string>
    )[section] || section;
  const router = useRouter();
  const {
    session,
    loading,
    error: sessionError,
    refresh: refreshSession,
  } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [operating, setOperating] = useState<OperatingState>(emptyOperating);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState(
    section === "performance"
      ? "after"
      : section === "operations"
        ? "before"
        : "during",
  );
  const [modal, setModal] = useState<Modal | null>(null);
  const draftRequestId = useRef("");
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatInFlight = useRef(false);
  const refreshNumber = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const dictation = useDictation((text) =>
    setMessage((previous) => [previous, text].filter(Boolean).join(" ")),
  );
  const refresh = useCallback(async () => {
    const version = ++refreshNumber.current;
    setRefreshing(true);
    setError("");
    try {
      const [next, state] = await Promise.all([
        api<Workspace>("/v1/workspace"),
        api<OperatingState>("/v1/operating"),
      ]);
      if (version !== refreshNumber.current) return;
      setWorkspace(next);
      setOperating(state);
      setRestaurantId((current) =>
        next.restaurants.some((r) => r.id === current)
          ? current
          : next.restaurants[0]?.id || null,
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401)
        router.replace("/login");
      else
        setError(
          caught instanceof Error
            ? caught.message
            : "Impossible de charger votre établissement.",
        );
    } finally {
      if (version === refreshNumber.current) setRefreshing(false);
    }
  }, [router]);
  useEffect(() => {
    if (session?.tenant.onboardingComplete) void refresh();
    return () => {
      refreshNumber.current += 1;
    };
  }, [session?.tenant.onboardingComplete, refresh]);
  useEffect(() => {
    heading.current?.focus();
  }, [active]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const scoped = scopeWorkspace(workspace, restaurantId);
  const restaurant = scoped?.restaurants[0];
  const tz = restaurant?.timezone || "Europe/Paris";
  const currentDay = dayKey(new Date(), tz);
  const reservations = (scoped?.reservations || []).filter(
    (r) => dayKey(r.startsAt, tz) === currentDay,
  );
  const shifts = (scoped?.shifts || []).filter(
    (s) =>
      dayKey(s.startsAt, tz) === currentDay ||
      (new Date(s.startsAt) <= new Date() && new Date(s.endsAt) >= new Date()),
  );
  const tables = operating.tables.filter(
    (table) => table.restaurantId === restaurantId,
  );
  const outgoing = operating.outgoing.filter(
    (item) => item.restaurantId === restaurantId,
  );
  const open = (scoped?.decisions || []).filter((d) => d.status === "open");
  const [title, subtitle] = titles[active] || titles.today!;

  function openModal(next: Modal) {
    draftRequestId.current = crypto.randomUUID();
    setFormError("");
    setModal(next);
  }
  async function mutate(
    path: string,
    body: unknown,
    success: string,
    method = "PATCH",
  ) {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setBusy(true);
    setFormError("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setModal(null);
      setNotice(success);
      await refresh();
      return true;
    } catch (caught) {
      const text =
        caught instanceof Error
          ? caught.message
          : "L’action n’a pas été enregistrée.";
      setFormError(text);
      if (!modal) setError(text);
      return false;
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || !restaurantId || busy) return;
    const fields = new FormData(event.currentTarget);
    const field = (key: string) => String(fields.get(key) || "").trim();
    try {
      if (modal.kind === "reservation") {
        const body = {
          restaurantId,
          guestName: field("guestName"),
          guestEmail: field("guestEmail"),
          guestPhone: field("guestPhone"),
          startsAt: restaurantLocalToIso(field("startsAt"), tz),
          partySize: Number(field("partySize")),
          notes: field("notes"),
          ...(modal.item ? { status: field("status") } : {}),
        };
        await mutate(
          modal.item ? `/v1/reservations/${modal.item.id}` : "/v1/reservations",
          body,
          "Réservation enregistrée. Aucun message client n’a été envoyé.",
          modal.item ? "PATCH" : "POST",
        );
      } else if (modal.kind === "decision")
        await mutate(
          `/v1/decisions/${modal.item.id}`,
          { status: modal.status, note: field("note") },
          "Décision enregistrée. Aucun effet externe déclenché.",
        );
      else if (modal.kind === "task")
        await mutate(
          "/v1/tasks",
          {
            restaurantId,
            title: field("title"),
            assigneeName: field("assigneeName"),
            category: "service",
          },
          "Action ajoutée à la préparation du service.",
          "POST",
        );
      else if (modal.kind === "shift") {
        const body = {
          restaurantId,
          teamMemberName: field("teamMemberName"),
          roleTitle: field("roleTitle"),
          startsAt: restaurantLocalToIso(field("startsAt"), tz),
          endsAt: restaurantLocalToIso(field("endsAt"), tz),
          status: field("status"),
        };
        await mutate(
          modal.item ? `/v1/team/shifts/${modal.item.id}` : "/v1/team/shifts",
          body,
          "Planning enregistré. Aucun message envoyé à l’équipe.",
          modal.item ? "PATCH" : "POST",
        );
      } else if (modal.kind === "table")
        await mutate(
          modal.item
            ? `/v1/dining/tables/${modal.item.id}`
            : "/v1/dining/tables",
          {
            restaurantId,
            name: field("name"),
            area: field("area"),
            capacity: Number(field("capacity")),
            status: field("status"),
            ...(modal.item ? { expectedRevision: modal.item.revision } : {}),
          },
          "Plan de salle enregistré.",
          modal.item ? "PATCH" : "POST",
        );
      else if (modal.kind === "message")
        await mutate(
          "/v1/communications/drafts",
          {
            restaurantId,
            recipient: field("recipient"),
            subject: field("subject"),
            body: field("body"),
            idempotencyKey: draftRequestId.current,
          },
          "Brouillon sauvegardé. Relisez-le avant tout envoi.",
          "POST",
        );
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Vérifiez les informations saisies.",
      );
    }
  }
  async function sendChat() {
    if (chatInFlight.current || !message.trim() || !restaurantId) return;
    chatInFlight.current = true;
    const submittedMessage = message;
    setChatBusy(true);
    setError("");
    try {
      await api("/v1/operating/chat", {
        method: "POST",
        body: JSON.stringify({ restaurantId, message: submittedMessage.trim() }),
      });
      setMessage((current) => current === submittedMessage ? "" : current);
      await refresh();
      if (active !== "copilot") router.push("/copilot");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Votre message n’a pas pu être traité. Il est conservé ici.",
      );
    } finally {
      chatInFlight.current = false;
      setChatBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/v1/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Déconnexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session || !scoped)
    return (
      <div className="tn-loading">
        <Brand />
        <h1>
          {sessionError || error
            ? "Votre espace est momentanément indisponible."
            : "Préparons votre service…"}
        </h1>
        {sessionError || error ? (
          <>
            <p role="alert">{sessionError || error}</p>
            <button
              className="tn-secondary"
              onClick={() => void (session ? refresh() : refreshSession())}
            >
              Réessayer
            </button>
            <p>
              <Link href="/login">Revenir à la connexion</Link>
            </p>
          </>
        ) : (
          <LoaderCircle
            size={22}
            className="spinning"
            aria-label="Chargement"
          />
        )}
      </div>
    );

  return (
    <div className="tn-app">
      <a className="tn-skip" href="#owner-main">
        Aller au contenu
      </a>
      <header className="tn-topbar">
        <Link href="/today" aria-label="TableNow — Aujourd’hui">
          <Brand />
        </Link>
        <nav className="tn-desktop-nav" aria-label="Navigation principale">
          {mainNav.map((item) => (
            <Link
              key={item.key}
              href={`/${item.key}`}
              className={active === item.key ? "active" : ""}
              aria-current={active === item.key ? "page" : undefined}
            >
              {item.label}
              {item.key === "decisions" && open.length > 0
                ? ` · ${open.length}`
                : ""}
            </Link>
          ))}
        </nav>
        <div className="tn-restaurant">
          <Building2 size={16} />
          <select
            aria-label="Établissement actif"
            value={restaurantId || ""}
            onChange={(e) => {
              setRestaurantId(e.target.value);
              setMessage("");
            }}
          >
            {workspace?.restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Link
            href="/profile"
            className="tn-profile-button"
            aria-label="Votre profil"
          >
            {initials(session.user.displayName || "Propriétaire")}
          </Link>
        </div>
      </header>
      {restaurant?.isDemo && (
        <div className="tn-demo">
          <span>
            Restaurant de test · données fictives, modifications sauvegardées.
          </span>
          <Link href="/profile">Connexions</Link>
        </div>
      )}
      <main className="tn-main" id="owner-main">
        <div className="tn-heading">
          <div>
            <span className="tn-eyebrow">
              {restaurant?.name} ·{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                timeZone: tz,
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </span>
            <h1 ref={heading} tabIndex={-1}>
              {title}
            </h1>
            <p>{subtitle}</p>
          </div>
          <div className="tn-heading-actions">
            <button
              className="tn-icon"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label="Actualiser les données"
            >
              <RefreshCw size={17} className={refreshing ? "spinning" : ""} />
            </button>
            {active === "service" && (
              <button
                className="tn-secondary"
                onClick={() => openModal({ kind: "reservation" })}
              >
                <Plus size={16} /> Réservation
              </button>
            )}
            {active === "team" && (
              <button
                className="tn-secondary"
                onClick={() => openModal({ kind: "shift" })}
              >
                <Plus size={16} /> Renfort
              </button>
            )}
            {active === "communications" && (
              <button
                className="tn-secondary"
                onClick={() => openModal({ kind: "message" })}
              >
                <Plus size={16} /> Message
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="tn-error" role="alert">
            {error}
            <button className="tn-link" onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}
        {active === "today" && (
          <>
            <div className="tn-tabs" aria-label="Moment du service">
              {[
                ["before", "Avant le service"],
                ["during", "Pendant le service"],
                ["after", "Après le service"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={phase === key ? "active" : ""}
                  aria-pressed={phase === key}
                  onClick={() => setPhase(key!)}
                >
                  {label}
                </button>
              ))}
            </div>
            {open[0] && (
              <div className="tn-alert">
                <Clock3 size={23} />
                <div>
                  <strong>{open[0].title}</strong>
                  <p>{open[0].description}</p>
                </div>
                <Link href="/decisions" className="tn-secondary">
                  Voir la décision <ArrowRight size={16} />
                </Link>
              </div>
            )}
            <details className="tn-service-details">
              <summary>
                Le service en chiffres <ChevronRight size={16} />
              </summary>
              <Kpis
                workspace={scoped}
                reservations={reservations}
                tables={tables}
                currentDay={currentDay}
                tz={tz}
              />
            </details>
            {phase === "before" ? (
              <div className="tn-grid">
                <section className="tn-card">
                  <div className="tn-card-head">
                    <h2>Prêts pour le service ?</h2>
                    <button
                      className="tn-icon"
                      onClick={() => openModal({ kind: "task" })}
                      aria-label="Ajouter une action"
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                  <TaskList
                    tasks={scoped.tasks.filter(
                      (t) => t.category !== "supplier",
                    )}
                    busy={busy}
                    update={(id, status) =>
                      void mutate(
                        `/v1/tasks/${id}`,
                        { status },
                        "Liste de préparation mise à jour.",
                      )
                    }
                  />
                  {scoped.tasks.length === 0 && (
                    <Empty
                      title="Votre première préparation"
                      text="Ajoutez les points à vérifier avant l’ouverture."
                      action={
                        <button
                          className="tn-secondary"
                          onClick={() => openModal({ kind: "task" })}
                        >
                          Ajouter une action
                        </button>
                      }
                    />
                  )}
                </section>
                <FirstPlan workspace={scoped} />
              </div>
            ) : phase === "after" ? (
              <div className="tn-grid">
                <section className="tn-card">
                  <div className="tn-card-head">
                    <h2>Ce que ce service nous apprend</h2>
                    <BarChart3 size={20} />
                  </div>
                  <p>
                    Les indicateurs affichés proviennent uniquement des données
                    enregistrées. Le chiffre d’affaires total nécessite une
                    connexion à votre caisse.
                  </p>
                  <div className="tn-row">
                    <div>
                      <strong>
                        {
                          reservations.filter((r) => r.status === "completed")
                            .length
                        }{" "}
                        réservations terminées
                      </strong>
                      <small>Statut confirmé dans TableNow</small>
                    </div>
                    <CheckCheck size={19} />
                  </div>
                  <div className="tn-row">
                    <div>
                      <strong>
                        {
                          reservations.filter((r) => r.status === "no_show")
                            .length
                        }{" "}
                        absences signalées
                      </strong>
                      <small>Sur les réservations du jour</small>
                    </div>
                  </div>
                  <div className="tn-row">
                    <div>
                      <strong>
                        {
                          scoped.decisions.filter(
                            (d) => d.status === "approved",
                          ).length
                        }{" "}
                        décisions validées
                      </strong>
                      <small>Historique chargé, tous services confondus</small>
                    </div>
                  </div>
                  <button
                    className="tn-secondary tn-wide"
                    onClick={() => {
                      setMessage(
                        "Aide-moi à préparer le prochain service à partir de nos résultats.",
                      );
                      document.querySelector<HTMLTextAreaElement>(".tn-composer-dock textarea")?.focus();
                    }}
                  >
                    Préparer la suite <ArrowRight size={16} />
                  </button>
                </section>
                <FirstPlan workspace={scoped} />
              </div>
            ) : (
              <div className="tn-grid">
                <div className="tn-stack">
                  <section className="tn-card">
                    <div className="tn-card-head">
                      <h2>Les prochaines arrivées</h2>
                      <Link className="tn-link" href="/service">
                        Toute la salle <ChevronRight size={15} />
                      </Link>
                    </div>
                    <ArrivalList
                      reservations={reservations
                        .filter((r) =>
                          ["pending", "confirmed"].includes(r.status),
                        )
                        .slice(0, 5)}
                      tz={tz}
                      edit={(item) => openModal({ kind: "reservation", item })}
                    />
                  </section>
                  <section className="tn-card">
                    <div className="tn-card-head">
                      <h2>Les postes du service</h2>
                      <Link className="tn-link" href="/team">
                        Voir l’équipe <ChevronRight size={15} />
                      </Link>
                    </div>
                    {shifts.length ? (
                      shifts.slice(0, 4).map((shift) => (
                        <div key={shift.id} className="tn-row">
                          <span className="tn-avatar">
                            {initials(shift.teamMemberName)}
                          </span>
                          <div>
                            <strong>{shift.teamMemberName}</strong>
                            <small>{shift.roleTitle}</small>
                          </div>
                          <span className="tn-pill">
                            {statusLabel(shift.status)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="Votre équipe reste à renseigner"
                        text="Ajoutez les postes et les horaires du service."
                        action={
                          <button
                            className="tn-secondary"
                            onClick={() => openModal({ kind: "shift" })}
                          >
                            Ajouter un poste
                          </button>
                        }
                      />
                    )}
                  </section>
                </div>
                <div className="tn-stack">
                  <section className="tn-card">
                    <div className="tn-card-head">
                      <h2>À votre attention</h2>
                      <MessageSquareText size={19} />
                    </div>
                    {scoped.communications
                      .filter((m) => m.status !== "handled")
                      .slice(0, 3)
                      .map((item) => (
                        <Link
                          href="/communications"
                          className="tn-row"
                          key={item.id}
                        >
                          <span className="tn-avatar">
                            {item.channel === "phone" ? (
                              <Phone size={17} />
                            ) : (
                              <Mail size={17} />
                            )}
                          </span>
                          <div>
                            <strong>
                              {item.contactName || "Nouvelle demande"}
                            </strong>
                            <small>{item.subject || item.summary}</small>
                          </div>
                          <ChevronRight size={17} />
                        </Link>
                      ))}
                    <Link
                      href="/communications"
                      className="tn-secondary tn-wide"
                    >
                      Ouvrir les communications <ArrowRight size={16} />
                    </Link>
                  </section>
                  <FirstPlan workspace={scoped} />
                </div>
              </div>
            )}
          </>
        )}
        {active === "decisions" && (
          <Decisions
            decisions={scoped.decisions}
            decide={(item, status) =>
              openModal({ kind: "decision", item, status })
            }
          />
        )}
        {active === "communications" && (
          <Inbox
            workspace={scoped}
            outgoing={outgoing}
            tz={tz}
            busy={busy}
            canSend={operating.capabilities.email}
            handle={(id, status) =>
              void mutate(
                `/v1/communications/${id}`,
                { status },
                "Demande mise à jour.",
              )
            }
            compose={(subject) => openModal({ kind: "message", subject })}
            send={(item) =>
              openModal({
                kind: "send",
                id: item.id,
                recipient: item.recipient,
                body: item.body,
              })
            }
          />
        )}
        {active === "service" && (
          <>
            <div className="tn-toolbar">
              <div className="tn-filter">
                <span className="tn-pill green">
                  {tables.filter((t) => t.status === "available").length} libres
                </span>
                <span className="tn-pill amber">
                  {tables.filter((t) => t.status === "occupied").length}{" "}
                  occupées
                </span>
                <span className="tn-pill blue">
                  {reservations.filter((r) => r.status === "confirmed").length}{" "}
                  arrivées confirmées
                </span>
              </div>
              <Link className="tn-link" href="/communications">
                <MessageSquareText size={16} /> Communications
              </Link>
            </div>
            <div className="tn-grid">
              <section className="tn-card">
                <div className="tn-card-head">
                  <h2>Plan de salle</h2>
                  <button
                    className="tn-secondary"
                    onClick={() => openModal({ kind: "table" })}
                  >
                    <Plus size={16} /> Table
                  </button>
                </div>
                {tables.length ? (
                  <>
                    {[...new Set(tables.map((t) => t.area))].map((area) => (
                      <section key={area}>
                        <span className="tn-eyebrow">{area}</span>
                        <div className="tn-table-plan">
                          {tables
                            .filter((t) => t.area === area)
                            .map((table) => (
                              <button
                                key={table.id}
                                className={`tn-table-tile ${table.status}`}
                                onClick={() =>
                                  openModal({ kind: "table", item: table })
                                }
                              >
                                <strong>{table.name}</strong>
                                <small>
                                  {table.capacity} places ·{" "}
                                  {statusLabel(table.status)}
                                </small>
                              </button>
                            ))}
                        </div>
                      </section>
                    ))}
                    <p className="tn-muted">
                      État déclaré par la direction. L’installation d’une
                      réservation ne modifie pas automatiquement une table.
                    </p>
                  </>
                ) : (
                  <Empty
                    title="Dessinons votre salle"
                    text="Ajoutez vos tables et leurs capacités. Aucun plan fictif n’est créé pour un établissement réel."
                    action={
                      <button
                        className="tn-secondary"
                        onClick={() => openModal({ kind: "table" })}
                      >
                        Ajouter la première table
                      </button>
                    }
                  />
                )}
              </section>
              <section className="tn-card">
                <div className="tn-card-head">
                  <h2>Arrivées & réservations</h2>
                  <CalendarDays size={18} />
                </div>
                <ArrivalList
                  reservations={reservations}
                  tz={tz}
                  edit={(item) => openModal({ kind: "reservation", item })}
                />
              </section>
            </div>
          </>
        )}
        {active === "team" && (
          <>
            <div className="tn-toolbar">
              <div className="tn-filter">
                <span className="tn-pill blue">
                  {shifts.length} postes aujourd’hui
                </span>
                <span className="tn-pill">Accès propriétaire uniquement</span>
              </div>
              <Link className="tn-link" href="/communications">
                Préparer un message à l’équipe <ArrowRight size={15} />
              </Link>
            </div>
            {shifts.length ? (
              <div className="tn-shifts">
                {shifts.map((shift) => (
                  <article key={shift.id} className="tn-card tn-shift">
                    <header>
                      <span className="tn-avatar">
                        {initials(shift.teamMemberName)}
                      </span>
                      <div>
                        <h3>{shift.teamMemberName}</h3>
                        <p>{shift.roleTitle}</p>
                      </div>
                      <button
                        className="tn-icon"
                        aria-label={`Modifier le poste de ${shift.teamMemberName}`}
                        onClick={() =>
                          openModal({ kind: "shift", item: shift })
                        }
                      >
                        <Settings2 size={17} />
                      </button>
                    </header>
                    <div className="tn-time-labels">
                      <span>{formatRestaurantTime(shift.startsAt, tz)}</span>
                      <span>{formatRestaurantTime(shift.endsAt, tz)}</span>
                    </div>
                    <div className="tn-timeline">
                      <span style={{ left: "3%", width: "94%" }}>
                        {shift.roleTitle}
                      </span>
                    </div>
                    <footer>
                      <span
                        className={`tn-pill ${shift.status === "confirmed" ? "green" : ""}`}
                      >
                        {statusLabel(shift.status)}
                      </span>
                      <button
                        className="tn-secondary"
                        disabled={
                          busy || ["absent", "completed"].includes(shift.status)
                        }
                        onClick={() =>
                          void mutate(
                            `/v1/team/shifts/${shift.id}/pause`,
                            {
                              paused: !operating.pausedShiftIds.includes(
                                shift.id,
                              ),
                            },
                            "État de pause enregistré.",
                          )
                        }
                      >
                        <Coffee size={15} />
                        {operating.pausedShiftIds.includes(shift.id)
                          ? "Reprendre"
                          : "Pause"}
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Préparez votre première équipe"
                text="Un nom, un poste et un horaire suffisent pour commencer. Les accès salariés seront ajoutés plus tard."
                action={
                  <button
                    className="tn-primary"
                    onClick={() => openModal({ kind: "shift" })}
                  >
                    Ajouter un poste <Plus size={16} />
                  </button>
                }
              />
            )}
          </>
        )}
        {active === "profile" && (
          <div className="tn-settings-grid">
            <section className="tn-card">
              <div className="tn-card-head">
                <h2>Votre établissement</h2>
                <Building2 size={19} />
              </div>
              <h3>{restaurant?.name}</h3>
              <p>{restaurant?.address || "Adresse à compléter"}</p>
              <div className="tn-row">
                <div>
                  <strong>
                    {restaurant?.capacity || "Non renseigné"} places
                  </strong>
                  <small>{tz}</small>
                </div>
              </div>
              <Link
                href={`/onboarding?restaurantId=${restaurantId}&section=establishment`}
                className="tn-secondary tn-wide"
              >
                Revoir ma configuration <ArrowRight size={16} />
              </Link>
            </section>
            <section className="tn-card">
              <div className="tn-card-head">
                <h2>Votre accès</h2>
                <ShieldCheck size={19} />
              </div>
              <h3>{session.user.displayName || "Propriétaire"}</h3>
              <p>{session.user.email}</p>
              <div className="tn-row">
                <div>
                  <strong>Les décisions sensibles restent les vôtres.</strong>
                  <small>
                    Aucun message n’est envoyé sans validation explicite.
                  </small>
                </div>
              </div>
              <button
                className="tn-secondary"
                onClick={() => void logout()}
                disabled={busy}
              >
                <LogOut size={16} /> Se déconnecter
              </button>
            </section>
            <section className="tn-card">
              <div className="tn-card-head">
                <h2>Connexions & capacités</h2>
                <Settings2 size={19} />
              </div>
              {[
                ["E-mails sortants", operating.capabilities.email],
                ["Conversation IA", operating.capabilities.ai],
                ["SMS", operating.capabilities.sms],
                ["Appels téléphoniques", operating.capabilities.phone],
                ["WhatsApp", operating.capabilities.whatsapp],
              ].map(([label, ready]) => (
                <div className="tn-row" key={String(label)}>
                  <div>
                    <strong>{label}</strong>
                  </div>
                  <span className={`tn-pill ${ready ? "green" : ""}`}>
                    {ready ? "Configuré · test requis" : "Non configuré"}
                  </span>
                </div>
              ))}
              <p>
                Configurer un service ne prouve pas sa livraison. Les canaux
                absents restent désactivés.
              </p>
            </section>
            <FirstPlan workspace={scoped} />
          </div>
        )}
        {active === "copilot" && (
          <>
            <div className="tn-toolbar">
              <span className="tn-pill blue">
                <Sparkles size={13} />
                {operating.capabilities.ai
                  ? "Conversation IA configurée"
                  : "Synthèse métier · IA non configurée"}
              </span>
              <Link href="/profile" className="tn-link">
                Mes priorités <ChevronRight size={15} />
              </Link>
            </div>
            <div className="tn-chat">
              {operating.chat.filter(
                (entry) => entry.restaurantId === restaurantId,
              ).length ? (
                operating.chat
                  .filter((entry) => entry.restaurantId === restaurantId)
                  .map((entry) => (
                    <article
                      className={`tn-chat-bubble ${entry.role}`}
                      key={entry.id}
                    >
                      <small>
                        {entry.role === "user"
                          ? "Vous"
                          : entry.mode === "ai"
                            ? "TableNow"
                            : "TableNow · synthèse des données"}
                      </small>
                      {entry.body}
                    </article>
                  ))
              ) : (
                <Empty
                  title="Qu’est-ce qui compte pour vous aujourd’hui ?"
                  text="Décrivez votre priorité à l’écrit ou avec le micro. Le texte dicté reste modifiable avant envoi."
                  action={
                    <div className="tn-suggestions">
                      {[
                        "Préparons le service",
                        "Quelles décisions sont prioritaires ?",
                        "Fais le point sur les réservations",
                      ].map((text) => (
                        <button
                          key={text}
                          className="tn-secondary"
                          onClick={() => setMessage(text)}
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  }
                />
              )}
            </div>
          </>
        )}
      </main>
      <div className="tn-composer-dock">
        <ConversationInput
          value={message}
          onChange={setMessage}
          onSend={() => void sendChat()}
          onVoice={dictation.toggle}
          recording={dictation.listening}
          voiceBusy={false}
          placeholder="Parlez à TableNow, ou écrivez ici…"
          sendLabel={chatBusy ? "Message en cours de traitement" : "Envoyer mon message"}
          voiceLabel={dictation.listening ? "Arrêter la dictée" : "Dicter mon message"}
        />
        {chatBusy && <div className="tn-composer-note" role="status">Votre message est en cours de traitement…</div>}
        {dictation.notice && (
          <div className="tn-composer-note" role="status">
            {dictation.notice}
          </div>
        )}
      </div>
      <nav className="tn-mobile-nav" aria-label="Navigation mobile">
        {mobileNav.map((item) => (
          <Link
            key={item.key}
            href={`/${item.key}`}
            className={active === item.key ? "active" : ""}
            aria-current={active === item.key ? "page" : undefined}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      {notice && (
        <div className="tn-toast" role="status">
          <Check size={18} />
          <span>{notice}</span>
          <button
            className="tn-icon"
            aria-label="Fermer la confirmation"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <OwnerDialog
          title={
            modal.kind === "reservation"
              ? modal.item
                ? "Modifier la réservation"
                : "Nouvelle réservation"
              : modal.kind === "decision"
                ? "Confirmer votre décision"
                : modal.kind === "task"
                  ? "Une action pour le service"
                  : modal.kind === "shift"
                    ? "Organiser un poste"
                    : modal.kind === "table"
                      ? "Votre plan de salle"
                      : modal.kind === "send"
                        ? "Envoyer cet e-mail ?"
                        : "Préparer un message"
          }
          busy={busy}
          close={() => setModal(null)}
        >
          {modal.kind === "send" ? (
            <>
              <p>
                Destinataire : <strong>{modal.recipient}</strong>
              </p>
              <div className="tn-transcript">
                <p>{modal.body}</p>
              </div>
              <p>
                L’envoi transmettra réellement cet e-mail. Une acceptation SMTP
                ne garantit pas sa livraison dans la boîte de réception.
              </p>
              {formError && (
                <p className="tn-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="tn-modal-actions">
                <button
                  className="tn-secondary"
                  onClick={() => setModal(null)}
                  disabled={busy}
                >
                  Annuler
                </button>
                <button
                  className="tn-primary"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      `/v1/communications/drafts/${modal.id}/send`,
                      {},
                      "E-mail accepté par le service d’envoi. Livraison non encore confirmée.",
                      "POST",
                    )
                  }
                >
                  {busy ? "Envoi en cours…" : "Confirmer l’envoi réel"}
                  <Mail size={17} />
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submitForm}>
              {modal.kind === "decision" ? (
                <>
                  <h3>{modal.item.title}</h3>
                  <p>{modal.item.suggestedAction || modal.item.description}</p>
                  <p>
                    Votre choix : <strong>{statusLabel(modal.status)}</strong>.
                    Cette validation est enregistrée ; elle n’envoie aucun
                    message et ne déclenche aucune action externe.
                  </p>
                  <Field
                    label="Votre consigne (facultatif)"
                    name="note"
                    textarea
                    maxLength={500}
                  />
                </>
              ) : (
                <div className="tn-form-grid">
                  {modal.kind === "reservation" && (
                    <>
                      <Field
                        label="Nom du client"
                        name="guestName"
                        defaultValue={modal.item?.guestName}
                        required
                        span
                        readOnly={!!modal.item}
                      />
                      <Field
                        label="Date et heure"
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={
                          modal.item
                            ? localDateTime(modal.item.startsAt, tz)
                            : nextServiceLocal(tz)
                        }
                        required
                      />
                      <Field
                        label="Couverts"
                        name="partySize"
                        type="number"
                        defaultValue={modal.item?.partySize || 2}
                        min={1}
                        max={100}
                        required
                      />
                      {!modal.item && (
                        <>
                          <Field
                            label="E-mail (facultatif)"
                            name="guestEmail"
                            type="email"
                          />
                          <Field
                            label="Téléphone (facultatif)"
                            name="guestPhone"
                            type="tel"
                          />
                        </>
                      )}
                      {modal.item && (
                        <label className="tn-field tn-span">
                          <span>Statut</span>
                          <select
                            name="status"
                            defaultValue={modal.item.status}
                          >
                            {[
                              "pending",
                              "confirmed",
                              "seated",
                              "completed",
                              "cancelled",
                              "no_show",
                            ].map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <Field
                        label="Note pour l’équipe (facultatif)"
                        name="notes"
                        textarea
                        span
                        maxLength={1000}
                        defaultValue={modal.item?.notes || ""}
                      />
                    </>
                  )}
                  {modal.kind === "task" && (
                    <>
                      <Field
                        label="Que faut-il préparer ?"
                        name="title"
                        required
                        span
                        maxLength={200}
                      />
                      <Field
                        label="Responsable (facultatif)"
                        name="assigneeName"
                        span
                        maxLength={120}
                      />
                    </>
                  )}
                  {modal.kind === "shift" && (
                    <>
                      <Field
                        label="Prénom et nom"
                        name="teamMemberName"
                        required
                        defaultValue={modal.item?.teamMemberName}
                        maxLength={120}
                      />
                      <Field
                        label="Poste"
                        name="roleTitle"
                        required
                        defaultValue={modal.item?.roleTitle}
                        maxLength={120}
                      />
                      <Field
                        label="Début"
                        name="startsAt"
                        type="datetime-local"
                        required
                        defaultValue={
                          modal.item
                            ? localDateTime(modal.item.startsAt, tz)
                            : nextServiceLocal(tz)
                        }
                      />
                      <Field
                        label="Fin"
                        name="endsAt"
                        type="datetime-local"
                        required
                        defaultValue={
                          modal.item
                            ? localDateTime(modal.item.endsAt, tz)
                            : addLocalHours(nextServiceLocal(tz), 5)
                        }
                      />
                      <label className="tn-field tn-span">
                        <span>Statut</span>
                        <select
                          name="status"
                          defaultValue={modal.item?.status || "planned"}
                        >
                          {(modal.item
                            ? ["planned", "confirmed", "absent", "completed"]
                            : ["planned", "confirmed"]
                          ).map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {modal.kind === "table" && (
                    <>
                      <Field
                        label="Nom de la table"
                        name="name"
                        required
                        defaultValue={modal.item?.name}
                        maxLength={40}
                      />
                      <Field
                        label="Zone"
                        name="area"
                        required
                        defaultValue={modal.item?.area || "Salle principale"}
                        maxLength={80}
                      />
                      <Field
                        label="Nombre de places"
                        name="capacity"
                        type="number"
                        min={1}
                        max={100}
                        required
                        defaultValue={modal.item?.capacity || 2}
                      />
                      <label className="tn-field">
                        <span>État actuel</span>
                        <select
                          name="status"
                          defaultValue={modal.item?.status || "available"}
                        >
                          {["available", "occupied", "reserved", "blocked"].map(
                            (s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </>
                  )}
                  {modal.kind === "message" && (
                    <>
                      <Field
                        label="E-mail du destinataire"
                        name="recipient"
                        type="email"
                        required
                        span
                        defaultValue={modal.recipient}
                      />
                      <Field
                        label="Objet"
                        name="subject"
                        required
                        span
                        defaultValue={modal.subject}
                        maxLength={200}
                      />
                      <Field
                        label="Votre message"
                        name="body"
                        required
                        textarea
                        span
                        maxLength={4000}
                      />
                      <p className="tn-span tn-muted">
                        Le message sera sauvegardé comme brouillon. Vous pourrez
                        le relire avant de confirmer l’envoi.
                      </p>
                    </>
                  )}
                </div>
              )}
              {formError && (
                <p className="tn-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="tn-modal-actions">
                <button
                  className="tn-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Annuler
                </button>
                <button className="tn-primary" disabled={busy}>
                  {busy
                    ? "Enregistrement…"
                    : modal.kind === "message"
                      ? "Sauvegarder le brouillon"
                      : "Enregistrer"}
                  <Check size={17} />
                </button>
              </div>
            </form>
          )}
        </OwnerDialog>
      )}
    </div>
  );
}

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="tn-empty">
      <Sparkles size={24} />
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Field({
  label,
  span,
  textarea,
  ...props
}: {
  label: string;
  span?: boolean;
  textarea?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`tn-field ${span ? "tn-span" : ""}`}>
      <span>
        {label}
        {props.required ? " *" : ""}
      </span>
      {textarea ? (
        <textarea
          name={props.name}
          rows={4}
          defaultValue={props.defaultValue}
          required={props.required}
          maxLength={props.maxLength}
        />
      ) : (
        <input {...props} />
      )}
    </label>
  );
}
function localDateTime(value: string, tz: string) {
  return `${dayKey(value, tz)}T${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))}`;
}
function ArrivalList({
  reservations,
  tz,
  edit,
}: {
  reservations: Reservation[];
  tz: string;
  edit: (item: Reservation) => void;
}) {
  return reservations.length ? (
    <>
      {reservations.map((item) => (
        <div className="tn-row" key={item.id}>
          <time>{formatRestaurantTime(item.startsAt, tz)}</time>
          <div>
            <strong>{item.guestName}</strong>
            <small>
              {item.partySize} couverts · {statusLabel(item.status)}
            </small>
            {item.notes && <p style={{ fontSize: 11 }}>{item.notes}</p>}
          </div>
          <button
            className="tn-icon"
            onClick={() => edit(item)}
            aria-label={`Modifier la réservation de ${item.guestName}`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ))}
    </>
  ) : (
    <Empty
      title="Aucune réservation sur ce service"
      text="Ajoutez une réservation. Les connexions aux outils externes restent à activer."
    />
  );
}
function TaskList({
  tasks,
  busy,
  update,
}: {
  tasks: Workspace["tasks"];
  busy: boolean;
  update: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ordered = [...tasks].sort(
    (a, b) => Number(a.status === "done") - Number(b.status === "done"),
  );
  return (
    <>
      {(expanded ? ordered : ordered.slice(0, 3)).map((task) => (
        <div className="tn-row" key={task.id}>
          <button
            className={`tn-icon ${task.status === "done" ? "tn-success" : ""}`}
            disabled={busy}
            aria-label={`${task.status === "done" ? "Rouvrir" : "Terminer"} : ${task.title}`}
            onClick={() =>
              update(task.id, task.status === "done" ? "open" : "done")
            }
          >
            {task.status === "done" ? (
              <CheckCheck size={20} />
            ) : (
              <Square size={19} />
            )}
          </button>
          <div>
            <strong>{task.title}</strong>
            <small>
              {task.assigneeName || "À attribuer"} · {statusLabel(task.status)}
            </small>
          </div>
        </div>
      ))}
      {tasks.length > 3 && (
        <button
          className="tn-link tn-disclosure"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Revenir à l’essentiel"
            : `Voir les ${tasks.length} actions`}
          <ChevronRight size={15} />
        </button>
      )}
    </>
  );
}
function Kpis({
  workspace,
  reservations,
  tables,
  currentDay,
  tz,
}: {
  workspace: Workspace;
  reservations: Reservation[];
  tables: ServiceTable[];
  currentDay: string;
  tz: string;
}) {
  const metric = workspace.metrics.find(
    (m) =>
      m.date.slice(0, 10) === currentDay || dayKey(m.date, tz) === currentDay,
  );
  const covers = reservations
    .filter((r) => !["cancelled", "no_show"].includes(r.status))
    .reduce((n, r) => n + r.partySize, 0);
  return (
    <div className="tn-kpis">
      <Kpi
        label="Revenu attribué à TableNow"
        value={
          metric
            ? new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(metric.revenueCaptured)
            : "—"
        }
        detail={
          metric ? "Source : indicateurs enregistrés" : "Caisse non connectée"
        }
        icon={<BarChart3 size={16} />}
      />
      <Kpi
        label="Couverts prévus"
        value={String(covers)}
        detail="Réservations du jour"
        icon={<UtensilsCrossed size={16} />}
      />
      <Kpi
        label="Tables libres"
        value={
          tables.length
            ? String(tables.filter((t) => t.status === "available").length)
            : "—"
        }
        detail={
          tables.length
            ? `Sur ${tables.length} tables renseignées`
            : "Plan de salle à compléter"
        }
        icon={<LayoutGrid size={16} />}
      />
      <Kpi
        label="Décisions à prendre"
        value={String(
          workspace.decisions.filter((d) => d.status === "open").length,
        )}
        detail="À valider par la direction"
        icon={<ListChecks size={16} />}
      />
    </div>
  );
}
function Kpi({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="tn-kpi">
      <span>
        {label}
        {icon}
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
function FirstPlan({ workspace }: { workspace: Workspace }) {
  const plan = workspace.firstResults[0];
  return (
    <section className="tn-card">
      <div className="tn-card-head">
        <h2>Votre prochain pas</h2>
        <Sparkles size={20} />
      </div>
      {plan ? (
        <>
          <h3>{plan.title}</h3>
          <p>{plan.recommendations[0]}</p>
          {(plan.recommendations.length > 1 ||
            plan.unknownFields.length > 0) && (
            <details className="tn-disclosure">
              <summary>Voir le détail du plan</summary>
              {plan.recommendations.slice(1).map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              {plan.unknownFields.length > 0 && (
                <p>
                  {plan.unknownFields.length} information(s) encore à préciser.
                </p>
              )}
            </details>
          )}
          <Link
            href={`/onboarding?restaurantId=${plan.restaurantId}&section=review`}
            className="tn-link"
          >
            Ajuster mes priorités <ArrowRight size={16} />
          </Link>
        </>
      ) : (
        <>
          <p>
            Dites-nous ce qui vous prend du temps. TableNow vous aidera à
            choisir par où commencer.
          </p>
          <Link
            className="tn-secondary tn-wide"
            href="/onboarding"
            style={{ marginTop: 18 }}
          >
            Définir ma priorité <ArrowRight size={16} />
          </Link>
        </>
      )}
    </section>
  );
}
function Decisions({
  decisions,
  decide,
}: {
  decisions: Decision[];
  decide: (item: Decision, status: "approved" | "rejected" | "snoozed") => void;
}) {
  const [history, setHistory] = useState(false);
  const items = decisions.filter((d) =>
    history ? d.status !== "open" : d.status === "open",
  );
  return (
    <>
      <div className="tn-toolbar">
        <div className="tn-tabs">
          <button
            className={!history ? "active" : ""}
            aria-pressed={!history}
            onClick={() => setHistory(false)}
          >
            À arbitrer · {decisions.filter((d) => d.status === "open").length}
          </button>
          <button
            className={history ? "active" : ""}
            aria-pressed={history}
            onClick={() => setHistory(true)}
          >
            Historique
          </button>
        </div>
        <span className="tn-muted">
          Une validation claire, une trace conservée.
        </span>
      </div>
      {items.length ? (
        items.map((item) => (
          <article className="tn-card tn-decision" key={item.id}>
            <span className="tn-decision-icon">
              <ListChecks size={22} />
            </span>
            <div>
              <span className="tn-eyebrow">
                {statusLabel(item.priority)} ·{" "}
                {item.kind === "group_request" ? "Accueil client" : "Service"}
              </span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              {!history && (
                <div className="tn-decision-actions">
                  <button
                    className="tn-primary"
                    onClick={() => decide(item, "approved")}
                  >
                    Valider la proposition <Check size={16} />
                  </button>
                  <button
                    className="tn-secondary"
                    onClick={() => decide(item, "snoozed")}
                  >
                    Reporter
                  </button>
                  <button
                    className="tn-link"
                    onClick={() => decide(item, "rejected")}
                  >
                    Refuser
                  </button>
                </div>
              )}
              <details>
                <summary>
                  Comprendre la proposition <ChevronRight size={14} />
                </summary>
                <p>
                  {item.suggestedAction ||
                    "Cette décision nécessite votre arbitrage."}
                </p>
                <p>
                  La validation enregistre votre consigne. Aucun message,
                  paiement ni changement externe automatique.
                </p>
                {item.resolutionNote && (
                  <p>Votre note : {item.resolutionNote}</p>
                )}
              </details>
            </div>
            <span className={`tn-pill ${history ? "green" : "amber"}`}>
              {statusLabel(item.status)}
            </span>
          </article>
        ))
      ) : (
        <Empty
          title={
            history
              ? "Pas encore de décision enregistrée"
              : "Tout est clair pour le moment."
          }
          text={
            history
              ? "Vos arbitrages apparaîtront ici après validation."
              : "Les demandes nécessitant votre arbitrage apparaîtront ici."
          }
        />
      )}
    </>
  );
}
function Inbox({
  workspace,
  outgoing,
  tz,
  busy,
  canSend,
  handle,
  compose,
  send,
}: {
  workspace: Workspace;
  outgoing: OperatingState["outgoing"];
  tz: string;
  busy: boolean;
  canSend: boolean;
  handle: (id: string, status: string) => void;
  compose: (subject?: string) => void;
  send: (item: OperatingState["outgoing"][number]) => void;
}) {
  const [channel, setChannel] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(false);
  const items = workspace.communications.filter(
    (m) =>
      (channel === "all" || m.channel === channel) &&
      `${m.contactName} ${m.subject} ${m.summary}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = items.find((m) => m.id === selectedId);
  return (
    <>
      <div className="tn-toolbar">
        <label className="tn-search">
          <Search size={19} />
          <input
            aria-label="Rechercher dans les communications"
            placeholder="Un nom, une demande…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tn-filter">
          <button
            className={!drafts ? "active" : ""}
            onClick={() => setDrafts(false)}
          >
            Boîte unifiée
          </button>
          <button
            className={drafts ? "active" : ""}
            onClick={() => setDrafts(true)}
          >
            Mes messages · {outgoing.length}
          </button>
        </div>
      </div>
      {drafts ? (
        <section className="tn-stack">
          {outgoing.length ? (
            outgoing.map((item) => (
              <article className="tn-card" key={item.id}>
                <div className="tn-card-head">
                  <div>
                    <h3>{item.subject}</h3>
                    <p>{item.recipient}</p>
                  </div>
                  <span className="tn-pill">{statusLabel(item.status)}</span>
                </div>
                <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
                {item.status === "queued" && (
                  <p role="status">
                    Le service d’envoi n’a pas confirmé le résultat. Vérifiez
                    l’envoi avant de préparer un autre message au même
                    destinataire pour éviter un doublon.
                  </p>
                )}
                {item.status === "draft" && (
                  <div className="tn-modal-actions">
                    <button
                      className="tn-primary"
                      disabled={!canSend || busy}
                      onClick={() => send(item)}
                    >
                      Relire et envoyer <Mail size={16} />
                    </button>
                    {!canSend && (
                      <small className="tn-muted">
                        L’envoi d’e-mails n’est pas configuré. Votre brouillon
                        est sauvegardé.
                      </small>
                    )}
                  </div>
                )}
              </article>
            ))
          ) : (
            <Empty
              title="Votre premier message"
              text="Préparez une réponse, vérifiez son destinataire puis validez son envoi."
              action={
                <button className="tn-secondary" onClick={() => compose()}>
                  Préparer un message
                </button>
              }
            />
          )}
        </section>
      ) : (
        <>
          <div className="tn-filter" style={{ marginBottom: 18 }}>
            {[
              ["all", "Tout"],
              ["phone", "Appels"],
              ["email", "E-mails"],
              ["sms", "SMS"],
              ["whatsapp", "WhatsApp"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={channel === key ? "active" : ""}
                aria-pressed={channel === key}
                onClick={() => setChannel(key!)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`tn-inbox ${selected ? "has-selection" : ""}`}>
            <section className="tn-inbox-list" aria-label="Demandes clients">
              {items.length ? (
                items.map((item) => (
                  <button
                    key={item.id}
                    className={`tn-message ${selected?.id === item.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="tn-message-meta">
                      {item.channel === "phone" ? (
                        <Phone size={14} />
                      ) : (
                        <MessageSquareText size={14} />
                      )}
                      {channelLabel(item.channel)}
                      <time>{formatRestaurantTime(item.occurredAt, tz)}</time>
                    </div>
                    <strong>{item.contactName || "Demande client"}</strong>
                    <p>{item.subject || item.summary}</p>
                    <span
                      className={`tn-pill ${item.status === "escalated" ? "amber" : item.status === "handled" ? "green" : ""}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </button>
                ))
              ) : (
                <Empty
                  title="Aucune demande ici"
                  text="Les nouvelles demandes apparaîtront après connexion de vos canaux. Aucune réception automatique n’est simulée."
                />
              )}
            </section>
            <section className="tn-inbox-detail">
              {selected ? (
                <>
                  <button
                    className="tn-back"
                    onClick={() => setSelectedId(null)}
                  >
                    <ArrowLeft size={16} /> Revenir à la boîte
                  </button>
                  <header>
                    <div>
                      <h2>{selected.contactName || "Demande client"}</h2>
                      <p>{selected.subject}</p>
                    </div>
                    <span className="tn-pill">
                      {channelLabel(selected.channel)}
                    </span>
                  </header>
                  <div className="tn-transcript">
                    <span className="tn-eyebrow">Résumé enregistré</span>
                    <p>{selected.summary}</p>
                  </div>
                  <p>
                    TableNow conserve la demande. Vous choisissez la suite à
                    donner.
                  </p>
                  <div className="tn-modal-actions">
                    <button
                      className="tn-secondary"
                      disabled={busy}
                      onClick={() =>
                        handle(
                          selected.id,
                          selected.status === "handled" ? "open" : "handled",
                        )
                      }
                    >
                      {selected.status === "handled"
                        ? "Rouvrir"
                        : "Marquer comme traité"}
                      <Check size={16} />
                    </button>
                    <button
                      className="tn-primary"
                      onClick={() =>
                        compose(`Re: ${selected.subject || "Votre demande"}`)
                      }
                    >
                      Préparer une réponse <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <Empty
                  title="Toute la conversation, au même endroit."
                  text="Sélectionnez une demande pour la comprendre et décider de la suite."
                />
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
