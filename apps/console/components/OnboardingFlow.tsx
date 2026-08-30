"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Building2,
  CalendarClock,
  Check,
  Layers3,
  MapPin,
  MonitorCheck,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { LoadingScreen } from "./LoadingScreen";

type ReservationMode = "tablenow" | "software" | "calendar" | "paper" | "hybrid";
type Provider = "zenchef" | "sevenrooms" | "thefork" | "google_calendar" | "outlook_calendar" | "other";

const goals = [
  ["capture_demand", "Ne perdre aucune demande", "Appels, messages et réservations captés 24/7"],
  ["reduce_no_shows", "Réduire les no-shows", "Repérer et confirmer les réservations à risque"],
  ["improve_service", "Fluidifier le service", "Anticiper allergies, VIP, groupes et charge"],
  ["optimize_staff", "Mieux organiser l'équipe", "Aligner le planning sur la demande prévue"],
  ["control_inventory", "Maîtriser les stocks", "Détecter les ruptures avant qu'elles ne bloquent"],
  ["group_visibility", "Piloter plusieurs adresses", "Comparer et agir depuis un cockpit unique"],
] as const;

const modes: Array<{ key: ReservationMode; title: string; detail: string; icon: typeof MonitorCheck }> = [
  { key: "tablenow", title: "Je pars de zéro", detail: "TableNow devient mon premier outil structuré.", icon: Sparkles },
  { key: "software", title: "J’utilise un logiciel", detail: "Zenchef, SevenRooms, TheFork ou un autre.", icon: MonitorCheck },
  { key: "calendar", title: "J’utilise un calendrier", detail: "Google Calendar, Outlook ou équivalent.", icon: CalendarClock },
  { key: "paper", title: "Je travaille sur papier", detail: "Cahier, agenda ou fiches imprimées.", icon: BookOpenCheck },
  { key: "hybrid", title: "Je combine plusieurs méthodes", detail: "Logiciel, calendrier, téléphone et papier.", icon: Layers3 },
];

const providers: Array<{ key: Provider; label: string; kind: "software" | "calendar" | "both" }> = [
  { key: "zenchef", label: "Zenchef", kind: "software" },
  { key: "sevenrooms", label: "SevenRooms", kind: "software" },
  { key: "thefork", label: "TheFork Manager", kind: "software" },
  { key: "google_calendar", label: "Google Calendar", kind: "calendar" },
  { key: "outlook_calendar", label: "Outlook Calendar", kind: "calendar" },
  { key: "other", label: "Autre outil", kind: "both" },
];

