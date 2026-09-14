"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { OnboardingAnswers, OnboardingDraftView } from "@tablenow/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  Headphones,
  Languages,
  Mic,
  Moon,
  PencilLine,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Volume2,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { allPrioritiesSelected, priorityActivities, priorityOutcomes, toggleAllPriorities } from "@/lib/priority-selection";
import { BusinessSearch } from "./BusinessSearch";
import { ConversationInput } from "./ConversationInput";
import { onboardingCopy, labelFor, type OnboardingCopy } from "@/lib/onboarding-copy";
import {
  applyFreeText,
  confirmProvenanceForSection,
  confirmPriorityText,
  confirmReservationText,
  confirmStatement,
  defaultOperations,
  emptyOnboardingAnswers,
  firstResultTitle,
  hasPendingProvenance,
  inferPriorityCandidates,
  inferReservationProviders,
  mergeOnboardingAnswers,
  provenanceFor,
  reconcileReservationReference,
  removeStatement,
  reservationReferences,
  sectionValid,
  setPrimaryFocus,
  setReservationMethods,
  setReservationProviders,
  updateProvenanceForAnswerChange,
  type LocaleMode,
  type OnboardingProvenance,
  type OnboardingSourceType,
  type PrimaryFocus,
  type SectionKey,
} from "@/lib/onboarding";
import { useSession } from "@/hooks/useSession";
import { LoadingScreen } from "./LoadingScreen";
import { Brand } from "./Brand";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "failed" | "conflict";
type LoadState = "idle" | "loading" | "ready" | "failed";
type VoiceState = "idle" | "requesting_permission" | "recording" | "transcribing" | "reviewing" | "confirmed" | "cancelled" | "permission_denied" | "unavailable" | "failed";
type ConflictComparison = { local: OnboardingAnswers; localProvenance: OnboardingProvenance; remote: OnboardingDraftView };
type UpdateMeta = {
  sourceType?: OnboardingSourceType;
  sourceReference?: string;
  confirmationStatus?: OnboardingProvenance[number]["confirmationStatus"];
};

interface SpeechRecognitionResultLike { readonly 0: { readonly transcript: string } }
interface SpeechRecognitionEventLike { readonly results: ArrayLike<SpeechRecognitionResultLike> }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const sectionOrder: SectionKey[] = ["establishment", "priorities", "interaction", "reservations", "operations", "authority", "final_note", "review"];
const progressGroups: Array<{ key: string; sections: SectionKey[]; target: SectionKey }> = [
  { key: "establishment", sections: ["establishment"], target: "establishment" },
  { key: "priorities", sections: ["priorities", "interaction"], target: "priorities" },
  { key: "reservations", sections: ["reservations"], target: "reservations" },
  { key: "operations", sections: ["operations"], target: "operations" },
  { key: "authority", sections: ["authority", "final_note"], target: "authority" },
  { key: "review", sections: ["review"], target: "review" },
];

const timeConsumers = [...priorityActivities, "other"] as const;
const outcomes = priorityOutcomes;

type StepProps = {
  answers: OnboardingAnswers;
  copy: OnboardingCopy;
  locale: LocaleMode;
  update: (mutate: (current: OnboardingAnswers) => OnboardingAnswers, meta?: UpdateMeta) => void;
};

