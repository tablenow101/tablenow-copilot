"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Brand } from "./Brand";
import Image from "next/image";

export function LoginFlow({
  initialPublicPilot: _unused,
}: {
  initialPublicPilot?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let live = true;
    void api<{ tenant: { onboardingComplete: boolean } }>("/v1/auth/session")
      .then((s) => {
        if (live)
          router.replace(
            s.tenant.onboardingComplete ? "/today" : "/onboarding",
          );
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [router]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);
  async function requestCode() {
    if (busy || cooldown) return;
    setBusy(true);
    setError("");
    try {
      await api("/v1/auth/request-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setStep("code");
      setCode("");
      setCooldown(60);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "L’envoi est indisponible. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await api("/v1/auth/verify-code", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const session = await api<{ tenant: { onboardingComplete: boolean } }>(
        "/v1/auth/session",
      );
      router.replace(
        session.tenant.onboardingComplete ? "/today" : "/onboarding",
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Ce code n’a pas pu être vérifié.",
      );
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void (step === "email" ? requestCode() : verify());
  }
  return (
    <main className="tn-auth">
      <header className="tn-auth-header">
        <Brand />
      </header>
      <section className="tn-auth-card" aria-labelledby="auth-title">
        {step === "code" && (
          <button
            className="tn-back"
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError("");
            }}
          >
            <ArrowLeft size={17} /> Modifier l’adresse
          </button>
        )}
        <h1 id="auth-title">
          {step === "email" ? (
            <>
              Connexion à TableNow OS
            </>
          ) : (
            <>
              Un dernier pas.
              <br />
              Vous êtes chez vous.
            </>
          )}
        </h1>
        <p>
          {step === "email" ? (
            "Entrez votre adresse e-mail professionnelle pour recevoir votre code ou lien d’accès."
          ) : (
            <>
              Si cette adresse dispose d’un accès, vous recevrez un code à{" "}
              <strong>{email}</strong>.
            </>
          )}
        </p>
        <form onSubmit={submit}>
          {step === "email" ? (
            <label className="tn-field">
              <span>Votre e-mail</span>
              <div className="tn-email-input">
                <Mail size={18} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@restaurant.fr"
                  aria-describedby={error ? "auth-error" : "auth-access"}
                />
              </div>
            </label>
          ) : (
            <label className="tn-field">
              <span>Code de vérification</span>
              <div className="tn-otp-wrap">
                <div className="tn-otp-slots" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span
                      key={i}
                      className={code.length === i ? "focused" : ""}
                    >
                      {code[i] || ""}
                    </span>
                  ))}
                </div>
                <input
                  ref={codeRef}
                  name="code"
                  aria-label="Code de vérification à six chiffres"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
              </div>
            </label>
          )}
          {error && (
            <p id="auth-error" className="tn-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="tn-primary tn-wide"
            disabled={
              busy ||
              (step === "code" ? code.length !== 6 : !email || cooldown > 0)
            }
          >
            {busy ? <LoaderCircle size={18} className="spinning" /> : null}
            {busy
              ? "Un instant…"
              : step === "email"
                ? "Recevoir mon code"
                : "Entrer dans TableNow"}
            <ArrowRight size={18} />
          </button>
        </form>
        {step === "email" ? (
          <>
            <div className="tn-separator">
              <span>ou</span>
            </div>
            <button
              className="tn-secondary tn-wide tn-google-button"
              disabled
              aria-describedby="google-unavailable"
            >
              <Image src="/brand/google-official.png" width={20} height={20} alt="" />
              Continuer avec Google
            </button>
            <small id="google-unavailable" className="tn-muted tn-center">
              Connexion Google non configurée.
            </small>
            <p id="auth-access" className="tn-auth-access">
              Accès propriétaire sur invitation. Utilisez l’adresse invitée à
              TableNow.
            </p>
          </>
        ) : (
          <>
            <p className="tn-code-help">
              Le code expire après 10 minutes. Pensez à vérifier les
              indésirables.
            </p>
            <button
              className="tn-link tn-wide"
              disabled={busy || cooldown > 0}
              onClick={() => void requestCode()}
            >
              {cooldown
                ? `Renvoyer le code dans ${cooldown} s`
                : "Renvoyer un code"}
            </button>
          </>
        )}
      </section>
      {step === "email" && (
        <footer className="tn-auth-footer">
          <Link href="/legal/privacy">Confidentialité</Link>
          <span>·</span>
          <Link href="/legal/terms">Conditions d’utilisation</Link>
        </footer>
      )}
    </main>
  );
}