export function OnboardingFlow() {
  const router = useRouter();
  const { session, loading } = useSession({ requireOnboarding: true });
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ organizationName: "", restaurantName: "", ownerName: "", roleTitle: "Direction", phone: "", address: "", timezone: "Europe/Paris" });
  const [reservationMode, setReservationMode] = useState<ReservationMode>("tablenow");
  const [selectedProviders, setSelectedProviders] = useState<Provider[]>([]);
  const [otherProvider, setOtherProvider] = useState("");
  const [keepPaperWorkflow, setKeepPaperWorkflow] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(["capture_demand", "improve_service"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    if (!session) return;
    setForm((current) => current.organizationName ? current : { ...current, organizationName: session.tenant.name });
  }, [session]);

  if (loading || !session) return <LoadingScreen label="Préparation de votre espace privé" />;

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const selectMode = (mode: ReservationMode) => {
    setReservationMode(mode);
    setSelectedProviders((current) => current.filter((provider) => availableProviders(mode).some((option) => option.key === provider)));
    setKeepPaperWorkflow(mode === "paper" || mode === "hybrid");
    setError("");
  };
  const toggleProvider = (provider: Provider) => setSelectedProviders((current) => current.includes(provider) ? current.filter((item) => item !== provider) : [...current, provider]);
  const toggleGoal = (goal: string) => setSelectedGoals((current) => current.includes(goal) ? current.filter((item) => item !== goal) : current.length < 4 ? [...current, goal] : current);
  const stepValid = step === 1 ? Object.values(form).every(Boolean) : step === 2 ? operatingSetupValid(reservationMode, selectedProviders, otherProvider) : selectedGoals.length > 0 && legalAccepted;
  const next = () => {
    if (!stepValid) {
      setError(step === 2 ? "Sélectionnez l’outil déjà utilisé, ou choisissez un autre mode." : "Complétez les informations nécessaires pour continuer.");
      return;
    }
    setError("");
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const complete = async () => {
    if (!stepValid) return;
    setBusy(true);
    setError("");
    try {
      await api("/v1/onboarding", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          serviceGoals: selectedGoals,
          operatingSetup: { reservationMode, providers: selectedProviders, ...(otherProvider ? { otherProvider } : {}), keepPaperWorkflow },
          demoMode: true,
          acceptTerms: true,
          acceptDpa: true,
        }),
      });
      await api("/v1/onboarding/complete", { method: "POST", body: "{}" });
      router.replace("/today");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de terminer la configuration.");
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (step < 3) next();
    else void complete();
  };
  const progress = `${Math.round(step / 3 * 100)}%`;

  return <main className="onboarding-layout">
    <header className="onboarding-header"><div className="logo-lockup"><span className="brand-mark brand-mark-small">T<span>N</span></span><span>TableNow<small>Installation guidée</small></span></div><div className="onboarding-progress"><span>Étape {step} sur 3</span><i><b style={{ width: progress }} /></i><strong>{progress}</strong></div></header>
    <div className="onboarding-grid">
      <section className="onboarding-intro"><span className="eyebrow"><Sparkles size={13} /> Configuration adaptative</span><h1>{introForStep(step).title}</h1><p>{introForStep(step).detail}</p><div className="setup-promise"><div><span>01</span><p><strong>Votre méthode actuelle reste valable.</strong><small>TableNow s’y adapte avant de proposer mieux.</small></p></div><div><span>02</span><p><strong>Aucune intégration n’est activée sans vous.</strong><small>Les données réelles ne sont jamais contactées en démonstration.</small></p></div><div><span>03</span><p><strong>Ordinateur et mobile partagent le même état.</strong><small>L’action continue même si le téléphone est fermé.</small></p></div></div></section>
      <form className="onboarding-form" onSubmit={submit} noValidate>
        <div className="onboarding-step-indicator" aria-label="Progression"><span className={step >= 1 ? "active" : ""}>Établissement</span><i /><span className={step >= 2 ? "active" : ""}>Méthode</span><i /><span className={step >= 3 ? "active" : ""}>Priorités</span></div>

        {step === 1 && <section className="onboarding-step"><div className="form-section"><span className="form-section-number">01</span><div><h2>Votre établissement</h2><p>Le lieu que TableNow doit comprendre en premier.</p></div></div><div className="form-grid two"><label><span>Organisation ou groupe</span><div className="input-with-icon"><Building2 size={16} /><input required value={form.organizationName} onChange={(event) => update("organizationName", event.target.value)} placeholder="Maison Rivage" autoComplete="organization" /></div></label><label><span>Nom de l’établissement</span><div className="input-with-icon"><Building2 size={16} /><input required value={form.restaurantName} onChange={(event) => update("restaurantName", event.target.value)} placeholder="Rivage Bastille" /></div></label></div><div className="form-grid two"><label><span>Votre nom</span><div className="input-with-icon"><UserRound size={16} /><input required value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} placeholder="Camille Martin" autoComplete="name" /></div></label><label><span>Votre rôle</span><input required value={form.roleTitle} onChange={(event) => update("roleTitle", event.target.value)} /></label></div><div className="form-grid two"><label><span>Téléphone</span><div className="input-with-icon"><Phone size={16} /><input required type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+33 1 42 00 00 00" autoComplete="tel" /></div></label><label><span>Adresse</span><div className="input-with-icon"><MapPin size={16} /><input required value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="12 rue de Charonne, Paris" autoComplete="street-address" /></div></label></div></section>}

        {step === 2 && <section className="onboarding-step"><div className="form-section"><span className="form-section-number">02</span><div><h2>Comment gérez-vous les réservations ?</h2><p>Choisissez la situation la plus proche de la réalité ; elle pourra évoluer ensuite.</p></div></div><div className="mode-grid">{modes.map((mode) => { const Icon = mode.icon; return <button type="button" key={mode.key} className={reservationMode === mode.key ? "selected" : ""} onClick={() => selectMode(mode.key)} aria-pressed={reservationMode === mode.key}><span><Icon size={19} /></span><div><strong>{mode.title}</strong><small>{mode.detail}</small></div><i>{reservationMode === mode.key && <Check size={13} />}</i></button>; })}</div>{["software", "calendar", "hybrid"].includes(reservationMode) && <div className="provider-section"><span className="field-label">Outils utilisés aujourd’hui</span><div className="provider-grid">{availableProviders(reservationMode).map((provider) => <button type="button" key={provider.key} onClick={() => toggleProvider(provider.key)} className={selectedProviders.includes(provider.key) ? "selected" : ""} aria-pressed={selectedProviders.includes(provider.key)}><i>{selectedProviders.includes(provider.key) && <Check size={12} />}</i>{provider.label}</button>)}</div>{selectedProviders.includes("other") && <label><span>Nom de l’autre outil</span><input value={otherProvider} onChange={(event) => setOtherProvider(event.target.value)} placeholder="Nom du logiciel, calendrier ou méthode" /></label>}</div>}{["paper", "hybrid"].includes(reservationMode) && <label className="paper-choice"><input type="checkbox" checked={keepPaperWorkflow} onChange={(event) => setKeepPaperWorkflow(event.target.checked)} /><span><BookOpenCheck size={18} /><span><strong>Conserver un parcours papier</strong><small>Le mobile permettra une saisie rapide sans supprimer vos habitudes du jour au lendemain.</small></span></span></label>}<div className="setup-result"><ShieldCheck size={18} /><span><strong>{setupResult(reservationMode).title}</strong><small>{setupResult(reservationMode).detail}</small></span></div></section>}

        {step === 3 && <section className="onboarding-step"><div className="form-section"><span className="form-section-number">03</span><div><h2>Vos priorités</h2><p>Choisissez jusqu’à quatre missions pour adapter le cockpit.</p></div></div><div className="goal-grid">{goals.map(([key, title, detail]) => <button type="button" key={key} className={selectedGoals.includes(key) ? "selected" : ""} onClick={() => toggleGoal(key)} aria-pressed={selectedGoals.includes(key)}><i>{selectedGoals.includes(key) && <Check size={13} />}</i><span><strong>{title}</strong><small>{detail}</small></span></button>)}</div><div className="onboarding-recap"><span><strong>{modes.find((mode) => mode.key === reservationMode)?.title}</strong><small>{selectedProviders.length ? selectedProviders.map((provider) => providers.find((item) => item.key === provider)?.label).join(" · ") : "Aucun outil externe requis"}</small></span><button type="button" onClick={() => setStep(2)}>Modifier</button></div><label className="legal-acceptance"><input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} /><span><ShieldCheck size={17} /><span>J’accepte les <Link href="/legal/terms" target="_blank" rel="noopener noreferrer">conditions du pilote</Link> et l’<Link href="/legal/dpa" target="_blank" rel="noopener noreferrer">accord de traitement des données</Link>. Je confirme pouvoir engager mon établissement.</span></span></label></section>}

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="onboarding-actions">{step > 1 ? <button type="button" className="secondary-button" onClick={() => { setError(""); setStep((current) => current - 1); }}><ArrowLeft size={16} /> Retour</button> : <span />}<button className="primary-button" disabled={!stepValid || busy}>{step < 3 ? <>Continuer <ArrowRight size={17} /></> : <>{busy ? "Création du cockpit…" : "Entrer dans mon cockpit"}<ArrowRight size={17} /></>}</button></footer>
      </form>
    </div>
  </main>;
}