export function OnboardingFlow({ initialRestaurantId, initialSection }: { initialRestaurantId?: string; initialSection?: SectionKey }) {
  const router = useRouter();
  const { session, loading: sessionLoading, error: sessionError, refresh: refreshSession } = useSession({ requireOnboarding: true, allowCompletedOnboarding: true });
  const [draft, setDraft] = useState<OnboardingDraftView | null>(null);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => emptyOnboardingAnswers());
  const [provenance, setProvenance] = useState<OnboardingProvenance>([]);
  const [section, setSection] = useState<SectionKey>("establishment");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composer, setComposer] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceReview, setVoiceReview] = useState("");
  const [searchUnavailable, setSearchUnavailable] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptDpa, setAcceptDpa] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => safeIdempotencyKey());
  const [conflictComparison, setConflictComparison] = useState<ConflictComparison | null>(null);

  const draftRef = useRef<OnboardingDraftView | null>(null);
  const answersRef = useRef(answers);
  const provenanceRef = useRef(provenance);
  const sectionRef = useRef(section);
  const copyRef = useRef(onboardingCopy.fr);
  const dirtyRef = useRef(false);
  const changeVersionRef = useRef(0);
  const savingRef = useRef(false);
  const completingRef = useRef(false);
  const loadRequestRef = useRef(0);
  const initialNavigationUsedRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const saveNowRef = useRef<(target?: SectionKey) => Promise<OnboardingDraftView | null>>(async () => null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const locale = answers.interaction.locale;
  const copy = onboardingCopy[locale];
  copyRef.current = copy;

  const loadDraft = useCallback(async (restaurantId?: string) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoadState("loading");
    setError("");
    setNotice("");
    try {
      const query = restaurantId ? `?restaurantId=${encodeURIComponent(restaurantId)}` : "";
      const loaded = await api<OnboardingDraftView>(`/v1/onboarding${query}`);
      if (loadRequestRef.current !== requestId) return;
      if (loaded.status === "completed" && !initialSection) {
        router.replace("/today");
        return;
      }
      const loadedAnswers = mergeOnboardingAnswers(loaded.answers);
      const requestedSection = !initialNavigationUsedRef.current ? initialSection : undefined;
      const canOpenRequested = requestedSection
        && (loaded.status === "completed" || sectionOrder.indexOf(requestedSection) <= sectionOrder.indexOf(loaded.currentSection));
      const nextSection = canOpenRequested ? requestedSection : loaded.currentSection;
      initialNavigationUsedRef.current = true;
      draftRef.current = loaded;
      answersRef.current = loadedAnswers;
      provenanceRef.current = loaded.provenance;
      sectionRef.current = nextSection;
      dirtyRef.current = false;
      changeVersionRef.current = 0;
      setDraft(loaded);
      setAnswers(loadedAnswers);
      setProvenance(loaded.provenance);
      setSection(nextSection);
      setSaveState("saved");
      setSearchUnavailable(false);
      setManualOpen(!!loadedAnswers.establishment.cityCountry || loadedAnswers.establishment.identityConfirmed);
      setAcceptTerms(false);
      setAcceptDpa(false);
      setIdempotencyKey(safeIdempotencyKey());
      setConflictComparison(null);
      setLoadState("ready");
    } catch (caught) {
      if (loadRequestRef.current !== requestId) return;
      setLoadState("failed");
      setError(onboardingErrorMessage(caught, copyRef.current, "load"));
    }
  }, [initialSection]);

  useEffect(() => {
    if (session) void loadDraft(initialRestaurantId);
  }, [initialRestaurantId, loadDraft, session]);

  const saveNow = useCallback(async (target = sectionRef.current): Promise<OnboardingDraftView | null> => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return null;
    const shouldSave = dirtyRef.current || target !== currentDraft.currentSection;
    if (!shouldSave) return currentDraft;
    if (savingRef.current) return null;

    const capturedVersion = changeVersionRef.current;
    const capturedAnswers = structuredClone(answersRef.current);
    const capturedProvenance = provenanceFor(capturedAnswers, provenanceRef.current);
    savingRef.current = true;
    setSaveState("saving");
    setError("");
    try {
      const saved = await api<OnboardingDraftView>("/v1/onboarding", {
        method: "PATCH",
        body: JSON.stringify({
          restaurantId: currentDraft.restaurantId,
          expectedRevision: currentDraft.revision,
          currentSection: target,
          answers: capturedAnswers,
          provenance: capturedProvenance,
        }),
      });
      draftRef.current = saved;
      setDraft(saved);
      setConflictComparison(null);
      if (capturedVersion === changeVersionRef.current) {
        const normalized = mergeOnboardingAnswers(saved.answers);
        answersRef.current = normalized;
        provenanceRef.current = saved.provenance;
        dirtyRef.current = false;
        setAnswers(normalized);
        setProvenance(saved.provenance);
        setSaveState("saved");
      } else {
        setSaveState("dirty");
        window.setTimeout(() => { void saveNowRef.current(); }, 0);
      }
      return saved;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setSaveState("conflict");
        setError(copyRef.current.common.conflict);
      } else {
        setSaveState("failed");
        setError(copyRef.current.common.saveFailed);
      }
      return null;
    } finally {
      savingRef.current = false;
    }
  }, []);
  saveNowRef.current = saveNow;

  useEffect(() => {
    if (!draft || !dirtyRef.current || saveState !== "dirty") return;
    const timeout = window.setTimeout(() => { void saveNow(); }, 800);
    return () => window.clearTimeout(timeout);
  }, [answers, draft, saveNow, saveState, section]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = copyRef.current.common.dirty;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    cancelAudio(recognitionRef, setVoiceState, true);
  }, [section]);

  useEffect(() => () => {
    abortRecognition(recognitionRef);
  }, []);

  const updateAnswers = useCallback((mutate: (current: OnboardingAnswers) => OnboardingAnswers, meta: UpdateMeta = {}) => {
    const current = answersRef.current;
    const next = mutate(structuredClone(current));
    const currentSection = sectionRef.current;
    const sourceType = meta.sourceType || "user_form";
    const suggestedEstablishment = currentSection === "establishment" && !next.establishment.identityConfirmed;
    let nextProvenance = updateProvenanceForAnswerChange(
      provenanceRef.current,
      current,
      next,
      sourceType,
      meta.confirmationStatus || (sourceType === "user_form" && !suggestedEstablishment ? "confirmed" : "suggested"),
      meta.sourceReference,
    );
    if (sourceType === "user_form" && !sectionValid(currentSection, current) && sectionValid(currentSection, next)) {
      nextProvenance = confirmProvenanceForSection(nextProvenance, currentSection);
    }
    answersRef.current = next;
    provenanceRef.current = nextProvenance;
    changeVersionRef.current += 1;
    dirtyRef.current = true;
    setAnswers(next);
    setProvenance(nextProvenance);
    setSaveState("dirty");
    setError("");
    setNotice("");
  }, []);

  const moveTo = (target: SectionKey) => {
    sectionRef.current = target;
    setSection(target);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  const confirmCurrentInterpretation = () => {
    const confirmed = confirmProvenanceForSection(provenanceRef.current, sectionRef.current);
    if (confirmed.every((entry, index) => entry === provenanceRef.current[index])) return;
    provenanceRef.current = confirmed;
    changeVersionRef.current += 1;
    dirtyRef.current = true;
    setProvenance(confirmed);
    setSaveState("dirty");
    setError("");
  };

  const goTo = async (target: SectionKey) => {
    if (!sectionValid(sectionRef.current, answersRef.current)) {
      setError(validationMessage(sectionRef.current, copyRef.current));
      return;
    }
    if (hasPendingProvenance(provenanceRef.current, sectionRef.current)) {
      setError(copyRef.current.common.validationInterpretation);
      return;
    }
    const saved = await saveNow(target);
    if (saved) moveTo(target);
  };

  const goBack = async (target: SectionKey) => {
    const saved = await saveNow(target);
    if (saved) moveTo(target);
  };

  const compareConflict = async () => {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;
    setBusy(true);
    setError("");
    try {
      const remote = await api<OnboardingDraftView>(`/v1/onboarding?restaurantId=${encodeURIComponent(currentDraft.restaurantId)}`);
      setConflictComparison({ local: structuredClone(answersRef.current), localProvenance: structuredClone(provenanceRef.current), remote });
    } catch {
      setError(copyRef.current.common.loadFailed);
    } finally {
      setBusy(false);
    }
  };

  const keepLocalConflictVersion = () => {
    if (!conflictComparison) return;
    const local = structuredClone(conflictComparison.local);
    draftRef.current = conflictComparison.remote;
    answersRef.current = local;
    provenanceRef.current = conflictComparison.localProvenance;
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    setDraft(conflictComparison.remote);
    setAnswers(local);
    setProvenance(conflictComparison.localProvenance);
    setConflictComparison(null);
    setError("");
    setSaveState("dirty");
  };

  const useRemoteConflictVersion = () => {
    if (!conflictComparison) return;
    const remoteAnswers = mergeOnboardingAnswers(conflictComparison.remote.answers);
    draftRef.current = conflictComparison.remote;
    answersRef.current = remoteAnswers;
    provenanceRef.current = conflictComparison.remote.provenance;
    sectionRef.current = conflictComparison.remote.currentSection;
    dirtyRef.current = false;
    setDraft(conflictComparison.remote);
    setAnswers(remoteAnswers);
    setProvenance(conflictComparison.remote.provenance);
    setSection(conflictComparison.remote.currentSection);
    setConflictComparison(null);
    setError("");
    setSaveState("saved");
  };

  const changeRestaurant = async (restaurantId: string) => {
    if (restaurantId === draftRef.current?.restaurantId) return;
    const saved = await saveNow(sectionRef.current);
    if (!saved) return;
    cancelAudio(recognitionRef, setVoiceState, true);
    await loadDraft(restaurantId);
  };

  const complete = async () => {
    if (completingRef.current || !draftRef.current) return;
    if (!canComplete(session?.membership.role) || !acceptTerms || !acceptDpa) {
      setError(copy.common.validationGeneric);
      return;
    }
    completingRef.current = true;
    setBusy(true);
    setError("");
    const saved = await saveNow("review");
    if (!saved) {
      completingRef.current = false;
      setBusy(false);
      return;
    }
    try {
      await api("/v1/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: saved.restaurantId,
          expectedRevision: saved.revision,
          idempotencyKey,
          termsVersion: saved.legalVersions.terms,
          dpaVersion: saved.legalVersions.dpa,
          acceptTerms,
          acceptDpa,
        }),
      });
      await refreshSession();
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(onboardingErrorMessage(caught, copy, "complete"));
      setBusy(false);
      completingRef.current = false;
    }
  };

  const saveForAuthority = async () => {
    const saved = await saveNow("review");
    if (saved) setNotice(copy.common.authorityBlocked);
  };

  const startVoice = () => {
    if (recognitionRef.current) return;
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceState("unavailable");
      return;
    }
    setVoiceReview("");
    setVoiceState("requesting_permission");
    const recognition = new Recognition();
    let settled = false;
    recognition.lang = locale === "en" ? "en-US" : "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setVoiceState("recording");
    };
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      settled = true;
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ").trim();
      setVoiceReview(transcript);
      setVoiceState(transcript ? "reviewing" : "failed");
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      settled = true;
      abortRecognition(recognitionRef);
      setVoiceState(event.error === "not-allowed" || event.error === "service-not-allowed" ? "permission_denied" : "failed");
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!settled) setVoiceState("failed");
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      abortRecognition(recognitionRef);
      setVoiceState("failed");
    }
  };

  const stopVoice = () => {
    if (!recognitionRef.current) return;
    setVoiceState("transcribing");
    try {
      recognitionRef.current.stop();
    } catch {
      abortRecognition(recognitionRef);
      setVoiceState("failed");
    }
  };

  const useVoice = () => {
    if (!voiceReview.trim()) return;
    const text = sectionRef.current === "review" ? [answersRef.current.finalNote.text, voiceReview].filter(Boolean).join("\n\n") : voiceReview;
    if (text.length > 2000) {
      setError(locale === "fr" ? "La note complète dépasse 2 000 caractères. Raccourcissez-la avant de l’ajouter." : "The complete note exceeds 2,000 characters. Shorten it before adding it.");
      return;
    }
    if (sectionRef.current === "establishment") setManualOpen(true);
    updateAnswers((next) => applyFreeText(next, sectionRef.current === "review" ? "final_note" : sectionRef.current, text, "user_voice"), {
      sourceType: "user_voice",
      sourceReference: voiceReview,
      confirmationStatus: "suggested",
    });
    setVoiceReview("");
    setVoiceState("confirmed");
    if (sectionRef.current === "review") moveTo("final_note");
  };

  const cancelVoice = () => {
    abortRecognition(recognitionRef);
    setVoiceReview("");
    setVoiceState("cancelled");
  };

  if (sessionLoading) return <LoadingScreen label={copy.common.loading} />;
  if (!session) return <LoadFailure message={sessionError || copy.common.loadFailed} retry={() => void refreshSession()} copy={copy} />;
  if (loadState === "failed") return <LoadFailure message={error || copy.common.loadFailed} retry={() => void loadDraft(draftRef.current?.restaurantId || initialRestaurantId)} copy={copy} />;
  if (loadState !== "ready" || !draft) return <LoadingScreen label={copy.common.loading} />;

  const currentIndex = sectionOrder.indexOf(section);
  const nextSection = sectionOrder[Math.min(sectionOrder.length - 1, currentIndex + 1)]!;
  const previousSection = sectionOrder[Math.max(0, currentIndex - 1)]!;
  const currentGroupIndex = Math.max(0, progressGroups.findIndex((group) => group.sections.includes(section)));
  const userCanComplete = canComplete(session.membership.role);
  const canFinish = userCanComplete && acceptTerms && acceptDpa;
  const statusText = saveStatusText(saveState, copy);

  const isWelcome = section === "establishment";
  const identityOpen = manualOpen || !!answers.establishment.cityCountry || answers.establishment.identityConfirmed;

  return <main className={`onboarding-layout final-onboarding theme-${answers.interaction.theme}${isWelcome ? " welcome-onboarding" : ""}`} dir={copy.direction} lang={locale}>
    <div className={isWelcome ? "welcome-frame" : undefined}>
    <header className="onboarding-header final-onboarding-header">
      <Link href="/dashboard" aria-label="TableNow"><Brand /></Link>
      {isWelcome && <span className="welcome-stage"><i />{copy.sections.establishment}</span>}
      {draft.restaurants.length > 1 && <label className="restaurant-switcher"><Building2 size={14} /><span className="sr-only">{copy.common.selectRestaurant}</span><select value={draft.restaurantId} onChange={(event) => void changeRestaurant(event.target.value)}>{draft.restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label>}
      <div className="onboarding-top-controls">
        <label><Languages size={14} /><span className="sr-only">{copy.common.language}</span><select aria-label={copy.common.language} value={locale} onChange={(event) => updateAnswers((next) => { next.interaction.locale = event.target.value as LocaleMode; return next; })}><option value="fr">FR</option><option value="en">EN</option></select></label>
        <button type="button" className="icon-button tiny" aria-label={answers.interaction.theme === "dark" ? copy.common.clearTheme : copy.common.darkTheme} title={answers.interaction.theme === "dark" ? copy.common.clearTheme : copy.common.darkTheme} onClick={() => updateAnswers((next) => { next.interaction.theme = next.interaction.theme === "dark" ? "clear" : "dark"; return next; })}>{answers.interaction.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}</button>
      </div>
      <div className="onboarding-progress-line" aria-hidden="true">{progressGroups.map((group, index) => <span key={group.key} className={index <= currentGroupIndex ? "active" : ""} />)}</div>
    </header>

    <div className="onboarding-shell">
      {!isWelcome && <aside className="onboarding-rail" aria-label={copy.common.brand}>
        {progressGroups.map((group, index) => {
          const label = copy.sections[group.target];
          return <button key={group.key} type="button" className={index === currentGroupIndex ? "active" : index < currentGroupIndex ? "done" : ""} onClick={() => index < currentGroupIndex && void goBack(group.target)} disabled={index >= currentGroupIndex} aria-current={index === currentGroupIndex ? "step" : undefined}>{index < currentGroupIndex ? <Check size={13} /> : <span />}{label}</button>;
        })}
        <div className={`save-state save-${saveState}`} role="status" aria-live="polite">{statusText}{saveState === "failed" && <button type="button" onClick={() => void saveNow()}>{copy.common.retry}</button>}{saveState === "conflict" && <button type="button" onClick={() => void compareConflict()}>{copy.common.compare}</button>}</div>
      </aside>}

      <section className="onboarding-panel" aria-labelledby="onboarding-title">
        {draft.restaurants.length > 1 && <p className="inline-note restaurant-draft-note"><Building2 size={14} />{copy.common.restaurantChangeWarning}</p>}
        {section === "establishment" && <Establishment answers={answers} copy={copy} locale={locale} update={updateAnswers} identityOpen={identityOpen} openManual={() => setManualOpen(true)} confirmInterpretation={confirmCurrentInterpretation} searchUnavailable={searchUnavailable} search={() => setSearchUnavailable(true)} />}
        {section === "priorities" && <Priorities answers={answers} copy={copy} locale={locale} update={updateAnswers} confirmInterpretation={confirmCurrentInterpretation} branchNotice={() => setNotice(copy.common.branchReset)} />}
        {section === "interaction" && <Interaction answers={answers} copy={copy} locale={locale} update={updateAnswers} confirmInterpretation={confirmCurrentInterpretation} />}
        {section === "reservations" && <Reservations answers={answers} copy={copy} locale={locale} update={updateAnswers} confirmInterpretation={confirmCurrentInterpretation} />}
        {section === "operations" && <Operations answers={answers} copy={copy} locale={locale} update={updateAnswers} pendingInterpretation={hasPendingProvenance(provenance, "operations")} confirmInterpretation={confirmCurrentInterpretation} />}
        {section === "authority" && <Authority answers={answers} copy={copy} locale={locale} role={session.membership.role} userId={session.user.id} update={updateAnswers} pendingInterpretation={hasPendingProvenance(provenance, "authority")} confirmInterpretation={confirmCurrentInterpretation} />}
        {section === "final_note" && <FinalNote answers={answers} copy={copy} locale={locale} update={updateAnswers} />}
        {section === "review" && <Review answers={answers} copy={copy} locale={locale} role={session.membership.role} userId={session.user.id} legalVersions={draft.legalVersions} acceptTerms={acceptTerms} acceptDpa={acceptDpa} setAcceptTerms={setAcceptTerms} setAcceptDpa={setAcceptDpa} edit={moveTo} />}

        <Composer locale={locale} compact={isWelcome} value={composer} setValue={setComposer} voiceState={voiceState} voiceReview={voiceReview} copy={copy} onSend={() => {
          if (!composer.trim()) return;
          const text = sectionRef.current === "review" ? [answersRef.current.finalNote.text, composer].filter(Boolean).join("\n\n") : composer;
          if (text.length > 2000) {
            setError(locale === "fr" ? "La note complète dépasse 2 000 caractères. Raccourcissez-la avant de l’ajouter." : "The complete note exceeds 2,000 characters. Shorten it before adding it.");
            return;
          }
          if (sectionRef.current === "establishment") setManualOpen(true);
          updateAnswers((next) => applyFreeText(next, sectionRef.current === "review" ? "final_note" : sectionRef.current, text, "user_text"), {
            sourceType: "user_text",
            sourceReference: composer,
            confirmationStatus: "suggested",
          });
          setComposer("");
          if (sectionRef.current === "review") moveTo("final_note");
        }} onStart={startVoice} onStop={stopVoice} onUseVoice={useVoice} onCancelVoice={cancelVoice} />

        {conflictComparison && <ConflictView comparison={conflictComparison} copy={copy} useLocal={keepLocalConflictVersion} useRemote={useRemoteConflictVersion} />}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert"><AlertTriangle size={14} />{error}</p>}
        {(!isWelcome || identityOpen) && <footer className="onboarding-actions">
          {currentIndex > 0 ? <button type="button" className="secondary-button" disabled={saveState === "saving" || busy} onClick={() => void goBack(previousSection)}><ArrowLeft size={16} /> {copy.common.back}</button> : <span />}
          {section !== "review"
            ? <button type="button" className="primary-button" disabled={saveState === "saving" || busy} onClick={() => void goTo(nextSection)}>{copy.common.continue} <ArrowRight size={17} /></button>
            : userCanComplete
              ? <button type="button" className="primary-button" disabled={!canFinish || busy || saveState === "saving"} onClick={() => void complete()}>{busy ? copy.common.preparing : copy.common.finish} <ArrowRight size={17} /></button>
              : <button type="button" className="primary-button" disabled={busy || saveState === "saving"} onClick={() => void saveForAuthority()}>{copy.common.saveForReview} <ArrowRight size={17} /></button>}
        </footer>}
      </section>
    </div>
    {isWelcome && <div className="welcome-bottom"><div className={`save-state save-${saveState}`} role="status" aria-live="polite">{statusText}{saveState === "failed" && <button type="button" onClick={() => void saveNow()}>{copy.common.retry}</button>}{saveState === "conflict" && <button type="button" onClick={() => void compareConflict()}>{copy.common.compare}</button>}</div><div className="welcome-progress" role="progressbar" aria-label={copy.common.brand} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 / sectionOrder.length)}><span /></div></div>}
    </div>
    <h1 ref={headingRef} className="sr-only focus-heading" tabIndex={-1}>{copy.sections[section]}</h1>
  </main>;
}

