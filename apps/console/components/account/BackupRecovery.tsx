"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { LoaderCircle, Moon, Sun } from "lucide-react";
import { ApiError } from "@/lib/api";
import { accountRequest, accountFeedback } from "@/lib/account-feedback";
import { acknowledgeBackupCodes, readBackupRecovery, replaceBackupCodes, uncertainAccountResponse, type BackupRecoveryState } from "@/lib/account-recovery";
import { Brand } from "../Brand";

export function BackupRecovery() {
  const [access, setAccess] = useState<"loading" | "ready" | "signed_out" | "error">("loading");
  const [destination, setDestination] = useState("/onboarding");
  const [theme, setTheme] = useState("dark");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<"proof" | "codes" | "complete" | "expired">("proof");
  const [expiresAt, setExpiresAt] = useState(0);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [error, setError] = useState("");
  // A capability identifying this operation stays only in memory, never in a URL or browser storage.
  const operation = useRef<string | null>(null);

  async function checkSession() {
    setAccess("loading"); setError("");
    try {
      const session = await accountRequest<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
      setDestination(session.tenant.onboardingComplete ? "/dashboard" : "/onboarding");
      setAccess("ready");
    } catch (caught) {
      setAccess(caught instanceof ApiError && caught.status === 401 ? "signed_out" : "error");
      setError(caught instanceof ApiError && caught.status === 401 ? "Connectez-vous avant de remplacer vos codes de secours." : accountFeedback(caught).message);
    }
  }
  useEffect(() => {
    try { setTheme(localStorage.getItem("tn-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "clear" : "dark")); } catch { /* Theme preference only. */ }
    void checkSession();
  }, []);
  useEffect(() => {
    if (state !== "codes" || !expiresAt) return;
    const timer = setInterval(() => {
      if (Date.now() >= expiresAt) { setCodes([]); setCode(""); setState("expired"); setNeedsCheck(false); setError(""); }
    }, 1000);
    return () => clearInterval(timer);
  }, [state, expiresAt]);
  useEffect(() => {
    if (state !== "codes" || saved) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [state, saved]);

  function apply(result: BackupRecoveryState) {
    setNeedsCheck(false);
    if (result.state === "ready") {
      setCodes(result.backupCodes); setState("codes"); setCode("");
      setExpiresAt(Date.now() + Math.max(0, result.expiresInSeconds) * 1000);
    } else if (result.state === "acknowledged") {
      setCodes([]); setCode(""); setState("complete"); operation.current = null;
    } else {
      setError("Aucun remplacement n’est confirmé pour cette demande. Vous pouvez réessayer avec le code actuel de votre application.");
    }
  }
  function failed(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 401) {
      setCodes([]); setCode(""); setAccess("signed_out"); setNeedsCheck(false);
      setError("Votre session a expiré. Reconnectez-vous pour protéger vos codes.");
    } else if (caught instanceof ApiError && caught.code === "ACCOUNT_CHALLENGE_UNAVAILABLE") {
      setCodes([]); setCode(""); setSaved(false); setState("proof"); setNeedsCheck(false); operation.current = null;
      setError(caught.message);
    } else if (caught instanceof ApiError && caught.code === "ACCOUNT_BACKUP_RECOVERY_EXPIRED") {
      setCodes([]); setCode(""); setState("expired"); setNeedsCheck(false); setError("");
    } else {
      const uncertain = uncertainAccountResponse(caught);
      setNeedsCheck(uncertain);
      setError(uncertain ? "La réponse est incertaine. Vérifiez son état avant toute nouvelle demande." : accountFeedback(caught).message);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || access !== "ready" || needsCheck) return;
    operation.current ??= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      if (state === "codes" && saved) apply(await acknowledgeBackupCodes(operation.current));
      else if (state === "proof") apply(await replaceBackupCodes(operation.current, code));
    } catch (caught) { failed(caught); }
    finally { setBusy(false); }
  }
  async function checkResult() {
    if (busy || !operation.current || access !== "ready") return;
    setBusy(true); setError("");
    try { apply(await readBackupRecovery(operation.current)); }
    catch (caught) { failed(caught); }
    finally { setBusy(false); }
  }
  function restart() {
    operation.current = null; setState("proof"); setCodes([]); setCode(""); setSaved(false); setNeedsCheck(false); setError("");
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`TableNow — Codes de secours\n\n${codes.join("\n")}\n\nChaque code ne fonctionne qu’une fois. Gardez ce fichier privé.\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "TableNow-codes-de-secours.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function changeTheme() {
    const next = theme === "dark" ? "clear" : "dark"; setTheme(next);
    try { localStorage.setItem("tn-theme", next); } catch { /* Theme preference only. */ }
  }

  return <main className={`tn-auth tn-account theme-${theme}`}>
    <button type="button" className="tn-icon tn-theme-switch" onClick={changeTheme} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    <header className="tn-auth-header"><Brand /></header>
    <section className="tn-auth-card" aria-labelledby="recovery-title" aria-busy={busy || access === "loading"}>
      <h1 id="recovery-title">Vos codes de secours</h1>
      {access === "loading" && <p role="status">Vérification de votre accès…</p>}
      {access === "ready" && state === "proof" && <>
        <p>Vous n’avez pas pu conserver vos codes ? Les anciens codes ne peuvent pas être réaffichés. Votre application d’authentification permet d’en créer de nouveaux.</p>
        <p id="recovery-help">Ouvrez votre application et attendez un nouveau code de six chiffres. Cette action remplacera tous vos anciens codes de secours. Votre clé d’authentification reste la même.</p>
      </>}
      {access === "ready" && state === "codes" && <p>Ces huit codes remplacent les précédents. Enregistrez-les dans votre gestionnaire de mots de passe ou téléchargez-les. Chaque code fonctionne une seule fois ; ne les partagez pas.</p>}
      {access === "ready" && state === "expired" && <p>La fenêtre de consultation de dix minutes est terminée. Les codes déjà enregistrés restent valides tant qu’ils ne sont pas remplacés. Si vous ne les avez pas conservés, remplacez-les avec un nouveau code de votre application.</p>}
      {access === "ready" && state === "complete" && <p role="status">Votre sauvegarde est confirmée. La copie temporaire de vos codes a été effacée.</p>}
      {access === "ready" && ["proof", "codes"].includes(state) && <form onSubmit={submit}>
        {state === "proof" && <label className="tn-field"><span>Code de votre application · 6 chiffres</span><input name="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy || needsCheck} aria-describedby="recovery-help" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onPaste={event => { event.preventDefault(); setCode(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); }} /></label>}
        {state === "codes" && <><div className="tn-backup-codes">{codes.map(value => <code key={value}>{value}</code>)}</div><button type="button" className="tn-link" onClick={download} disabled={busy}>Télécharger mes codes</button><label className="tn-backup-saved"><input type="checkbox" checked={saved} required disabled={busy} onChange={event => setSaved(event.target.checked)} /><span>J’ai conservé ces nouveaux codes de secours.</span></label><small>Cette copie temporaire reste consultable dix minutes dans cette page. Un rechargement nécessitera une nouvelle vérification si vous ne les avez pas conservés.</small></>}
        {needsCheck ? <button type="button" className="tn-primary tn-account-submit" disabled={busy} onClick={() => void checkResult()}>Vérifier l’état de ma demande</button> : <button type="submit" className="tn-primary tn-account-submit" disabled={busy || (state === "codes" && !saved)}>{busy && <LoaderCircle size={17} className="spinning" />}{state === "codes" ? "Confirmer la sauvegarde" : "Créer mes nouveaux codes"}</button>}
      </form>}
      {error && <p className="tn-error" role="alert">{error}</p>}
      {access === "signed_out" && <Link href="/login" className="tn-primary tn-account-submit">Se connecter</Link>}
      {access === "error" && <button type="button" className="tn-primary tn-account-submit" onClick={() => void checkSession()}>Vérifier mon accès</button>}
      {access === "ready" && state === "expired" && <button type="button" className="tn-secondary" onClick={restart}>Remplacer les codes avec une nouvelle vérification</button>}
      {access === "ready" && state !== "codes" && <Link href={destination} className="tn-link">{state === "complete" ? "Continuer vers mon espace" : "Revenir à mon espace"}</Link>}
    </section>
    <footer className="tn-auth-footer"><Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" aria-label="Confidentialité — nouvel onglet">Confidentialité</Link><span>·</span><Link href="/legal/terms" target="_blank" rel="noopener noreferrer" aria-label="Conditions d’utilisation — nouvel onglet">Conditions d’utilisation</Link></footer>
  </main>;
}
