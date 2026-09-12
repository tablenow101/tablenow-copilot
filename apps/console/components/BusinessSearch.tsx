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
  const [results, setResults] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function search() {
    if (value.trim().length < 3) {
      setNotice(
        english
          ? "Enter at least 3 characters."
          : "Saisissez au moins 3 caractères.",
      );
      return;
    }
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setNotice("");
    setResults([]);
    try {
      const response = await api<{ results: Suggestion[] }>(
        `/v1/onboarding/search?q=${encodeURIComponent(value.trim())}`,
        { signal: active.signal },
      );
      if (active.signal.aborted) return;
      setResults(response.results);
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
                ? "Search public directory"
                : "Rechercher dans l’annuaire public"
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
          ? "French public directory · Search is sent only when you confirm. Outside France, use manual entry."
          : "Annuaire public français · Recherche transmise uniquement à votre demande. Hors de France, utilisez la saisie manuelle."}
      </p>
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
                  {english ? "Public source" : "Voir la source publique"}
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  choose(result);
                  setResults([]);
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