function LoadFailure({ message, retry, copy }: { message: string; retry: () => void; copy: OnboardingCopy }) {
  return <main className="onboarding-layout final-onboarding"><section className="onboarding-load-error" role="alert"><AlertTriangle size={24} /><h1>{copy.common.loadFailed}</h1><p>{message}</p><button type="button" className="primary-button" onClick={retry}>{copy.common.retry}</button></section></main>;
}

function ConflictView({ comparison, copy, useLocal, useRemote }: { comparison: ConflictComparison; copy: OnboardingCopy; useLocal: () => void; useRemote: () => void }) {
  const differences = conflictDifferences(comparison.local, comparison.remote.answers);
  return <section className="conflict-comparison" aria-labelledby="conflict-title">
    <header><AlertTriangle size={18} /><div><h3 id="conflict-title">{copy.common.conflictTitle}</h3><p>{copy.common.conflict}</p></div></header>
    <div className="conflict-table" role="table">
      <div className="conflict-row conflict-head" role="row"><strong role="columnheader">{copy.common.changedField}</strong><strong role="columnheader">{copy.common.thisScreen}</strong><strong role="columnheader">{copy.common.serverVersion}</strong></div>
      {differences.length ? differences.map((difference) => <div className="conflict-row" role="row" key={difference.path}><code role="cell">{difference.path}</code><span role="cell">{difference.local}</span><span role="cell">{difference.remote}</span></div>) : <p>{copy.common.noConflictDifferences}</p>}
    </div>
    <footer><button type="button" className="secondary-button" onClick={useRemote}>{copy.common.useServer}</button><button type="button" className="primary-button" onClick={useLocal}>{copy.common.keepMine}</button></footer>
  </section>;
}

