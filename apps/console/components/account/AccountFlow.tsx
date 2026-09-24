"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Moon, Sun } from "lucide-react";
import { ApiError } from "@/lib/api";
import { accountRequest as api, accountFeedback, shouldReconcileAccountFailure } from "@/lib/account-feedback";
import { readAccountProgress, type AccountContinuation } from "@/lib/account-continuation";
import { challengeSecondsRemaining } from "@/lib/account-challenge";
import { Brand } from "../Brand";

type Stage = "credentials" | "email" | "mfa" | "enroll";
type Mode = "login" | "signup" | "reset" | "passwordless" | "verify";
type EmailChallenge = { stage: "email" | "mfa" | "enroll"; delivery?: "code" | "link"; secret?: string; expiresAt: string; expiresInSeconds: number };
type ProfileChallenge = { stage: "profile"; email: string; expiresAt: string; expiresInSeconds: number };

export function AccountFlow({ mode = "login" }: { mode?: Mode }) {
  const router = useRouter();
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [delivery, setDelivery] = useState<"link" | "code">("code");
  const [recoveryCode, setRecoveryCode] = useState(false);
  const [enrollmentKey, setEnrollmentKey] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
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

  async function resumeChallenge(challenge: AccountContinuation) {
    // Resume an email already verified by the previous deployment, without another form.
    if (challenge.stage === "profile") {
      await api<{ authenticated: true }>("/v1/account/complete-profile", { method: "POST", body: JSON.stringify({}) });
      await enterApp();
      return;
    }
    if (stage !== challenge.stage) setCode("");
    setStage(challenge.stage);
    setDelivery(challenge.delivery ?? "code");
    setEnrollmentKey(challenge.secret ?? "");
    setEmail(challenge.email);
    recordChallengeExpiry(challenge.expiresInSeconds);
    if (challenge.stage === "email") setCooldown(60);
  }

  useEffect(() => {
    let live = true;
    try { setTheme(localStorage.getItem("tn-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "clear" : "dark")); } catch { /* Optional preference persistence. */ }
    void api<{ enabled: boolean; startUrl: string | null }>("/v1/oauth/google/config")
      .then(result => { if (live) setGoogleStart(result.enabled ? result.startUrl : null); })
      .catch(() => undefined);
    if (new URLSearchParams(window.location.search).get("google") === "signup-required") setError("Aucun compte TableNow associé à ce compte Google. Cliquez sur S’inscrire pour créer votre compte.");
    if (new URLSearchParams(window.location.search).get("google") === "email-error") setError("Votre adresse doit être vérifiée par e-mail, mais l’envoi n’a pas abouti. Réessayez dans quelques minutes.");
    if (new URLSearchParams(window.location.search).get("google") === "error") setError("La connexion Google n’a pas abouti. Réessayez ou utilisez votre e-mail.");
    void (async () => {
      try {
        if (mode === "verify" && window.location.hash && !started.current) {
          started.current = true;
          const fragment = new URLSearchParams(window.location.hash.slice(1));
          const challenge = fragment.get("challenge"), proof = fragment.get("code");
          window.history.replaceState(null, "", window.location.pathname);
          if (!challenge || !proof) throw new Error("Lien incomplet");
          const next = await api<{ authenticated: true } | EmailChallenge>("/v1/account/verify-email", { method: "POST", body: JSON.stringify({ challenge, code: proof }) });
          if ("authenticated" in next) await enterApp();
          else {
            setStage(next.stage); setEnrollmentKey(next.secret ?? ""); recordChallengeExpiry(next.expiresInSeconds);
          }
          return;
        }
        const progress = await readAccountProgress();
        if (!live || started.current) return;
        if (progress.kind === "session") router.replace(progress.onboardingComplete ? "/dashboard" : "/onboarding");
        else if (progress.kind === "challenge") {
          const challengeMode = progress.challenge.purpose === "signup" ? "signup" : progress.challenge.purpose === "reset" ? "reset" : "passwordless";
          const securityStep = progress.challenge.stage !== "email" || progress.challenge.purpose === "google";
          if (securityStep || mode === challengeMode) { started.current = true; await resumeChallenge(progress.challenge); }
        }
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
  }, [router, mode]);

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

  useEffect(() => {
    if ((stage === "email" && delivery === "code") || stage === "mfa" || stage === "enroll") codeRef.current?.focus();
  }, [stage, delivery]);

  async function reconcileProgress() {
    setNeedsProgressCheck(true);
    setBusy(true);
    try {
      const progress = await readAccountProgress();
      if (progress.kind === "session") await enterApp();
      else if (progress.kind === "challenge") {
        await resumeChallenge(progress.challenge);
        setError("");
        setNeedsProgressCheck(false);
      } else {
        setChallengeUnavailable(stage !== "credentials");
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
    if (stage !== "credentials" && challengeSecondsRemaining(challengeExpiresAt) === 0) {
      setChallengeUnavailable(true);
      setError("Cette vérification a expiré. Recommencez pour continuer.");
      return;
    }
    started.current = true;
    setBusy(true);
    setError("");
    try {
      if (stage === "credentials") {
        const endpoint = mode === "signup" ? "signup" : mode === "reset" ? "reset" : "login";
        const body = { email, rememberMe, ...(mode !== "passwordless" ? { password } : {}), ...(["signup", "reset"].includes(mode) ? { delivery: "link" } : {}) };
        const next = await api<EmailChallenge | { authenticated: true }>(`/v1/account/${endpoint}`, { method: "POST", body: JSON.stringify(body) });
        if ("authenticated" in next) await enterApp();
        else { setStage(next.stage); setDelivery(next.delivery ?? "code"); setCode(""); setCooldown(60); recordChallengeExpiry(next.expiresInSeconds); }
      } else {
        const next = await api<{ authenticated: true; backupCodes?: string[] } | EmailChallenge | ProfileChallenge>(`/v1/account/${stage === "email" ? "verify-email" : "verify-mfa"}`, { method: "POST", body: JSON.stringify({ code }) });
        if ("authenticated" in next) {
          if (next.backupCodes?.length) setBackupCodes(next.backupCodes);
          else await enterApp();
        } else await resumeChallenge({ ...next, email, purpose: "login", rememberMe });
      }
    } catch (caught) {
      if (shouldReconcileAccountFailure(caught)) await reconcileProgress();
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
      if (shouldReconcileAccountFailure(caught)) await reconcileProgress();
      else {
        const feedback = accountFeedback(caught);
        setChallengeUnavailable(feedback.restart);
        setError(feedback.message);
      }
    } finally { setBusy(false); }
  }

  function restart() {
    if (mode === "verify") { router.replace("/login"); return; }
    setStage("credentials");
    setCode("");
    setRecoveryCode(false);
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

  const challengeExpired = stage !== "credentials" && Boolean(challengeExpiresAt) && challengeSeconds === 0;
  const restartRequired = challengeExpired || challengeUnavailable;
  const emailLink = stage === "email" && delivery === "link";
  const title = stage === "mfa" || stage === "enroll" ? "Code de votre application d’authentification"
    : stage === "email" ? emailLink ? "Confirmez votre adresse" : "Code reçu par e-mail"
    : mode === "signup" ? "Créer votre compte" : mode === "reset" ? "Mot de passe oublié ?"
    : mode === "passwordless" ? "Se connecter sans mot de passe" : mode === "verify" ? "Vérification de votre adresse" : "Heureux de vous retrouver";
  const description = stage === "mfa" ? "Ouvrez votre application d’authentification et saisissez le code actuel. Aucun e-mail n’a été envoyé pour cette étape."
    : stage === "enroll" ? "Sur ce téléphone : copiez la clé ci-dessous, ajoutez TableNow dans votre application d’authentification, puis revenez saisir son code."
    : stage === "email" ? <>Nous avons envoyé {emailLink ? "un lien de confirmation" : "un code"} à <strong>{email}</strong>. {emailLink ? "Ouvrez cet e-mail pour continuer." : ""}</>
    : mode === "signup" ? "Créez votre compte pour commencer avec TableNow."
    : mode === "reset" ? "Choisissez un nouveau mot de passe. Un lien envoyé par e-mail permettra de confirmer ce changement."
    : mode === "passwordless" ? "Recevez un code temporaire pour vous connecter à votre compte."
    : mode === "verify" ? "Nous vérifions votre lien sécurisé."
    : "Connectez-vous pour retrouver votre espace TableNow.";
  const credentialsVisible = stage === "credentials" && mode !== "verify";
  const showSubmit = !emailLink && (mode !== "verify" || stage === "mfa" || stage === "enroll");

  return <main className={`tn-auth tn-account theme-${theme}`} data-stage={stage}>
    <section className="tn-auth-card" aria-labelledby="auth-title" aria-busy={busy}>
      <div className="tn-auth-brand-row">
        {stage !== "credentials" ? <button type="button" className="tn-account-back" disabled={busy} onClick={restart} aria-label="Recommencer avec une autre adresse"><ArrowLeft size={20} /></button> : <span aria-hidden="true" />}
        <Brand />
        <button type="button" className="tn-icon tn-theme-switch" onClick={changeTheme} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
      </div>
      <h1 id="auth-title">{title}</h1>
      {initializing ? <p role="status">Vérification de votre accès…</p> : <p>{description}</p>}


      <form key={stage} onSubmit={submit}>
        {credentialsVisible && <label className="tn-field"><span>Adresse e-mail</span><input name="email" type="email" placeholder="vous@restaurant.fr" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required /></label>}

        {credentialsVisible && mode !== "passwordless" && <label className="tn-field"><span>{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</span><div className="tn-password-entry"><input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 15} maxLength={128} placeholder="Votre mot de passe" value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{mode !== "login" && <small>Au moins 15 caractères. Vous pouvez utiliser une phrase.</small>}</label>}
        {credentialsVisible && (mode === "login" || mode === "signup") && <div className="tn-account-options"><label><input type="checkbox" checked={rememberMe} onChange={event => setRememberMe(event.target.checked)} />Se souvenir de moi</label>{mode === "login" && <Link href="/forgot-password">Mot de passe oublié ?</Link>}</div>}
        {stage === "enroll" && <div className="tn-enrollment"><label className="tn-field"><span>Clé à ajouter dans votre application</span><input readOnly value={enrollmentKey} aria-label="Clé d’authentification" /></label><button type="button" onClick={() => void navigator.clipboard.writeText(enrollmentKey).catch(() => setError("Sélectionnez et copiez la clé affichée."))}>Copier la clé</button></div>}
        {(stage === "mfa" || stage === "enroll" || (stage === "email" && !emailLink)) && <>
          <label className="tn-field tn-code-field">
            <span>{recoveryCode ? "Code de récupération" : "Code à 6 chiffres"}</span>
            <div className={recoveryCode ? "tn-recovery-entry" : "tn-code-entry"}>
              {!recoveryCode && <div className="tn-code-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} data-active={index === Math.min(code.length, 5)}>{code[index] || ""}</span>)}</div>}
              <input ref={codeRef} name="code" className={recoveryCode ? "" : "tn-account-code"} inputMode={recoveryCode ? "text" : "numeric"} autoComplete="one-time-code" pattern={recoveryCode ? undefined : "[0-9]{6}"} minLength={6} maxLength={recoveryCode ? 64 : 6} required disabled={restartRequired || busy || needsProgressCheck} onPaste={event => { event.preventDefault(); setCode(recoveryCode ? event.clipboardData.getData("text").trim().slice(0,64) : event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} aria-describedby={error ? "account-error" : undefined} aria-invalid={error ? true : undefined} value={code} onChange={event => setCode(recoveryCode ? event.target.value : event.target.value.replace(/\D/g, "").slice(0, 6))} />
            </div>
          </label>
          {!restartRequired && <small role="status">Cette vérification expire dans {Math.max(1, Math.ceil(challengeSeconds / 60))} min.</small>}
        </>}

        {error && <p id="account-error" className="tn-error" role="alert">{error}</p>}
        {backupCodes.length > 0 ? <div><p>Conservez ces codes de récupération dans un endroit sûr.</p><pre>{backupCodes.join("\n")}</pre><button type="button" className="tn-primary tn-account-submit" onClick={() => void enterApp()}>J’ai sauvegardé mes codes</button></div> : needsProgressCheck
          ? <button className="tn-primary tn-account-submit" type="button" disabled={busy} onClick={() => void reconcileProgress()}>Vérifier ma connexion</button>
          : restartRequired
            ? <button className="tn-primary tn-account-submit" type="button" disabled={busy} onClick={restart}>Recommencer</button>
            : showSubmit ? <button className="tn-primary tn-account-submit" type="submit" disabled={busy || (stage !== "credentials" && (recoveryCode ? code.length < 6 : code.length !== 6))}>{busy && <LoaderCircle size={17} className="spinning" />}{stage !== "credentials" ? "Vérifier" : mode === "signup" ? "S’inscrire" : mode === "login" ? "Se connecter" : "Continuer"}</button> : null}
      </form>

      {credentialsVisible && (mode === "login" || mode === "signup") && <div className="tn-account-social">
        <div className="tn-account-divider"><span>ou</span></div>
        <button type="button" disabled={busy || !googleStart} onClick={() => { if (googleStart) { setBusy(true); window.location.assign(`${googleStart}?remember=${rememberMe ? "1" : "0"}&intent=${mode}`); } }}><img src="/brand/google-official.png" width={20} height={20} alt="" />Continuer avec Google</button>
        <button type="button" disabled title="La connexion Apple n’est pas encore disponible"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.1 12.5c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.2-2.5.8-3.1.8-.6 0-1.6-.8-2.6-.8-1.4 0-2.7.8-3.4 2-1.5 2.4-.4 6.1 1 8.1.7 1 1.4 2 2.5 2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.7-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3ZM15 6.4c.5-.7.9-1.7.8-2.7-.8 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.5 1 .1 2-.5 2.6-1.1Z" /></svg>Continuer avec Apple — bientôt</button>
      </div>}
      {credentialsVisible && mode === "login" && <Link className="tn-link tn-account-secondary" href="/login/email">Se connecter sans mot de passe</Link>}
      {stage === "mfa" && <button type="button" className="tn-link tn-account-change-email" onClick={() => { setRecoveryCode(!recoveryCode); setCode(""); }}>{recoveryCode ? "Utiliser mon application d’authentification" : "Utiliser un code de récupération"}</button>}
      {stage === "email" && !restartRequired && <div className="tn-account-resend"><span>Vous n’avez rien reçu ?</span><button type="button" className="tn-link" disabled={busy || needsProgressCheck || cooldown > 0} onClick={() => void resend()}>{cooldown ? `Renvoyer dans ${cooldown} s` : emailLink ? "Renvoyer le lien" : "Renvoyer le code"}</button></div>}
      {stage === "email" && <button type="button" className="tn-link tn-account-change-email" disabled={busy} onClick={restart}>Modifier l’adresse</button>}
      {mode !== "login" && <Link className="tn-link tn-account-secondary" href="/login">Retour à la connexion</Link>}
      <footer className="tn-auth-footer"><p>{mode === "signup" ? <>Vous avez déjà un compte ? <Link href="/login">Se connecter</Link></> : <>Vous n’avez pas de compte ? <Link href="/register">S’inscrire</Link></>}</p><div><Link href="/legal/privacy">Confidentialité</Link><span>·</span><Link href="/legal/terms">Conditions d’utilisation</Link></div></footer>
    </section>
  </main>;
}