function availableProviders(mode: ReservationMode) {
  if (mode === "software") return providers.filter((provider) => provider.kind !== "calendar");
  if (mode === "calendar") return providers.filter((provider) => provider.kind !== "software");
  if (mode === "hybrid") return providers;
  return [];
}

function operatingSetupValid(mode: ReservationMode, selected: Provider[], otherProvider: string) {
  if (["software", "calendar", "hybrid"].includes(mode) && selected.length === 0) return false;
  return !selected.includes("other") || otherProvider.trim().length > 1;
}

function introForStep(step: number) {
  if (step === 1) return { title: "Commençons par votre réalité.", detail: "Quelques informations suffisent pour créer un espace privé, immédiatement testable et modifiable." };
  if (step === 2) return { title: "TableNow apprend votre façon de travailler.", detail: "Aucun logiciel n’est obligatoire et le papier n’est pas un problème à contourner." };
  return { title: "Votre cockpit suivra vos priorités.", detail: "TableNow mettra d’abord en avant ce qui fait gagner du temps et sécurise le prochain service." };
}

function setupResult(mode: ReservationMode) {
  if (mode === "tablenow") return { title: "TableNow devient votre base de départ.", detail: "Vous pourrez connecter un autre outil plus tard sans perdre votre historique." };
  if (mode === "paper") return { title: "Le papier reste utilisable pendant la transition.", detail: "La saisie mobile réduit la double saisie sans imposer un changement brutal." };
  if (mode === "calendar") return { title: "Le calendrier sert de première passerelle.", detail: "TableNow structure les informations puis propose progressivement un pilotage plus riche." };
  if (mode === "hybrid") return { title: "TableNow réconcilie vos différentes sources.", detail: "Chaque action garde une source principale et un chemin de secours explicite." };
  return { title: "Votre logiciel reste la source de référence.", detail: "TableNow privilégie l’API quand elle existe et utilise le pilotage d’écran seulement en complément." };
}