function Establishment({ answers, copy, update, identityOpen, openManual, confirmInterpretation, searchUnavailable, search }: StepProps & { identityOpen: boolean; openManual: () => void; confirmInterpretation: () => void; searchUnavailable: boolean; search: () => void }) {
  const establishment = answers.establishment;
  return <div className="onboarding-step establishment-step"><header className="welcome-heading"><h2 id="onboarding-title">{copy.common.welcome}</h2><p>{copy.common.establishmentSubtitle}</p></header>
    <BusinessSearch value={establishment.query || ""} english={answers.interaction.locale === "en"} onChange={(value) => update((next) => { next.establishment.query = value; next.establishment.identityConfirmed = false; return next; })} choose={(result) => { openManual(); update((next) => { next.establishment.identificationMode = "public_search"; next.establishment.restaurantName = result.name; next.establishment.cityCountry = result.cityCountry; next.establishment.address = result.address || "unknown"; next.establishment.phone = result.phone || "unknown"; next.establishment.identityConfirmed = false; next.establishment.sourceReferences = [{ label: result.sourceLabel || "Google Maps", value: result.sourceUrl, confirmationStatus: "suggested" }]; return next; }, { sourceType: "public_suggestion", sourceReference: result.sourceUrl, confirmationStatus: "suggested" }); }} />
    <button type="button" className="text-action welcome-manual" aria-expanded={identityOpen} onClick={() => { openManual(); update((next) => { next.establishment.identificationMode = "manual"; next.establishment.restaurantName ||= next.establishment.query || ""; next.establishment.identityConfirmed = false; return next; }); }}>{copy.common.addManually}</button>
    {!identityOpen && <div className="welcome-promises"><span><Check size={17} />{answers.interaction.locale === "fr" ? "Une seule information" : "One piece of information"}</span><i /><span><Sparkles size={17} />{answers.interaction.locale === "fr" ? "Source publique vérifiable" : "Verifiable public source"}</span><i /><span><Check size={17} />{answers.interaction.locale === "fr" ? "Vous confirmez" : "You confirm"}</span></div>}
    {identityOpen && <div className="welcome-identity">
    <div className="form-grid two"><label><span>{copy.common.restaurantName}</span><input required value={establishment.restaurantName || ""} onChange={(event) => update((next) => { next.establishment.identificationMode = "manual"; next.establishment.restaurantName = event.target.value; next.establishment.identityConfirmed = false; return next; })} /></label><label><span>{copy.common.cityCountry}</span><input required value={establishment.cityCountry || ""} onChange={(event) => update((next) => { next.establishment.cityCountry = event.target.value; next.establishment.identityConfirmed = false; return next; })} placeholder={copy.common.cityPlaceholder} /></label></div>
    <div className="form-grid two"><label><span>{copy.common.address}</span><input value={knownInput(establishment.address)} onChange={(event) => update((next) => { next.establishment.address = event.target.value || "unknown"; next.establishment.identityConfirmed = false; return next; })} placeholder={copy.common.addressPlaceholder} /></label><label><span>{copy.common.phone}</span><input type="tel" value={knownInput(establishment.phone)} onChange={(event) => update((next) => { next.establishment.phone = event.target.value || "unknown"; next.establishment.identityConfirmed = false; return next; })} placeholder={copy.common.optional} /></label></div>
    <label><span>{copy.common.timezone}</span><input value={establishment.timezone || ""} onChange={(event) => update((next) => { if (event.target.value) next.establishment.timezone = event.target.value; else delete next.establishment.timezone; next.establishment.identityConfirmed = false; return next; })} placeholder={copy.common.timezonePlaceholder} /></label>
    <fieldset className="question-block"><legend>{copy.common.siteCount}</legend><div className="inline-choice">{(["single", "multiple", "unknown"] as const).map((value) => <button type="button" key={value} aria-pressed={establishment.siteCount === value} className={establishment.siteCount === value ? "selected" : ""} onClick={() => update((next) => { next.establishment.siteCount = value; return next; })}>{value === "single" ? "1" : value === "multiple" ? copy.common.multiRestaurant : labelFor(answers.interaction.locale, "unknown")}</button>)}</div></fieldset>
    <div className="confirm-box"><Building2 size={18} /><span><strong>{copy.common.found}</strong><small>{establishment.sourceReferences.length ? establishment.sourceReferences.map((item) => `${item.label}: ${item.value}`).join(" · ") : copy.common.manualToConfirm}</small></span><button type="button" disabled={!establishment.restaurantName?.trim() || !establishment.cityCountry?.trim()} onClick={() => { update((next) => { next.establishment.identityConfirmed = true; next.establishment.sourceReferences = next.establishment.sourceReferences.map((item) => ({ ...item, confirmationStatus: "confirmed" })); return next; }); confirmInterpretation(); }}>{copy.common.confirmInformation}</button></div>
    </div>}
  </div>;
}

function Priorities({ answers, copy, locale, update, confirmInterpretation, branchNotice }: StepProps & { confirmInterpretation: () => void; branchNotice: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const allSelected = allPrioritiesSelected(answers.priorities);
  const textCandidates = inferPriorityCandidates(answers.priorities.otherText || "");
  const primaryOptions = priorityOptions(answers);
  const changeFocus = (next: OnboardingAnswers, focus: PrimaryFocus) => {
    if (setPrimaryFocus(next, focus)) branchNotice();
  };
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="priorityEyebrow" title="priorityTitle" subtitle="priorityQuestion" promise="priorityPromise" />
    <div className="priority-toolbar"><button type="button" className="priority-select-all" onClick={() => update((next) => { toggleAllPriorities(next.priorities); return next; })}>{locale === "fr" ? allSelected ? "Tout désélectionner" : "Tout sélectionner" : allSelected ? "Deselect all" : "Select all"}</button></div>
    <div className="choice-grid" id="priority-choices">{timeConsumers.filter((key, index) => expanded || index < 3 || answers.priorities.timeConsumers.includes(key)).map((key) => <ToggleCard key={key} selected={answers.priorities.timeConsumers.includes(key)} onClick={() => update((next) => {
      next.priorities.scope = "targeted";
      next.priorities.timeConsumers = toggle(next.priorities.timeConsumers, key);
      const focuses = next.priorities.timeConsumers.map(timeConsumerToFocus);
      if (focuses.length === 1) changeFocus(next, focuses[0]!);
      else if (!focuses.includes(next.priorities.primaryFocus as PrimaryFocus)) next.priorities.primaryFocus = undefined;
      return next;
    })} title={labelFor(locale, key)} />)}<button type="button" className="priority-expand" aria-expanded={expanded} aria-controls="priority-choices priority-outcomes" aria-label={locale === "fr" ? expanded ? "Réduire la liste" : "Afficher les autres enjeux" : expanded ? "Show fewer priorities" : "Show more priorities"} onClick={() => setExpanded(value => !value)}>{expanded ? "−" : "+"}</button></div>
    {answers.priorities.timeConsumers.includes("other") && <label><span>{copy.common.otherSituation}</span><textarea rows={3} value={answers.priorities.otherText || ""} onChange={(event) => update((next) => { next.priorities.otherText = event.target.value; return next; })} /></label>}
    {!!textCandidates.length && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.priorityInterpretation}</strong><small>{textCandidates.map((candidate) => labelFor(locale, candidate)).join(" · ")}</small></span><button type="button" onClick={() => { update((next) => { const previous = next.priorities.primaryFocus; const candidates = confirmPriorityText(next); if (candidates.length === 1 && previous && previous !== candidates[0]) branchNotice(); return next; }); confirmInterpretation(); }}>{copy.common.confirm}</button></div>}
    <div id="priority-outcomes" hidden={!expanded}><p>{copy.common.desiredOutcomes}</p><div className="choice-grid compact">{outcomes.map((key) => <ToggleCard key={key} selected={answers.priorities.outcomes.includes(key)} onClick={() => update((next) => { next.priorities.outcomes = toggle(next.priorities.outcomes, key); return next; })} title={labelFor(locale, key)} />)}</div></div>
    <p className="subtle-note" role="status">{answers.priorities.timeConsumers.length + answers.priorities.outcomes.length} {locale === "fr" ? "choix sélectionnés" : "choices selected"}</p>
    {primaryOptions.length > 1 && <label><span>{copy.common.startWith}</span><select value={answers.priorities.primaryFocus || ""} onChange={(event) => update((next) => { changeFocus(next, event.target.value as PrimaryFocus); return next; })}><option value="">{copy.common.startWith}</option>{primaryOptions.map((key) => <option key={key} value={key}>{labelFor(locale, key)}</option>)}</select></label>}
  </div>;
}

function Interaction({ answers, copy, locale, update, confirmInterpretation }: StepProps & { confirmInterpretation: () => void }) {
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="interactionEyebrow" title="interactionTitle" subtitle="interactionHelp" />
    <div className="choice-grid three">{(["text", "voice", "mixed"] as const).map((mode) => <ToggleCard key={mode} selected={answers.interaction.preferredMode === mode} onClick={() => update((next) => { next.interaction.preferredMode = mode; next.interaction.preferredModeConfirmed = true; return next; })} title={labelFor(locale, mode)} icon={mode === "voice" ? <Mic /> : mode === "mixed" ? <Headphones /> : <PencilLine />} />)}</div>
    {!answers.interaction.preferredModeConfirmed && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.interactionInterpretation}</strong><small>{labelFor(locale, answers.interaction.preferredMode)}</small></span><button type="button" onClick={() => { update((next) => { next.interaction.preferredModeConfirmed = true; return next; }); confirmInterpretation(); }}>{copy.common.confirm}</button></div>}
    <p className="subtle-note">{locale === "fr" ? "Dictez à votre rythme, relisez le texte, puis validez. TableNow ne parle pas à voix haute et n’envoie rien automatiquement." : "Dictate at your own pace, review the text, then confirm. TableNow does not speak aloud or send anything automatically."}</p>
  </div>;
}

