"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { api } from "@/lib/api";

type Suggestion = {
  id: string;
  name: string;
  address: string;
  cityCountry: string;
  sourceUrl: string;
  sourceLabel?: string;
  phone?: string;
  website?: string;
  category?: string;
  openingHours?: string[];
};
export function BusinessSearch({
  value,
  onChange,
  choose,
  english = false,
}: {
  value: string;
  onChange: (value: string) => void;
  choose: (result: Suggestion) => void;
  english?: boolean;
}) {
  const session = useRef<string>("");
  const [details, setDetails] = useState<Suggestion | null>(null);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search(publicDirectory = false) {
    if (value.trim().length < 3) {
      setNotice(
        english
          ? "Enter at least 3 characters."
          : "Saisissez au moins 3 caractères.",
      );
      return;
    }
    session.current ||= crypto.randomUUID();
    setDetails(null);
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setNotice("");
    setResults([]);
    try {
      const response = await api<{ results: Suggestion[] }>(
        publicDirectory ? `/v1/onboarding/search?q=${encodeURIComponent(value.trim())}` : `/v1/onboarding/places/search?${new URLSearchParams({ value: value.trim(), session: session.current, locale: english ? "en" : "fr" })}`,
        { signal: active.signal },
      );
      if (active.signal.aborted) return;
      setResults(response.results.map(result => ({ ...result, sourceLabel: publicDirectory ? "Annuaire des entreprises" : "Google Maps" })));
      if (!response.results.length)
        setNotice(
          english
            ? "No match found. You can add your restaurant manually."
            : "Aucun établissement trouvé. Vous pouvez le renseigner manuellement.",
        );
    } catch (error) {
      if (!active.signal.aborted)
        setNotice(
          error instanceof Error
            ? error.message
            : "Recherche indisponible. La saisie manuelle reste possible.",
        );
    } finally {
      if (!active.signal.aborted) setBusy(false);
    }
  }
  return (
    <div>
      <label className="welcome-search">
        <span className="sr-only">
          {english ? "Restaurant name and city" : "Nom du restaurant et ville"}
        </span>
        <div className="input-with-action">
          <Search size={25} strokeWidth={1.5} />
          <input
            maxLength={240}
            value={value}
            onChange={(event) => {
              controller.current?.abort();
              setBusy(false);
              setResults([]);
              setNotice("");
              setDetails(null);
              onChange(event.target.value);
            }}
            placeholder={
              english
                ? "Your restaurant, your city…"
                : "Votre restaurant, votre ville…"
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            aria-label={
              english
                ? "Search Google Places"
                : "Rechercher avec Google Places"
            }
            onClick={() => void search()}
          >
            {busy ? (
              <LoaderCircle size={25} className="spinning" />
            ) : (
              <ArrowRight size={26} />
            )}
          </button>
        </div>
      </label>
      <p className="subtle-note">
        {english
          ? "Google Maps · Search is sent only when you confirm."
          : "Google Maps · Recherche transmise uniquement à votre demande."}
      </p>
      <button type="button" className="text-action" disabled={busy} onClick={() => void search(true)}>{english ? "Search the French public directory" : "Rechercher dans l’annuaire public français"}</button>
      {details && <div className="subtle-note">
        {details.website && <p>{details.website}</p>}
        {details.category && <p>{details.category}</p>}
        {details.openingHours?.map(line => <p key={line}>{line}</p>)}
      </div>}
      {notice && (
        <p role="status" className="inline-error">
          {notice}
        </p>
      )}
      {results.length > 0 && (
        <div
          className="tn-business-results"
          aria-label={
            english ? "Establishments to confirm" : "Établissements à confirmer"
          }
        >
          {results.map((result) => (
            <article key={result.id}>
              <div>
                <strong>{result.name}</strong>
                <small>{result.address || result.cityCountry}</small>
                <a
                  href={result.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {result.sourceLabel || "Google Maps"}
                </a>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (result.sourceLabel === "Annuaire des entreprises") { setDetails(null); choose(result); setResults([]); return; }
                  controller.current?.abort();
                  const active = new AbortController(); controller.current = active;
                  setBusy(true); setNotice("");
                  try {
                    const selected = await api<Suggestion>(`/v1/onboarding/places/details?${new URLSearchParams({ value: result.id, session: session.current, locale: english ? "en" : "fr" })}`, { signal: active.signal });
                    if (active.signal.aborted) return;
                    session.current = "";
                    setDetails(selected); choose(selected); setResults([]);
                  } catch { if (!active.signal.aborted) setNotice(english ? "Details unavailable. Please try again or enter manually." : "Détails indisponibles. Réessayez ou utilisez la saisie manuelle."); }
                  finally { if (!active.signal.aborted) setBusy(false); }
                }}
              >
                {english ? "Select" : "Choisir"}
                <ArrowRight size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
