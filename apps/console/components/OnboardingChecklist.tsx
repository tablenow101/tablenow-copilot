"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { OnboardingDraftView } from "@tablenow/contracts";
import { api } from "@/lib/api";
import { onboardingChecklist } from "@/lib/onboarding-checklist";

export function OnboardingChecklist({ restaurantId }: { restaurantId: string }) {
  const [draft, setDraft] = useState<OnboardingDraftView | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    setDraft(null); setError(false);
    void api<OnboardingDraftView>(`/v1/onboarding?restaurantId=${encodeURIComponent(restaurantId)}`, { signal: controller.signal })
      .then(result => { if (live) setDraft(result); })
      .catch(() => { if (live) setError(true); })
      .finally(() => clearTimeout(timer));
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [restaurantId, attempt]);
  const items = draft ? onboardingChecklist(draft.answers) : [];
  const pending = items.filter(item => !item.complete);
  const completed = items.filter(item => item.complete);
  return <section className="tn-setup-checklist" aria-labelledby="setup-checklist-title">
    <div><h2 id="setup-checklist-title">Votre configuration, à votre rythme</h2><p>Ces étapes viennent de vos réponses enregistrées. Vous pouvez déjà préparer votre service.</p></div>
    {error ? <p role="alert">Votre checklist n’a pas pu être chargée. <button className="tn-link" onClick={() => setAttempt(value => value + 1)}>Réessayer</button></p>
      : !draft ? <p role="status">Lecture de vos réponses…</p>
      : <>
        {pending.length > 0 && <ul>{pending.map(item => <li key={item.id}><Link href={`/onboarding?restaurantId=${restaurantId}&section=${item.section}${item.step ? `&step=${item.step}` : ""}`}><span><strong>{item.title}</strong><small>{item.reason}</small></span><ChevronRight size={18} /></Link></li>)}</ul>}
        {completed.length > 0 && <details><summary>{completed.length} étape{completed.length > 1 ? "s" : ""} déjà renseignée{completed.length > 1 ? "s" : ""}</summary><ul>{completed.map(item => <li key={item.id}><Link href={`/onboarding?restaurantId=${restaurantId}&section=${item.section}${item.step ? `&step=${item.step}` : ""}`}><Check size={16} /><span><strong>{item.title}</strong><small>{item.reason}</small></span><ChevronRight size={18} /></Link></li>)}</ul></details>}
        {pending.length === 0 && <p>Les informations de base sont renseignées. Ce statut ne certifie aucune connexion à un logiciel.</p>}
      </>}
  </section>;
}