function Reservations({ answers, copy, locale, update, confirmInterpretation }: StepProps & { confirmInterpretation: () => void }) {
  const references = reservationReferences(answers);
  const inferred = inferReservationProviders(answers.reservations.otherMethod || "");
  const toggleProvider = (provider: OnboardingAnswers["reservations"]["providers"][number]) => update((next) => {
    setReservationProviders(next, toggle(next.reservations.providers, provider));
    return next;
  });
  const toggleMethod = (method: OnboardingAnswers["reservations"]["methods"][number]) => update((next) => {
    const current = next.reservations.methods.filter((value) => value !== "none" && value !== "software");
    setReservationMethods(next, method === "none" ? ["none"] : toggle(current, method).concat(next.reservations.providers.length ? ["software"] : []));
    return next;
  });
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="reservationsEyebrow" title="reservationsTitle" />
    <div className="choice-grid">{(["zenchef", "sevenrooms", "thefork", "other"] as const).map((provider) => <ToggleCard key={provider} selected={answers.reservations.providers.includes(provider)} onClick={() => toggleProvider(provider)} title={labelFor(locale, provider)} />)}<ToggleCard selected={!answers.reservations.providers.length && answers.reservations.methods.length > 0} onClick={() => update((next) => { setReservationProviders(next, []); setReservationMethods(next, ["none"]); return next; })} title={labelFor(locale, "no_software")} /></div>
    {answers.reservations.providers.includes("other") && <label><span>{copy.common.otherTool}</span><input value={answers.reservations.otherProvider || ""} onChange={(event) => update((next) => { next.reservations.otherProvider = event.target.value; reconcileReservationReference(next); return next; })} /></label>}
    <details className="onboarding-details" open={!answers.reservations.providers.length}><summary>{copy.common.whereReservations}</summary><div className="choice-grid compact">{(["paper", "calendar", "messages", "none", "other"] as const).map((method) => <ToggleCard key={method} selected={answers.reservations.methods.includes(method)} onClick={() => toggleMethod(method)} title={labelFor(locale, method)} />)}</div></details>
    {answers.reservations.methods.includes("calendar") && <label><span>{copy.common.calendar}</span><select value={answers.reservations.calendarProvider || ""} onChange={(event) => update((next) => { if (event.target.value) next.reservations.calendarProvider = event.target.value as "google_calendar" | "outlook" | "other"; else delete next.reservations.calendarProvider; reconcileReservationReference(next); return next; })}><option value="">{labelFor(locale, "unknown")}</option><option value="google_calendar">Google Calendar</option><option value="outlook">Outlook</option><option value="other">{labelFor(locale, "other")}</option></select></label>}
    {answers.reservations.methods.includes("other") && <label><span>{copy.common.otherMethod}</span><input value={answers.reservations.otherMethod || ""} onChange={(event) => update((next) => { next.reservations.otherMethod = event.target.value; reconcileReservationReference(next); return next; })} /></label>}
    {!!inferred.length && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.interpretationSummary}</strong><small>{inferred.map((provider) => labelFor(locale, provider)).join(" · ")}</small></span><button type="button" onClick={() => { update((next) => { confirmReservationText(next); return next; }); confirmInterpretation(); }}>{copy.common.confirm}</button></div>}
    {references.length > 1 && <label><span>{copy.common.referenceSystem}</span><select value={answers.reservations.authoritativeSystem} onChange={(event) => update((next) => { next.reservations.authoritativeSystem = event.target.value; return next; })}><option value="unknown">{copy.common.toAssign}</option>{references.map((reference) => <option key={reference} value={reference}>{labelFor(locale, reference)}</option>)}</select><small>{copy.common.referenceHelp}</small></label>}
    <div className="declared-state"><ShieldCheck size={17} /><span><strong>{copy.common.declared}</strong><small>{copy.common.notConnectedHelp}</small></span></div>
  </div>;
}

