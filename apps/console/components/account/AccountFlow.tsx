"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Moon, Sun } from "lucide-react";
import { ApiError } from "@/lib/api";
import { accountRequest as api, accountFeedback } from "@/lib/account-feedback";
import { readAccountProgress, type AccountContinuation, type AccountMode } from "@/lib/account-continuation";
import { challengeSecondsRemaining } from "@/lib/account-challenge";
import { Brand } from "../Brand";

type Stage = "credentials" | "email";
type EmailChallenge = { stage: "email"; expiresAt: string; expiresInSeconds: number };

export function AccountFlow({ mode }: { mode: AccountMode }) {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [needsProgressCheck, setNeedsProgressCheck] = useState(false);
  const [challengeUnavailable, setChallengeUnavailable] = useState(false);
  const [challengeExpiresAt, setChallengeExpiresAt] = useState("");
  const [challengeSeconds, setChallengeSeconds] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("dark");
  const [googleStart, setGoogleStart] = useState<string | null>(null);

  async function enterApp() {
    const session = await api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
    router.replace(session.tenant.onboardingComplete ? "/dashboard" : "/onboarding");
    router.refresh();
  }

  function recordChallengeExpiry(expiresInSeconds: number) {
    const deadline = new Date(Date.now() + Math.max(0, expiresInSeconds) * 1000).toISOString();
    setChallengeExpiresAt(deadline);
    setChallengeSeconds(challengeSecondsRemaining(deadline));
  }

  function resumeChallenge(challenge: AccountContinuation) {
    setStage("email");
    setEmail(challenge.email);
    setRememberMe(challenge.rememberMe);
    recordChallengeExpiry(challenge.expiresInSeconds);
    setCooldown(60);
  }

  useEffect(() => {
    let live = true;
    try { setTheme(localStorage.getItem("tn-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "clear" : "dark")); } catch { /* Optional preference persistence. */ }
    void api<{ enabled: boolean; startUrl: string | null }>("/v1/oauth/google/config")
      .then(result => { if (live) setGoogleStart(result.enabled ? result.startUrl : null); })
      .catch(() => undefined);
    if (new URLSearchParams(window.location.search).get("google") === "error") setError("La connexion Google n’a pas abouti. Réessayez ou utilisez votre e-mail.");
    void (async () => {
      try {
        const progress = await readAccountProgress(mode);
        if (!live || started.current) return;
        if (progress.kind === "session") router.replace(progress.onboardingComplete ? "/dashboard" : "/onboarding");
        else if (progress.kind === "challenge") { started.current = true; resumeChallenge(progress.challenge); }
      } catch (caught) {
        if (live) {
          setError(accountFeedback(caught).message);
          if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) setNeedsProgressCheck(true);
        }
      } finally {
        if (live) { setInitializing(false); setBusy(false); }
      }
    })();
    return () => { live = false; };
  }, [mode, router]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!challengeExpiresAt) { setChallengeSeconds(0); return; }
    const update = () => setChallengeSeconds(challengeSecondsRemaining(challengeExpiresAt));
    update();
    const timer = setInterval(update, 1000);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [challengeExpiresAt]);

  useEffect(() => { if (stage === "email") codeRef.current?.focus(); }, [stage]);

  async function reconcileProgress() {
    setNeedsProgressCheck(true);
    setBusy(true);
    try {
      const progress = await readAccountProgress(mode);
      if (progress.kind === "session") await enterApp();
      else if (progress.kind === "challenge") {
        resumeChallenge(progress.challenge);
        setError("");
        setNeedsProgressCheck(false);
      } else {
        setChallengeUnavailable(stage === "email");
        setError("Aucune vérification active n’a été retrouvée. Recommencez la connexion.");
        setNeedsProgressCheck(false);
      }
    } catch (caught) {
      const feedback = accountFeedback(caught);
      setChallengeUnavailable(feedback.restart);
      setNeedsProgressCheck(!feedback.restart);
      setError(feedback.message);
    } finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || needsProgressCheck) return;
    if (stage === "email" && challengeSecondsRemaining(challengeExpiresAt) === 0) {
      setChallengeUnavailable(true);
      setError("Ce code a expiré. Demandez-en un nouveau.");
      return;
    }
    started.current = true;
    setBusy(true);
    setError("");
    try {
      if (stage === "credentials") {
        const next = await api<EmailChallenge>(`/v1/account/${mode}`, { method: "POST", body: JSON.stringify({ email, rememberMe, ...(mode === "signup" ? { name } : {}) }) });
        setStage("email");
        setCode("");
        setCooldown(60);
        recordChallengeExpiry(next.expiresInSeconds);
      } else {
        await api<{ authenticated: true }>("/v1/account/verify-email", { method: "POST", body: JSON.stringify({ code }) });
        await enterApp();
      }
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) await reconcileProgress();
      else {
        const feedback = accountFeedback(caught);
        setChallengeUnavailable(feedback.restart);
        setError(feedback.message);
      }
    } finally { setBusy(false); }
  }

  async function resend() {
    if (busy || cooldown) return;
    setBusy(true);
    setError("");
    try {
      const next = await api<EmailChallenge>("/v1/account/resend", { method: "POST" });
      setCode("");
      setCooldown(60);
      recordChallengeExpiry(next.expiresInSeconds);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500)) await reconcileProgress();
      else {
        const feedback = accountFeedback(caught);
        setChallengeUnavailable(feedback.restart);
        setError(feedback.message);
      }
    } finally { setBusy(false); }
  }

  function restart() {
    setStage("credentials");
    setCode("");
    setChallengeExpiresAt("");
    setChallengeSeconds(0);
    setChallengeUnavailable(false);
    setNeedsProgressCheck(false);
    setError("");
    window.history.replaceState(null, "", window.location.pathname);
  }

  function changeTheme() {
    const next = theme === "dark" ? "clear" : "dark";
    setTheme(next);
    try { localStorage.setItem("tn-theme", next); } catch { /* Optional preference persistence. */ }
  }

  const challengeExpired = stage === "email" && Boolean(challengeExpiresAt) && challengeSeconds === 0;
  const restartRequired = challengeExpired || challengeUnavailable;
  const title = stage === "email" ? "Vérifiez votre e-mail" : mode === "signup" ? "Créer votre compte" : "Bienvenue";

  return <main className={`tn-auth tn-account theme-${theme}`} data-stage={stage}>
    <button type="button" className="tn-icon tn-theme-switch" onClick={changeTheme} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    <header className="tn-auth-header"><Brand /></header>
    <section className="tn-auth-card" aria-labelledby="auth-title" aria-busy={busy}>
      {stage === "email" && <button type="button" className="tn-account-back" disabled={busy} onClick={restart} aria-label="Revenir à l’adresse e-mail"><ArrowLeft size={20} /></button>}
      <h1 id="auth-title">{title}</h1>
      {initializing ? <p role="status">Vérification de votre accès…</p> : stage === "email"
        ? <p>Code envoyé à <strong>{email}</strong>.</p>
        : <p>{mode === "signup" ? "Deux informations suffisent pour commencer." : "Recevez un code sécurisé pour accéder à votre espace."}</p>}

      <form key={stage} onSubmit={submit}>
        {stage === "credentials" && <>
          {mode === "signup" && <label className="tn-field"><span>Votre nom</span><input name="name" placeholder="Votre nom" autoComplete="name" maxLength={100} value={name} onChange={event => setName(event.target.value)} required /></label>}
          <label className="tn-field"><span>E-mail</span><input name="email" type="email" placeholder="Votre adresse e-mail" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label className="tn-account-remember"><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} /><span>Rester connecté sur cet appareil</span></label>
        </>}

        {stage === "email" && <>
          <label className="tn-field tn-code-field">
            <span>Code à 6 chiffres</span>
            <div className="tn-code-entry">
              <div className="tn-code-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} data-active={index === Math.min(code.length, 5)}>{code[index] || ""}</span>)}</div>
              <input ref={codeRef} name="code" className="tn-account-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={restartRequired || busy || needsProgressCheck} aria-describedby={error ? "account-error" : undefined} aria-invalid={error ? true : undefined} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
          </label>
          {!restartRequired && <small role="status">Expire dans {Math.max(1, Math.ceil(challengeSeconds / 60))} min.</small>}
        </>}

        {error && <p id="account-error" className="tn-error" role="alert">{error}</p>}
        {needsProgressCheck
          ? <button className="tn-primary tn-account-submit" type="button" disabled={busy} onClick={() => void reconcileProgress()}>Vérifier ma connexion</button>
          : restartRequired
            ? <button className="tn-primary tn-account-submit" type="button" disabled={busy} onClick={restart}>Demander un nouveau code</button>
            : <button className="tn-primary tn-account-submit" type="submit" disabled={busy || (stage === "email" && code.length !== 6)}>{busy && <LoaderCircle size={17} className="spinning" />}{stage === "email" ? "Continuer" : mode === "signup" ? "Créer mon compte" : "Recevoir mon code"}</button>}
      </form>

      {stage === "credentials" && googleStart && <div className="tn-account-social">
        <div className="tn-account-divider"><span>OU</span></div>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); window.location.assign(`${googleStart}?remember=${rememberMe ? "1" : "0"}`); }}><img src="/brand/google-official.png" width={20} height={20} alt="" />Continuer avec Google</button>
      </div>}

      {stage === "email" && !restartRequired && <div className="tn-account-resend"><span>Vous n’avez rien reçu ?</span><button type="button" className="tn-link" disabled={busy || needsProgressCheck || cooldown > 0} onClick={() => void resend()}>{cooldown ? `Renvoyer dans ${cooldown} s` : "Renvoyer le code"}</button></div>}
      {stage === "credentials" && <p className="tn-auth-access">{mode === "login" ? <>Nouveau sur TableNow ? <Link href="/register">Créer un compte</Link></> : <>Vous avez déjà un compte ? <Link href="/login">Se connecter</Link></>}</p>}
    </section>
    <footer className="tn-auth-footer"><Link href="/legal/privacy">Confidentialité</Link><span>·</span><Link href="/legal/terms">Conditions d’utilisation</Link></footer>
  </main>;
}
