"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Moon, Sun } from "lucide-react";
import { api } from "@/lib/api";
import { Brand } from "../Brand";

type Mode = "signup" | "login" | "reset";
type Stage = "credentials" | "email" | "enroll" | "mfa" | "backup" | "complete";
type NextStage = { stage: "email" | "enroll" | "mfa"; secret?: string };

export function AccountFlow({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupSaved, setBackupSaved] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [rememberMe, setRememberMe] = useState(true);
  const [googleStart, setGoogleStart] = useState<string | null>(null);
  const [googleFlow, setGoogleFlow] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function enterApp() {
    const session = await api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
    router.replace(session.tenant.onboardingComplete ? "/dashboard" : "/onboarding");
    router.refresh();
  }
  useEffect(() => {
    let live = true;
    try { setTheme(localStorage.getItem("tn-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "clear" : "dark")); } catch { /* Optional preference persistence. */ }
    void api<{ enabled: boolean; startUrl: string | null }>("/v1/oauth/google/config").then(result => { if (live) setGoogleStart(result.enabled ? result.startUrl : null); }).catch(() => undefined);
    const googleReturn = new URLSearchParams(window.location.search).get("google");
    if (googleReturn === "error") setError("La connexion Google n’a pas abouti. Réessayez ou utilisez votre connexion habituelle.");
    if (googleReturn === "continue") {
      started.current = true; setBusy(true); setGoogleFlow(true);
      void api<NextStage & { email: string }>("/v1/account/google-continuation").then(next => {
        if (live) { setStage(next.stage); setEmail(next.email); setSecret(next.secret || ""); }
      }).catch(() => { if (live) setError("La vérification a expiré. Recommencez la connexion Google."); }).finally(() => { if (live) setBusy(false); });
      return () => { live = false; };
    }
    void api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session").then(session => {
      if (live && !started.current) router.replace(session.tenant.onboardingComplete ? "/dashboard" : "/onboarding");
    }).catch(() => undefined);
    return () => { live = false; };
  }, [router]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => { codeRef.current?.focus(); }, [stage, useBackup]);
  useEffect(() => {
    if (!secret) return;
    let live = true;
    // The secret stays in this browser; no external QR service is contacted.
    const uri = `otpauth://totp/${encodeURIComponent(`TableNow:${email}`)}?secret=${secret}&issuer=TableNow&algorithm=SHA1&digits=6&period=30`;
    void import("qrcode").then(({ default: QRCode }) => QRCode.toDataURL(uri, { width: 208, margin: 2, errorCorrectionLevel: "M" })).then(value => { if (live) setQr(value); }).catch(() => { if (live) setQr(""); });
    return () => { live = false; };
  }, [secret, email]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    started.current = true;
    setBusy(true); setError("");
    try {
      if (stage === "credentials") {
        const next = await api<NextStage>(`/v1/account/${mode}`, { method: "POST", body: JSON.stringify({ email, password, rememberMe, ...(mode === "signup" ? { name } : {}) }) });
        setStage(next.stage); setPassword(""); setVisible(false); setCode(""); setCooldown(60);
      } else if (stage === "email") {
        const next = await api<NextStage>("/v1/account/verify-email", { method: "POST", body: JSON.stringify({ code }) });
        setStage(next.stage); setSecret(next.secret || ""); setCode("");
      } else if (stage === "complete") {
        await enterApp();
      } else if (stage === "backup") {
        if (backupSaved) await enterApp();
      } else {
        const result = await api<{ backupCodes: string[] }>("/v1/account/verify-mfa", { method: "POST", body: JSON.stringify({ code }) });
        setSecret(""); setQr(""); setCode("");
        if (result.backupCodes.length) { setBackupCodes(result.backupCodes); setStage("backup"); }
        else { setStage("complete"); await enterApp(); }
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "La demande n’a pas abouti. Réessayez."); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (busy || cooldown) return;
    setBusy(true); setError("");
    try { await api("/v1/account/resend", { method: "POST" }); setCode(""); setCooldown(60); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "L’envoi est indisponible."); }
    finally { setBusy(false); }
  }
  function changeTheme() {
    const next = theme === "dark" ? "clear" : "dark";
    setTheme(next);
    try { localStorage.setItem("tn-theme", next); } catch { /* Optional preference persistence. */ }
  }
  function restart() {
    setStage("credentials"); setCode(""); setSecret(""); setQr("");
    setError(""); setCopyNotice(""); setUseBackup(false);
    setGoogleFlow(false);
    window.history.replaceState(null, "", window.location.pathname);
  }
  async function copySecret() {
    try { await navigator.clipboard.writeText(secret); setCopyNotice("Clé copiée."); }
    catch { setCopyNotice("Sélectionnez la clé pour la copier manuellement."); }
  }
  function downloadBackupCodes() {
    const url = URL.createObjectURL(new Blob([`TableNow — Codes de secours\n${email}\n\n${backupCodes.join("\n")}\n\nChaque code ne fonctionne qu’une fois. Conservez ce fichier dans un endroit privé.\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "TableNow-codes-de-secours.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const title = stage === "credentials" ? (mode === "signup" ? "Créer votre compte" : mode === "reset" ? "Mot de passe oublié" : "Bienvenue") : stage === "email" ? "Entrez le code e-mail" : stage === "enroll" ? "Configurer votre application" : stage === "backup" ? "Codes de secours" : stage === "complete" ? "Connexion établie" : useBackup ? "Code de secours" : "Code de votre application";
  const codeLabel = useBackup ? "Code de secours" : stage === "email" ? "Code e-mail à six chiffres" : "Code d’application à six chiffres";
  return <main className={`tn-auth tn-account theme-${theme}`}>
    <button type="button" className="tn-icon tn-theme-switch" onClick={changeTheme} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    <header className="tn-auth-header"><Brand /></header>
    <section className="tn-auth-card" aria-labelledby="auth-title" aria-busy={busy}>
      {stage !== "credentials" && stage !== "backup" && stage !== "complete" && <button type="button" className="tn-account-back" disabled={busy} onClick={restart} aria-label="Recommencer la connexion"><ArrowLeft size={20} /></button>}
      <h1 id="auth-title">{title}</h1>
      {stage === "credentials" && <p>{mode === "signup" ? "Créez votre accès TableNow pour retrouver votre restaurant." : mode === "reset" ? "Choisissez un nouveau mot de passe, puis vérifiez votre e-mail et votre application d’authentification." : "Connectez-vous pour retrouver votre espace TableNow."}</p>}
      {stage === "email" && <p id="code-help">Saisissez le dernier code envoyé à <strong>{email}</strong>. Il est valable 10 minutes, dans cette fenêtre.</p>}
      {stage === "enroll" && <p id="code-help">{googleFlow ? "Votre compte Google est vérifié." : "Votre e-mail est vérifié."} Ajoutez TableNow à votre application d’authentification avec le QR code, puis saisissez le code qu’elle affiche.</p>}
      {stage === "mfa" && <p id="code-help">{googleFlow ? "Votre compte Google est vérifié. " : mode === "reset" ? "Votre e-mail est vérifié. " : ""}{useBackup ? "Saisissez l’un des codes de secours conservés lors de votre inscription. Chaque code ne fonctionne qu’une fois." : googleFlow ? "Pour terminer la connexion, ouvrez votre application d’authentification et saisissez le code affiché pour TableNow." : "Ouvrez votre application d’authentification et saisissez le code affiché pour TableNow. Ce code est différent de celui reçu par e-mail."}</p>}
      {stage === "backup" && <p>Conservez ces codes dans votre gestionnaire de mots de passe. Ils permettent de vous connecter si votre application d’authentification est indisponible.</p>}
      <form onSubmit={submit}>
        {stage === "credentials" && <>
          {mode === "signup" && <label className="tn-field"><span>Nom</span><input name="name" placeholder="Votre nom" autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} required /></label>}
          <label className="tn-field"><span>E-mail</span><input name="email" type="email" placeholder="Votre adresse e-mail" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label className="tn-field"><span id="password-label">{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</span><div className="tn-password-input"><input name="password" aria-labelledby="password-label" placeholder={mode === "reset" ? "Votre nouveau mot de passe" : "Votre mot de passe"} type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 15} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required aria-describedby={mode !== "login" ? "password-help" : undefined} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {mode !== "login" && <small id="password-help">Au moins 15 caractères. Vous pouvez utiliser une phrase.</small>}
          {mode !== "reset" && <div className="tn-account-options"><label className="tn-account-remember"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} /><span>Se souvenir de moi</span></label><Link className="tn-account-recovery" href="/forgot-password">Mot de passe oublié ?</Link></div>}
        </>}
        {stage === "enroll" && <div className="tn-enrollment">{qr && <img src={qr} width={208} height={208} alt="QR code à scanner dans votre application d’authentification" />}<details open={!qr}><summary>Saisir la clé manuellement</summary><code>{secret}</code><button type="button" className="tn-link" onClick={() => void copySecret()}>Copier la clé</button><p role="status">{copyNotice}</p><p>Clé basée sur le temps · TableNow</p></details></div>}
        {["email", "enroll", "mfa"].includes(stage) && <label className={`tn-field ${useBackup ? "" : "tn-code-field"}`}>
          <span className={useBackup ? "" : "tn-visually-hidden"}>{codeLabel}</span>
          <div className={useBackup ? undefined : "tn-code-entry"}>
            {!useBackup && <div className="tn-code-cells" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <span key={index} data-active={index === Math.min(code.length, 5)}>{code[index] || ""}</span>)}</div>}
            <input ref={codeRef} name="code" className={useBackup ? "" : "tn-account-code"} inputMode={useBackup ? "text" : "numeric"} autoComplete={stage === "email" ? "one-time-code" : "off"} autoCapitalize="none" spellCheck={false} pattern={useBackup ? undefined : "[0-9]{6}"} minLength={6} maxLength={useBackup ? 64 : 6} required onPaste={event => { if (!useBackup) { event.preventDefault(); setCode(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)); } }} aria-describedby="code-help" aria-invalid={error ? true : undefined} value={code} onChange={e => setCode(useBackup ? e.target.value.trim() : e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
        </label>}
        {stage === "backup" && <><div className="tn-backup-codes">{backupCodes.map(item => <code key={item}>{item}</code>)}</div><button type="button" className="tn-link" onClick={downloadBackupCodes}>Télécharger mes codes</button><label className="tn-backup-saved"><input type="checkbox" checked={backupSaved} onChange={e => setBackupSaved(e.target.checked)} required /><span>J’ai conservé mes codes de secours.</span></label></>}
        {error && <p className="tn-error" role="alert">{error}</p>}
        <button className="tn-primary tn-account-submit" type="submit" disabled={busy || (stage === "backup" && !backupSaved)}>{busy && <LoaderCircle size={17} className="spinning" />}{stage === "credentials" ? mode === "signup" ? "Créer mon compte" : mode === "login" ? "Se connecter" : "Continuer" : "Continuer"}</button>
      </form>
      {stage === "credentials" && mode !== "reset" && <div className="tn-account-social">
        <div className="tn-account-divider"><span>OU</span></div>
        <button type="button" disabled={busy || !googleStart} aria-describedby={!googleStart ? "social-help" : undefined} onClick={() => { if (googleStart) { setBusy(true); window.location.assign(`${googleStart}?remember=${rememberMe ? "1" : "0"}`); } }}><img src="/brand/google-official.png" width={20} height={20} alt="" />Continuer avec Google</button>
        <button type="button" disabled aria-describedby="social-help"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.1 12.5c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.2-2.5.8-3.1.8-.6 0-1.6-.8-2.6-.8-1.4 0-2.7.8-3.4 2-1.5 2.4-.4 6.1 1 8.1.7 1 1.4 2 2.5 2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.7-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3ZM15 6.4c.5-.7.9-1.7.8-2.7-.8 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.5 1 .1 2-.5 2.6-1.1Z" /></svg>Continuer avec Apple</button>
        <small id="social-help">{googleStart ? "Connexion Apple indisponible pour le moment." : "Connexions Google et Apple indisponibles pour le moment."}</small>
      </div>}
      {stage === "email" && <div className="tn-account-resend"><span>Vous n’avez pas reçu le code ?</span><button type="button" className="tn-link" disabled={busy || cooldown > 0} onClick={() => void resend()}>{cooldown ? `Renvoyer dans ${cooldown} s` : "Renvoyer le code"}</button></div>}
      {stage === "mfa" && <button type="button" className="tn-link tn-account-alternative" disabled={busy} onClick={() => { setUseBackup(value => !value); setCode(""); setError(""); }}>{useBackup ? "Utiliser mon application" : "Utiliser un code de secours"}</button>}
      {stage === "credentials" && <p className="tn-auth-access">{mode === "login" ? <>Pas encore de compte ? <Link href="/register">Créer un compte</Link></> : <>Déjà inscrit ? <Link href="/login">Se connecter</Link></>}</p>}
    </section>
    <footer className="tn-auth-footer"><Link href="/legal/privacy">Confidentialité</Link><span>·</span><Link href="/legal/terms">Conditions d’utilisation</Link></footer>
  </main>;
}