function Operations({ answers, copy, locale, update, pendingInterpretation, confirmInterpretation }: StepProps & { pendingInterpretation: boolean; confirmInterpretation: () => void }) {
  const focus = answers.priorities.primaryFocus || "global";
  const capturedText = operationCapturedText(answers);
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="operationEyebrow" title="operationTitle" subtitle="operationSubtitle" />
    {focus === "customer_communication" && <CommunicationBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {focus === "reservations" && <ReservationBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {focus === "team" && <TeamBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {focus === "supplier_orders" && <SupplierBranch answers={answers} copy={copy} locale={locale} update={update} confirmInterpretation={confirmInterpretation} />}
    {focus === "operations" && <ServiceBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {(["profitability", "occupancy", "customer_loyalty"] as Array<PrimaryFocus | undefined>).includes(focus) && <BusinessBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {(focus === "global" || focus === "other") && <GlobalBranch answers={answers} copy={copy} locale={locale} update={update} />}
    {capturedText && <p className="captured-answer"><strong>{copy.common.capturedText}</strong>{capturedText}</p>}
    {pendingInterpretation && focus !== "supplier_orders" && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.interpretationSummary}</strong><small>{capturedText}</small></span><button type="button" onClick={confirmInterpretation}>{copy.common.confirm}</button></div>}
  </div>;
}

function CommunicationBranch({ answers, copy, locale, update }: StepProps) {
  const branch = answers.operations.communications;
  return <><Question title={branchQuestion(locale, "communicationChannels")} options={["calls", "whatsapp", "emails", "instagram", "sms", "other"]} values={branch.channels} update={(values) => update((next) => { next.operations.communications.channels = values as typeof branch.channels; if (!values.includes("calls")) { delete next.operations.communications.phoneNumber; next.operations.communications.overflowTriggers = []; } return next; })} locale={locale} />
    <Question title={branchQuestion(locale, "communicationMoment")} options={["during_service", "when_team_unavailable", "outside_hours", "other"]} values={branch.peakContext} update={(values) => update((next) => { next.operations.communications.peakContext = values as typeof branch.peakContext; return next; })} locale={locale} />
    {branch.channels.includes("calls") && <><p className="inline-note">{copy.common.keepNumber} {copy.common.noForwarding}</p><label><span>{copy.common.phoneOptional}</span><input type="tel" value={knownInput(branch.phoneNumber)} onChange={(event) => update((next) => { next.operations.communications.phoneNumber = event.target.value || "unknown"; return next; })} /></label><Question title={copy.common.overflowTriggers} options={["busy_line", "no_answer", "outside_hours"]} values={branch.overflowTriggers} update={(values) => update((next) => { next.operations.communications.overflowTriggers = values as typeof branch.overflowTriggers; return next; })} locale={locale} /></>}
    <Question title={copy.common.humanReview} options={["groups", "allergies_sensitive", "privatizations", "complaints", "other"]} values={branch.humanReviewCategories} update={(values) => update((next) => { next.operations.communications.humanReviewCategories = values as typeof branch.humanReviewCategories; return next; })} locale={locale} optional />
  </>;
}

function ReservationBranch({ answers, copy, locale, update }: StepProps) {
  const branch = answers.operations.reservations;
  return <><Question title={branchQuestion(locale, "reservationFriction")} options={["taking_reservations", "changes_cancellations", "groups", "special_requests", "no_shows", "other"]} values={branch.friction} update={(values) => update((next) => { next.operations.reservations.friction = values as typeof branch.friction; if (!values.includes("groups")) delete next.operations.reservations.groupApprovalThreshold; if (!values.includes("no_shows")) { delete next.operations.reservations.confirmationRuleStatus; delete next.operations.reservations.confirmationRuleText; } return next; })} locale={locale} />
    {branch.friction.includes("groups") && <label><span>{copy.common.groupThreshold}</span><div className="input-with-unknown"><input type="number" min="1" max="100" value={typeof branch.groupApprovalThreshold === "number" ? branch.groupApprovalThreshold : ""} onChange={(event) => update((next) => { next.operations.reservations.groupApprovalThreshold = event.target.value ? Number(event.target.value) : "unknown"; return next; })} /><button type="button" onClick={() => update((next) => { next.operations.reservations.groupApprovalThreshold = "unknown"; return next; })}>{copy.common.defineLater}</button></div></label>}
    {branch.friction.includes("no_shows") && <><Question single title={copy.common.confirmationRule} options={["yes", "no", "to_define"]} values={branch.confirmationRuleStatus ? [branch.confirmationRuleStatus] : []} update={(values) => update((next) => { next.operations.reservations.confirmationRuleStatus = values[0] as typeof branch.confirmationRuleStatus; if (values[0] !== "yes") delete next.operations.reservations.confirmationRuleText; return next; })} locale={locale} />{branch.confirmationRuleStatus === "yes" && <label><span>{copy.common.confirmationRuleDetails}</span><textarea rows={3} value={branch.confirmationRuleText || ""} onChange={(event) => update((next) => { next.operations.reservations.confirmationRuleText = event.target.value; return next; })} /></label>}</>}
  </>;
}

function TeamBranch({ answers, copy, locale, update }: StepProps) {
  const branch = answers.operations.team;
  return <><Question title={branchQuestion(locale, "teamFriction")} options={["planning", "absences", "tasks", "floor_kitchen_coordination", "other"]} values={branch.friction} update={(values) => update((next) => { next.operations.team.friction = values as typeof branch.friction; return next; })} locale={locale} />
    <Question title={branchQuestion(locale, "teamStations")} options={["floor", "kitchen", "bar", "host_reservations", "other"]} values={branch.stations} update={(values) => update((next) => { next.operations.team.stations = values as typeof branch.stations; return next; })} locale={locale} />
    <label><span>{copy.common.teamHeadcount}</span><div className="input-with-unknown"><input type="number" min="1" max="500" value={typeof branch.headcount === "number" ? branch.headcount : ""} onChange={(event) => update((next) => { next.operations.team.headcount = event.target.value ? Number(event.target.value) : "unknown"; return next; })} /><button type="button" onClick={() => update((next) => { next.operations.team.headcount = "unknown"; return next; })}>{labelFor(locale, "unknown")}</button></div></label>
  </>;
}

function SupplierBranch({ answers, copy, locale, update, confirmInterpretation }: StepProps & { confirmInterpretation: () => void }) {
  const branch = answers.operations.suppliers;
  const item = branch.items[0] || {};
  const pending = branch.unknownFields.includes("proposal_pending");
  const updateItem = (change: Partial<typeof item>) => update((next) => { next.operations.suppliers.items[0] = { ...next.operations.suppliers.items[0], ...change }; return next; });
  return <><Question single title={branchQuestion(locale, "supplierIntent")} options={["prepare_order", "monitor_stock", "prepare_delivery", "other"]} values={branch.intent ? [branch.intent] : []} update={(values) => update((next) => { next.operations.suppliers.intent = values[0] as typeof branch.intent; return next; })} locale={locale} />
    <div className="form-grid three"><label><span>{copy.common.supplierProduct}</span><input value={item.name || ""} onChange={(event) => updateItem({ name: event.target.value || undefined })} /></label><label><span>{copy.common.quantity}</span><input type="number" min="0.001" step="0.001" value={item.quantity ?? ""} onChange={(event) => updateItem({ quantity: event.target.value ? Number(event.target.value) : undefined })} /></label><label><span>{copy.common.unit}</span><input value={item.unit || ""} onChange={(event) => updateItem({ unit: event.target.value || undefined })} /></label></div>
    {branch.intent === "monitor_stock" && <div className="form-grid two"><label><span>{copy.common.stockQuantity}</span><input type="number" min="0" step="0.001" value={item.stockQuantity ?? ""} onChange={(event) => updateItem({ stockQuantity: event.target.value === "" ? undefined : Number(event.target.value) })} /></label><label><span>{copy.common.reorderThreshold}</span><input type="number" min="0" step="0.001" value={item.reorderThreshold ?? ""} onChange={(event) => updateItem({ reorderThreshold: event.target.value === "" ? undefined : Number(event.target.value) })} /></label></div>}
    <div className="form-grid two"><label><span>{copy.common.supplier}</span><input value={knownInput(branch.supplierName)} onChange={(event) => update((next) => { next.operations.suppliers.supplierName = event.target.value || "unknown"; return next; })} placeholder={labelFor(locale, "unknown")} /></label><label><span>{copy.common.deliveryDate}</span><input type="date" value={knownInput(branch.deliveryDate)} onChange={(event) => update((next) => { next.operations.suppliers.deliveryDate = event.target.value || "unknown"; next.operations.suppliers.unknownFields = next.operations.suppliers.unknownFields.filter((field) => !field.startsWith("deliveryDate:")); return next; })} /></label></div>
    {knownInput(branch.deliveryDate) && <label><span>{copy.common.deliveryTimezone}</span><input value={branch.deliveryTimeZone || answers.establishment.timezone || ""} onChange={(event) => update((next) => { if (event.target.value) next.operations.suppliers.deliveryTimeZone = event.target.value; else delete next.operations.suppliers.deliveryTimeZone; return next; })} placeholder={copy.common.timezonePlaceholder} /></label>}
    {branch.unknownFields.some((field) => field.startsWith("deliveryDate:")) && <p className="inline-error"><AlertTriangle size={14} />{copy.common.absoluteDateHelp}</p>}
    {pending && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.confirmExtraction}</strong><small>{item.quantity} {item.unit} · {item.name}</small></span><button type="button" onClick={() => { update((next) => { next.operations.suppliers.unknownFields = next.operations.suppliers.unknownFields.filter((field) => field !== "proposal_pending"); return next; }); confirmInterpretation(); }}>{copy.common.confirm}</button></div>}
    <p className="inline-note">{copy.common.noExternalOrder}</p>
  </>;
}

function ServiceBranch({ answers, copy, locale, update }: StepProps) {
  const branch = answers.operations.service;
  return <><Question single title={branchQuestion(locale, "servicePhase")} options={["before_service", "during_service", "after_service", "other"]} values={branch.phase ? [branch.phase] : []} update={(values) => update((next) => { next.operations.service.phase = values[0] as typeof branch.phase; return next; })} locale={locale} />
    <Question title={branchQuestion(locale, "serviceCheck")} options={["mise_en_place", "coordination", "special_requests", "closing", "other"]} values={branch.checks} update={(values) => update((next) => { next.operations.service.checks = values as typeof branch.checks; return next; })} locale={locale} />
    <Question single title={copy.common.scheduleStatus} options={["known", "unknown", "no_fixed_schedule"]} values={branch.scheduleStatus ? [branch.scheduleStatus] : []} update={(values) => update((next) => { next.operations.service.scheduleStatus = values[0] as typeof branch.scheduleStatus; if (values[0] !== "known") { next.operations.service.nextServiceAt = values[0] === "no_fixed_schedule" ? "not_applicable" : "unknown"; delete next.operations.service.timezone; } return next; })} locale={locale} optional />
    {branch.scheduleStatus === "known" && <div className="form-grid two"><label><span>{copy.common.nextService}</span><input value={knownInput(branch.nextServiceAt)} onChange={(event) => update((next) => { next.operations.service.nextServiceAt = event.target.value || "unknown"; return next; })} placeholder="2026-09-11T19:00:00+02:00" /></label><label><span>{copy.common.serviceTimezone}</span><input value={branch.timezone || answers.establishment.timezone || ""} onChange={(event) => update((next) => { if (event.target.value) next.operations.service.timezone = event.target.value; else delete next.operations.service.timezone; return next; })} placeholder={copy.common.timezonePlaceholder} /></label></div>}
  </>;
}

function BusinessBranch({ answers, copy, locale, update }: StepProps) {
  const focus = answers.priorities.primaryFocus;
  const branch = answers.operations.business;
  if (focus === "profitability") return <><Question single title={branchQuestion(locale, "profitabilityFocus")} options={["purchases", "team", "waste", "unknown"]} values={branch.focus ? [branch.focus] : []} update={(values) => update((next) => { next.operations.business.focus = values[0] as typeof branch.focus; return next; })} locale={locale} /><label><span>{copy.common.knownSources}</span><input value={branch.knownDataSources.join(", ")} onChange={(event) => update((next) => { next.operations.business.knownDataSources = splitList(event.target.value); return next; })} /></label></>;
  if (focus === "occupancy") return <><label><span>{copy.common.targetServices}</span><input value={branch.targetServices.join(", ")} onChange={(event) => update((next) => { next.operations.business.targetServices = splitList(event.target.value); return next; })} placeholder={copy.common.targetServicesPlaceholder} /></label><label><span>{copy.common.knownSources}</span><input value={branch.knownDataSources.join(", ")} onChange={(event) => update((next) => { next.operations.business.knownDataSources = splitList(event.target.value); return next; })} /></label></>;
  return <><Question single title={branchQuestion(locale, "loyaltyFocus")} options={["regulars", "requests_followup", "next_contacts", "unknown"]} values={branch.focus ? [branch.focus] : []} update={(values) => update((next) => { next.operations.business.focus = values[0] as typeof branch.focus; return next; })} locale={locale} /><label><span>{copy.common.knownSources}</span><input value={branch.knownDataSources.join(", ")} onChange={(event) => update((next) => { next.operations.business.knownDataSources = splitList(event.target.value); return next; })} /></label></>;
}

function GlobalBranch({ answers, copy, locale, update }: StepProps) {
  return <><Question single title={branchQuestion(locale, "globalMoment")} options={["before_service", "during_service", "after_service", "overview"]} values={answers.operations.global.startingMoment ? [answers.operations.global.startingMoment] : []} update={(values) => update((next) => { next.operations.global.startingMoment = values[0] as typeof next.operations.global.startingMoment; return next; })} locale={locale} />
    <label><span>{copy.common.globalSummary}</span><textarea rows={3} value={answers.operations.global.confirmedSummary || ""} onChange={(event) => update((next) => { next.operations.global.confirmedSummary = event.target.value; return next; })} /></label>
  </>;
}

function Authority({ answers, copy, locale, role, userId, update, pendingInterpretation, confirmInterpretation }: StepProps & { role: string; userId: string; pendingInterpretation: boolean; confirmInterpretation: () => void }) {
  const allowed = canComplete(role);
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="authorityEyebrow" title="authorityTitle" subtitle="authoritySubtitle" />
    <div className="declared-state"><ShieldCheck size={17} /><span><strong>{copy.common.serverRole}: {labelFor(locale, role)}</strong><small>{copy.common.roleHelp}</small></span></div>
    {!allowed && <p className="form-error" role="alert">{copy.common.authorityBlocked}</p>}
    <label><span>{copy.common.jobTitle}</span><select value={answers.authority.declaredJobTitle || ""} onChange={(event) => update((next) => { if (event.target.value) next.authority.declaredJobTitle = event.target.value as typeof next.authority.declaredJobTitle; else delete next.authority.declaredJobTitle; return next; })}><option value="">{copy.common.toAssign}</option>{["owner", "general_management", "station_manager", "team", "other"].map((value) => <option value={value} key={value}>{labelFor(locale, value)}</option>)}</select></label>
    {(answers.authority.declaredJobTitle === "station_manager" || answers.authority.station) && <label><span>{copy.common.station}</span><input value={answers.authority.station || ""} onChange={(event) => update((next) => { if (event.target.value) next.authority.station = event.target.value; else delete next.authority.station; return next; })} /></label>}
    <label><span>{copy.common.validationRecipient}</span><select value={answers.authority.approvalAssigneeUserId || "unknown"} onChange={(event) => update((next) => { next.authority.approvalAssigneeUserId = event.target.value; return next; })}><option value="unknown">{copy.common.toAssign}</option>{allowed && <option value={userId}>{copy.common.me}</option>}</select></label>
    <label className="paper-choice"><input type="checkbox" checked={answers.authority.rulesAcknowledged} onChange={(event) => update((next) => { next.authority.rulesAcknowledged = event.target.checked; return next; })} /><span><ClipboardCheck size={17} /><span><strong>{copy.common.rulesAcknowledged}</strong><small>{copy.common.rulesHelp}</small></span></span></label>
    {pendingInterpretation && <div className="confirm-box"><Sparkles size={17} /><span><strong>{copy.common.interpretationSummary}</strong><small>{answers.authority.station}</small></span><button type="button" onClick={confirmInterpretation}>{copy.common.confirm}</button></div>}
  </div>;
}

function FinalNote({ answers, copy, locale, update }: StepProps) {
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="finalNoteEyebrow" title="finalNoteTitle" subtitle="finalNoteSubtitle" />
    <label><span>{copy.common.note}</span><textarea rows={5} value={answers.finalNote.text || ""} maxLength={2000} onChange={(event) => update((next) => applyFreeText(next, "final_note", event.target.value, "user_text"), { sourceType: "user_text", sourceReference: event.target.value, confirmationStatus: "suggested" })} placeholder={copy.common.notePlaceholder} /></label>
    {!!answers.finalNote.conflicts.length && <div className="inline-error" role="alert"><AlertTriangle size={15} /><span>{copy.common.whichCorrect}</span></div>}
    {!!answers.finalNote.statements.length && <div className="statement-list"><strong>{copy.common.understood}</strong>{answers.finalNote.statements.map((statement) => <article key={statement.id} className={`statement-${statement.status}`}><span><small>{labelFor(locale, statement.kind)}</small>{statement.value}</span><div>{statement.status !== "confirmed" && statement.status !== "rejected" && <button type="button" onClick={() => update((next) => { confirmStatement(next, statement.id); return next; })}>{copy.common.confirm}</button>}<button type="button" onClick={() => update((next) => { removeStatement(next, statement.id); return next; })}>{copy.common.remove}</button></div></article>)}</div>}
  </div>;
}

function Review({ answers, copy, locale, role, userId, legalVersions, acceptTerms, acceptDpa, setAcceptTerms, setAcceptDpa, edit }: {
  answers: OnboardingAnswers;
  copy: OnboardingCopy;
  locale: LocaleMode;
  role: string;
  userId: string;
  legalVersions: OnboardingDraftView["legalVersions"];
  acceptTerms: boolean;
  acceptDpa: boolean;
  setAcceptTerms: (value: boolean) => void;
  setAcceptDpa: (value: boolean) => void;
  edit: (section: SectionKey) => void;
}) {
  const allowed = canComplete(role);
  return <div className="onboarding-step"><StepHead copy={copy} eyebrow="reviewEyebrow" title="reviewTitle" subtitle="reviewSubtitle" />
    <div className="review-list">{reviewRows(answers, copy, locale, userId).map((row) => <article key={`${row.section}-${row.label}`}><span><strong>{row.label}</strong><small>{row.value}</small></span><button type="button" onClick={() => edit(row.section)}>{copy.common.edit}</button></article>)}</div>
    <div className="first-result-preview"><Sparkles size={19} /><span><strong>{localizedFirstResultTitle(answers, locale)}</strong><small>{copy.common.preparedFromAnswers} {copy.common.unknownRemain}</small></span></div>
    <label className="legal-acceptance"><input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} /><span>{copy.common.acceptTermsPrefix} <Link href="/legal/terms" target="_blank" rel="noopener noreferrer">{copy.common.terms}</Link> {legalVersions.terms}{copy.common.acceptTermsSuffix}</span></label>
    {allowed && <label className="legal-acceptance"><input type="checkbox" checked={acceptDpa} onChange={(event) => setAcceptDpa(event.target.checked)} /><span>{copy.common.acceptDpaPrefix} <Link href="/legal/dpa" target="_blank" rel="noopener noreferrer">{copy.common.dpa}</Link> {legalVersions.dpa}{copy.common.acceptDpaSuffix}</span></label>}
    {!allowed && <p className="form-error" role="alert">{copy.common.authorityBlocked}</p>}
  </div>;
}

function StepHead({ copy, eyebrow, title, subtitle, promise }: { copy: OnboardingCopy; eyebrow: keyof OnboardingCopy["common"]; title: keyof OnboardingCopy["common"]; subtitle?: keyof OnboardingCopy["common"]; promise?: keyof OnboardingCopy["common"] }) {
  return <header className="form-section final-step-head"><span className="form-section-number">{copy.common[eyebrow]}</span><div><h2 id="onboarding-title">{copy.common[title]}</h2>{subtitle && <p>{copy.common[subtitle]}</p>}{promise && <small>{copy.common[promise]}</small>}</div></header>;
}

function ToggleCard({ title, selected, onClick, icon, disabled = false }: { title: string; selected: boolean; onClick: () => void; icon?: ReactNode; disabled?: boolean }) {
  return <button type="button" className={selected ? "selected" : ""} disabled={disabled} aria-pressed={selected} onClick={onClick}><span>{icon || (selected ? <Check size={15} /> : <Square size={15} />)}</span><strong>{title}</strong></button>;
}

function Question({ title, options, values, update, locale, single = false, optional = false }: { title: string; options: string[]; values: string[]; update: (values: string[]) => void; locale: LocaleMode; single?: boolean; optional?: boolean }) {
  return <fieldset className="question-block"><legend>{title}</legend><div className="choice-grid compact">{options.map((option) => <ToggleCard key={option} title={labelFor(locale, option)} selected={values.includes(option)} onClick={() => update(single ? [option] : toggle(values, option))} />)}</div>{optional && <button type="button" className="unknown-button" onClick={() => update([])}>{labelFor(locale, "unknown")}</button>}</fieldset>;
}

function Composer(props: { locale: LocaleMode; compact?: boolean; value: string; setValue: (value: string) => void; voiceState: VoiceState; voiceReview: string; copy: OnboardingCopy; onSend: () => void; onStart: () => void; onStop: () => void; onUseVoice: () => void; onCancelVoice: () => void }) {
  return <section className={`onboarding-composer${props.compact ? " welcome-composer" : ""}`} aria-label={props.copy.common.composerPlaceholder}>
    <ConversationInput value={props.value} onChange={props.setValue} onSend={props.onSend} onVoice={props.voiceState === "recording" ? props.onStop : props.onStart} recording={props.voiceState === "recording"} voiceBusy={["requesting_permission", "transcribing"].includes(props.voiceState)} placeholder={props.copy.common.composerPlaceholder} sendLabel={props.copy.common.send} voiceLabel={props.voiceState === "recording" ? props.copy.common.stop : props.copy.common.dictate} french={props.locale === "fr"} />
    {props.voiceState !== "idle" && <div className="voice-review" role="status"><span>{voiceLabel(props.voiceState, props.copy)}</span>{props.voiceReview && <p>{props.voiceReview}</p>}{props.voiceState === "reviewing" && <div><button type="button" onClick={props.onUseVoice}>{props.copy.common.useVoice}</button><button type="button" onClick={props.onCancelVoice}><X size={13} /> {props.copy.common.cancel}</button></div>}</div>}
  </section>;
}

function reviewRows(answers: OnboardingAnswers, copy: OnboardingCopy, locale: LocaleMode, userId: string) {
  const rows = [
    { section: "establishment" as const, label: copy.common.restaurantName, value: answers.establishment.restaurantName || labelFor(locale, "unknown") },
    { section: "establishment" as const, label: copy.common.cityCountry, value: answers.establishment.cityCountry || labelFor(locale, "unknown") },
    { section: "priorities" as const, label: copy.common.priorityEyebrow, value: labelFor(locale, answers.priorities.primaryFocus || "unknown") },
    { section: "reservations" as const, label: copy.common.reservationsEyebrow, value: `${reservationReferences(answers).map((value) => labelFor(locale, value)).join(", ") || labelFor(locale, "unknown")} · ${copy.common.declared}` },
    { section: "operations" as const, label: copy.common.operationEyebrow, value: operationSummary(answers, locale) },
    { section: "authority" as const, label: copy.common.validationRecipient, value: answers.authority.approvalAssigneeUserId === userId ? copy.common.me : copy.common.toAssign },
    ...answers.authority.proposedRules.filter((rule) => rule.status !== "rejected").map((rule) => ({ section: "authority" as const, label: labelFor(locale, "proposed_rule"), value: rule.label })),
    ...answers.finalNote.statements.filter((statement) => statement.status === "confirmed").map((statement) => ({ section: "final_note" as const, label: labelFor(locale, statement.kind), value: statement.value })),
  ];
  return rows;
}

function operationSummary(answers: OnboardingAnswers, locale: LocaleMode): string {
  const focus = answers.priorities.primaryFocus;
  if (focus === "supplier_orders") {
    const item = answers.operations.suppliers.items[0];
    return item?.name ? [item.quantity, item.unit, item.name].filter((value) => value !== undefined).join(" ") : labelFor(locale, "unknown");
  }
  if (focus === "team") return answers.operations.team.stations.map((value) => labelFor(locale, value)).join(", ") || labelFor(locale, "unknown");
  if (focus === "reservations") return answers.operations.reservations.friction.map((value) => labelFor(locale, value)).join(", ") || labelFor(locale, "unknown");
  if (focus === "customer_communication") return answers.operations.communications.channels.map((value) => labelFor(locale, value)).join(", ") || labelFor(locale, "unknown");
  if (focus === "operations") return [answers.operations.service.phase, ...answers.operations.service.checks].filter(Boolean).map((value) => labelFor(locale, value!)).join(", ");
  if (["profitability", "customer_loyalty"].includes(focus || "")) return labelFor(locale, answers.operations.business.focus || "unknown");
  if (focus === "occupancy") return answers.operations.business.targetServices.join(", ") || labelFor(locale, "unknown");
  return answers.operations.global.confirmedSummary || labelFor(locale, answers.operations.global.startingMoment || "overview");
}

function operationCapturedText(answers: OnboardingAnswers): string {
  const focus = answers.priorities.primaryFocus;
  if (focus === "supplier_orders") return answers.operations.suppliers.otherText || "";
  if (focus === "team") return answers.operations.team.otherText || "";
  if (focus === "reservations") return answers.operations.reservations.otherText || "";
  if (focus === "customer_communication") return answers.operations.communications.otherText || "";
  if (focus === "operations") return answers.operations.service.otherText || "";
  if (["profitability", "occupancy", "customer_loyalty"].includes(focus || "")) return answers.operations.business.otherText || "";
  return answers.operations.global.otherSituation || answers.operations.global.confirmedSummary || "";
}

function priorityOptions(answers: OnboardingAnswers): PrimaryFocus[] {
  const options: PrimaryFocus[] = answers.priorities.scope === "global" ? ["global"] : answers.priorities.timeConsumers.map(timeConsumerToFocus);
  for (const outcome of answers.priorities.outcomes) options.push(outcomeToFocus(outcome));
  return Array.from(new Set(options));
}

function timeConsumerToFocus(value: OnboardingAnswers["priorities"]["timeConsumers"][number]): PrimaryFocus {
  return value === "other" ? "other" : value;
}

function outcomeToFocus(value: OnboardingAnswers["priorities"]["outcomes"][number]): PrimaryFocus {
  if (value === "stock_control") return "supplier_orders";
  if (value === "customer_requests") return "customer_communication";
  if (value === "team_coordination") return "team";
  if (value === "service_disruptions") return "operations";
  return value;
}

function validationMessage(section: SectionKey, copy: OnboardingCopy): string {
  if (section === "establishment") return copy.common.validationEstablishment;
  if (section === "priorities") return copy.common.validationPriority;
  if (section === "reservations") return copy.common.validationReservations;
  return copy.common.validationGeneric;
}

function saveStatusText(state: SaveState, copy: OnboardingCopy): string {
  if (state === "dirty") return copy.common.dirty;
  if (state === "saving") return copy.common.saving;
  if (state === "saved") return copy.common.saved;
  if (state === "failed") return copy.common.saveFailed;
  if (state === "conflict") return copy.common.conflict;
  return "";
}

function onboardingErrorMessage(caught: unknown, copy: OnboardingCopy, phase: "load" | "complete"): string {
  if (!(caught instanceof ApiError)) return phase === "load" ? copy.common.loadFailed : copy.common.completeFailed;
  if (caught.code === "ONBOARDING_REVISION_CONFLICT") return copy.common.conflict;
  if (caught.code === "ONBOARDING_AUTHORITY_REQUIRED") return copy.common.authorityBlocked;
  if (["INVALID_INPUT", "ONBOARDING_INCOMPLETE", "ONBOARDING_INVALID_TRANSITION", "ONBOARDING_ASSIGNEE_INVALID", "ONBOARDING_PROVENANCE_INVALID"].includes(caught.code)) {
    return copy.common.validationGeneric;
  }
  return phase === "load" ? copy.common.loadFailed : copy.common.completeFailed;
}

function voiceLabel(state: VoiceState, copy: OnboardingCopy): string {
  const labels: Record<VoiceState, string> = {
    idle: copy.common.voiceIdle,
    requesting_permission: copy.common.voicePermission,
    recording: copy.common.voiceRecording,
    transcribing: copy.common.voiceTranscribing,
    reviewing: copy.common.voiceReview,
    confirmed: copy.common.voiceConfirmed,
    cancelled: copy.common.voiceCancelled,
    permission_denied: copy.common.voiceDenied,
    unavailable: copy.common.voiceUnavailable,
    failed: copy.common.voiceFailed,
  };
  return labels[state];
}

function questionFor(section: SectionKey, answers: OnboardingAnswers, locale: LocaleMode): string {
  if (section === "establishment") return branchQuestion(locale, "establishmentVoice");
  if (section === "priorities") return onboardingCopy[locale].common.priorityQuestion;
  if (section === "reservations") return branchQuestion(locale, "reservationsVoice");
  if (section === "operations" && answers.priorities.primaryFocus === "supplier_orders") return branchQuestion(locale, "supplierVoice");
  if (section === "authority") return branchQuestion(locale, "authorityVoice");
  return branchQuestion(locale, "finalVoice");
}

type BranchQuestionKey = "communicationChannels" | "communicationMoment" | "reservationFriction" | "teamFriction" | "teamStations" | "supplierIntent" | "servicePhase" | "serviceCheck" | "profitabilityFocus" | "loyaltyFocus" | "globalMoment" | "establishmentVoice" | "reservationsVoice" | "supplierVoice" | "authorityVoice" | "finalVoice";

const branchQuestions: Record<LocaleMode, Record<BranchQuestionKey, string>> = {
  fr: {
    communicationChannels: "Quelles demandes vous interrompent le plus ?", communicationMoment: "À quel moment avez-vous surtout besoin de renfort ?", reservationFriction: "Qu'est-ce qui vous ralentit le plus ?",
    teamFriction: "Où l'organisation se complique-t-elle ?", teamStations: "Quels postes sont concernés ?", supplierIntent: "Quelle situation voulez-vous traiter en premier ?", servicePhase: "Quel moment souhaitez-vous mieux préparer ?",
    serviceCheck: "Quel point doit être vérifié en premier ?", profitabilityFocus: "Quel poste voulez-vous comprendre en premier ?", loyaltyFocus: "Que souhaitez-vous améliorer en premier ?", globalMoment: "Quel moment vous demande le plus d'attention ?",
    establishmentVoice: "Quel est le nom de votre établissement et dans quelle ville se trouve-t-il ?", reservationsVoice: "Quelle solution utilisez-vous pour les réservations ? Vous pouvez aussi décrire votre méthode.",
    supplierVoice: "Quel produit, quelle quantité et pour quelle livraison ? Vous pouvez laisser les informations inconnues à compléter.", authorityVoice: "Qui doit valider cette mission avant une action vers l'extérieur ?",
    finalVoice: "Y a-t-il une habitude, une exception ou une consigne importante que vous souhaitez ajouter ?",
  },
  en: {
    communicationChannels: "Which requests interrupt you most?", communicationMoment: "When do you mainly need support?", reservationFriction: "What slows you down most?", teamFriction: "Where does team organization become difficult?",
    teamStations: "Which stations are concerned?", supplierIntent: "Which situation should we address first?", servicePhase: "Which part of service would you like to prepare better?", serviceCheck: "What should be checked first?",
    profitabilityFocus: "Which cost area would you like to understand first?", loyaltyFocus: "What would you like to improve first?", globalMoment: "Which moment needs the most attention?", establishmentVoice: "What is your restaurant called and which city is it in?",
    reservationsVoice: "Which reservation solution do you use? You can also describe your method.", supplierVoice: "Which product, how much, and for which delivery? You may leave unknown information to complete later.",
    authorityVoice: "Who must approve this mission before an external action?", finalVoice: "Is there a habit, exception or important instruction you would like to add?",
  },
};

function branchQuestion(locale: LocaleMode, key: BranchQuestionKey): string {
  return branchQuestions[locale][key];
}

function localizedFirstResultTitle(answers: OnboardingAnswers, locale: LocaleMode): string {
  if (locale === "fr") return firstResultTitle(answers);
  const focus = answers.priorities.primaryFocus;
  const english: Record<string, string> = { supplier_orders: answers.operations.suppliers.items[0]?.quantity ? "Your order is prepared" : "Your order needs completion", customer_communication: "Your customer response protocol is defined", reservations: "Your reservation rules are prepared", team: "Your first briefing is prepared", profitability: "Your analysis plan is prepared", occupancy: answers.operations.business.targetServices.length ? "Your priority services are identified" : "Your occupancy plan needs detail", customer_loyalty: "Your customer follow-up is prepared", operations: "Your service preparation is ready", global: "Your service preparation is ready", other: "Your service preparation is ready" };
  return english[focus || "global"]!;
}

function cancelAudio(recognitionRef: MutableRefObject<SpeechRecognitionLike | null>, setVoiceState: (value: VoiceState) => void, resetState: boolean): void {
  abortRecognition(recognitionRef);
  if (resetState) setVoiceState("idle");
}

function abortRecognition(recognitionRef: MutableRefObject<SpeechRecognitionLike | null>): void {
  const recognition = recognitionRef.current;
  recognitionRef.current = null;
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.abort();
  } catch {
    // Some browser engines throw when capture already ended. All callbacks
    // and the active reference are detached above, so cleanup remains safe.
  }
}

function canComplete(role?: string): boolean {
  return ["platform_admin", "owner", "group_admin"].includes(role || "");
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function splitList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function conflictDifferences(local: OnboardingAnswers, remote: OnboardingAnswers): Array<{ path: string; local: string; remote: string }> {
  const localValues = flattenValues(local);
  const remoteValues = flattenValues(remote);
  return Array.from(new Set([...localValues.keys(), ...remoteValues.keys()]))
    .sort()
    .filter((path) => localValues.get(path) !== remoteValues.get(path))
    .map((path) => ({ path: `answers.${path}`, local: localValues.get(path) ?? "null", remote: remoteValues.get(path) ?? "null" }));
}

function flattenValues(value: unknown, prefix = "", output = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value) || value === null || typeof value !== "object") {
    output.set(prefix, Array.isArray(value) ? JSON.stringify(value) : String(value ?? ""));
    return output;
  }
  for (const [key, child] of Object.entries(value)) flattenValues(child, prefix ? `${prefix}.${key}` : key, output);
  return output;
}

function knownInput(value?: string): string {
  return !value || value === "unknown" || value === "not_applicable" ? "" : value;
}

function safeIdempotencyKey(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `onboarding-${random}-${Date.now()}`;
}
