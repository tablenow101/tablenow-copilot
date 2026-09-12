"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, Moon, Sun } from "lucide-react";
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
  const codeRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  async function enterApp() {
    const session = await api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
    router.replace(session.tenant.onboardingComplete ? "/today" : "/onboarding");
    router.refresh();
  }
  useEffect(() => {
    let live = true;
    try { setTheme(localStorage.getItem("tn-theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "clear" : "dark")); } catch { /* Optional preference persistence. */ }
    void api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session").then(session => {
      if (live && !started.current) router.replace(session.tenant.onboardingComplete ? "/today" : "/onboarding");
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
        const next = await api<NextStage>(`/v1/account/${mode}`, { method: "POST", body: JSON.stringify({ email, password, ...(mode === "signup" ? { name } : {}) }) });
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
  const title = stage === "credentials" ? (mode === "signup" ? "Créer votre compte" : mode === "reset" ? "Nouveau mot de passe" : "Connexion") : stage === "email" ? "Vérifiez votre adresse" : stage === "enroll" ? "Double authentification" : stage === "backup" ? "Codes de secours" : stage === "complete" ? "Connexion établie" : "Vérifiez votre identité";
  return <main className={`tn-auth tn-account theme-${theme}`}>
    <button type="button" className="tn-icon tn-theme-switch" onClick={changeTheme} aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>
    <header className="tn-auth-header"><Brand /></header>
    <section className="tn-auth-card" aria-labelledby="auth-title" aria-busy={busy}>
      <h1 id="auth-title">{title}</h1>
      {stage === "email" && <p>Le code envoyé à <strong>{email}</strong> est valable 10 minutes.</p>}
      {stage === "enroll" && <p>Ajoutez TableNow dans votre application d’authentification, puis saisissez le code à six chiffres.</p>}
      {stage === "mfa" && <p>{useBackup ? "Utilisez l’un de vos codes de secours. Chaque code ne fonctionne qu’une fois." : "Saisissez le code de votre application d’authentification."}</p>}
      {stage === "backup" && <p>Conservez ces codes dans votre gestionnaire de mots de passe. Ils permettent de vous connecter si votre application d’authentification est indisponible.</p>}
      <form onSubmit={submit}>
        {stage === "credentials" && <>
          {mode === "signup" && <label className="tn-field"><span>Votre nom</span><input name="name" autoComplete="name" maxLength={100} value={name} onChange={e => setName(e.target.value)} required /></label>}
          <label className="tn-field"><span>E-mail</span><input name="email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label className="tn-field"><span>{mode === "reset" ? "Nouveau mot de passe" : "Mot de passe"}</span><div className="tn-password-input"><input name="password" type={visible ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "login" ? 1 : 15} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required aria-describedby={mode !== "login" ? "password-help" : undefined} /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {mode !== "login" && <small id="password-help">Au moins 15 caractères. Vous pouvez utiliser une phrase.</small>}
          {mode === "login" && <Link className="tn-account-recovery" href="/forgot-password">Mot de passe oublié ?</Link>}
        </>}
        {stage === "enroll" && <div className="tn-enrollment">{qr && <img src={qr} width={208} height={208} alt="QR code à scanner dans votre application d’authentification" />}<details open={!qr}><summary>Saisir la clé manuellement</summary><code>{secret}</code><button type="button" className="tn-link" onClick={() => void copySecret()}>Copier la clé</button><p role="status">{copyNotice}</p><p>Clé basée sur le temps · TableNow</p></details></div>}
        {["email", "enroll", "mfa"].includes(stage) && <label className="tn-field"><span>{useBackup ? "Code de secours" : "Code à six chiffres"}</span><input ref={codeRef} name="code" className={useBackup ? "" : "tn-account-code"} inputMode={useBackup ? "text" : "numeric"} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} pattern={useBackup ? undefined : "[0-9]{6}"} minLength={6} maxLength={useBackup ? 64 : 6} required value={code} onChange={e => setCode(useBackup ? e.target.value.trim() : e.target.value.replace(/\D/g, "").slice(0, 6))} /></label>}
        {stage === "backup" && <><div className="tn-backup-codes">{backupCodes.map(item => <code key={item}>{item}</code>)}</div><button type="button" className="tn-link" onClick={downloadBackupCodes}>Télécharger mes codes</button><label className="tn-backup-saved"><input type="checkbox" checked={backupSaved} onChange={e => setBackupSaved(e.target.checked)} required /><span>J’ai conservé mes codes de secours.</span></label></>}
        {error && <p className="tn-error" role="alert">{error}</p>}
        <button className="tn-primary tn-account-submit" type="submit" disabled={busy || (stage === "backup" && !backupSaved)}>{busy ? <LoaderCircle size={17} className="spinning" /> : null}{stage === "credentials" ? mode === "signup" ? "Créer mon compte" : mode === "login" ? "Se connecter" : "Continuer" : stage === "backup" || stage === "complete" ? "Continuer" : "Vérifier"}<ArrowRight size={17} /></button>
      </form>
      {stage === "email" && <button type="button" className="tn-link" disabled={busy || cooldown > 0} onClick={() => void resend()}>{cooldown ? `Renvoyer le code dans ${cooldown} s` : "Renvoyer le code"}</button>}
      {stage === "email" && <p className="tn-auth-access"><Link href="/login">Se connecter</Link><span> · </span><Link href="/forgot-password">Mot de passe oublié</Link></p>}
      {stage === "mfa" && <button type="button" className="tn-link" disabled={busy} onClick={() => { setUseBackup(value => !value); setCode(""); setError(""); }}>{useBackup ? "Utiliser mon application" : "Utiliser un code de secours"}</button>}
      {stage === "credentials" ? <p className="tn-auth-access">{mode === "login" ? <>Pas encore de compte ? <Link href="/register">Créer votre compte</Link></> : <>Déjà inscrit ? <Link href="/login">Se connecter</Link></>}</p> : stage !== "backup" && stage !== "complete" && <button type="button" className="tn-back" disabled={busy} onClick={() => { setStage("credentials"); setCode(""); setSecret(""); setQr(""); setError(""); setCopyNotice(""); setUseBackup(false); }}><ArrowLeft size={16} /> Recommencer</button>}
    </section>
    <footer className="tn-auth-footer"><Link href="/legal/privacy">Confidentialité</Link><span>·</span><Link href="/legal/terms">Conditions d’utilisation</Link></footer>
  </main>;
}
