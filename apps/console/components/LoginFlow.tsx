"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { isPublicPilotRuntime } from "@/lib/public-pilot-host";

export function LoginFlow({ initialPublicPilot = false }: { initialPublicPilot?: boolean }) {
  const router = useRouter();
  const [publicPilot, setPublicPilot] = useState(initialPublicPilot);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isPublic = isPublicPilotRuntime();
    setPublicPilot(isPublic);
    if (!isPublic) api("/v1/auth/session").then(() => router.replace("/today")).catch(() => undefined);
  }, [router]);

  const requestCode = async () => {
    setBusy(true); setError("");
    try {
      await api("/v1/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'envoyer le code.");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError("");
    try {
      await api("/v1/auth/verify-code", { method: "POST", body: JSON.stringify({ email, code }) });
      const session = await api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session");
      router.replace(session.tenant.onboardingComplete ? "/today" : "/onboarding");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Le code n'a pas pu être vérifié.");
    } finally { setBusy(false); }
  };

  const openPublicPilot = async () => {
    setBusy(true); setError("");
    try {
      router.replace("/today");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "L'accès pilote n'est pas disponible.");
    } finally { setBusy(false); }
  };

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="story-glow" />
        <div className="logo-lockup logo-auth"><span className="brand-mark brand-mark-small">T<span>N</span></span><span>TableNow<small>Operating Copilot</small></span></div>
        <div className="story-content">
          <span className="eyebrow"><span className="live-dot" /> {publicPilot ? "Pilote officiel TableNow" : "Accès pilote privé"}</span>
          <h1>Votre restaurant.<br /><em>Enfin lisible.</em></h1>
          <p>TableNow rassemble le service, les clients et les opérations — puis transforme chaque signal en décision claire.</p>
          <div className="story-proof">
            <div><Check size={15} /><span>Pas de mot de passe</span></div>
            <div><ShieldCheck size={15} /><span>Données isolées par restaurant</span></div>
            <div><LockKeyhole size={15} /><span>Actions sensibles toujours validées</span></div>
          </div>
        </div>
        <p className="story-footer">Conçu pour continuer à fonctionner dans votre établissement.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          {step === "email" ? <>
            <span className="step-number">01 — IDENTITÉ</span>
            <h2>{publicPilot ? "Découvrez TableNow." : "Entrez dans votre espace."}</h2>
            <p>{publicPilot ? "Parcourez le produit final avec un restaurant entièrement fictif, sans compte ni connexion à une donnée réelle." : "Utilisez l'adresse invitée par TableNow. Nous vous enverrons un code à six chiffres."}</p>
            {publicPilot ? <>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button full-button" disabled={busy} onClick={openPublicPilot}>{busy ? "Ouverture…" : "Découvrir la version pilote"}<ArrowRight size={17} /></button>
              <p className="privacy-note"><ShieldCheck size={14} /> Données fictives, navigation complète et actions désactivées.</p>
            </> : <>
              <label className="field-label" htmlFor="email">Adresse e-mail professionnelle</label>
              <div className="input-with-icon"><Mail size={17} /><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="direction@restaurant.fr" onKeyDown={(event) => { if (event.key === "Enter" && email) void requestCode(); }} /></div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button full-button" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} onClick={requestCode}>{busy ? "Envoi…" : "Recevoir mon code"}<ArrowRight size={17} /></button>
              <p className="privacy-note"><ShieldCheck size={14} /> Aucun compte n'est créé sans invitation active.</p>
            </>}
          </> : <>
            <button className="back-link" onClick={() => { setStep("email"); setCode(""); setError(""); }}>← Changer d'adresse</button>
            <span className="step-number">02 — VÉRIFICATION</span>
            <h2>Regardez votre boîte mail.</h2>
            <p>Le code a été envoyé à <strong>{email}</strong>. Il reste valable dix minutes.</p>
            <label className="field-label" htmlFor="code">Code à six chiffres</label>
            <input ref={codeRef} id="code" className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(event) => { if (event.key === "Enter" && code.length === 6) void verify(); }} placeholder="••••••" />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button full-button" disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Vérification…" : "Ouvrir TableNow"}<ArrowRight size={17} /></button>
            <button className="resend-link" disabled={busy} onClick={requestCode}><RotateCcw size={14} /> Renvoyer le code</button>
          </>}
        </div>
        <nav className="auth-legal" aria-label="Informations juridiques"><Link href="/legal/privacy">Confidentialité</Link><Link href="/legal/cookies">Cookies</Link><Link href="/legal/terms">Conditions</Link><Link href="/legal/legal-notice">Mentions légales</Link></nav>
      </section>
    </main>
  );
}
