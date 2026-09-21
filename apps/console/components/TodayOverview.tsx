"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronRight, ClipboardList, ListChecks } from "lucide-react";
import type { Workspace } from "@/lib/types";
import { summarizeToday } from "@/lib/today-overview";

export function TodayOverview({ workspace, timeZone, phase, busy, onPrepare, onAddTask, onShowPreparation }: {
  workspace: Workspace; timeZone: string; phase: string; busy: boolean;
  onPrepare: () => void; onAddTask: () => void; onShowPreparation: () => void;
}) {
  const data = summarizeToday(workspace.reservations, workspace.tasks, timeZone);
  const decision = workspace.decisions.find(item => item.status === "open");
  const progress = data.preparation;
  return <div className="tn-today-overview">
    <section className="tn-today-hero" aria-label="Réservations enregistrées aujourd’hui"
      onPointerMove={event => {
        if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty("--hero-x", `${((event.clientX - rect.left) / rect.width - .5) * 8}px`);
        event.currentTarget.style.setProperty("--hero-y", `${((event.clientY - rect.top) / rect.height - .5) * 8}px`);
      }}
      onPointerLeave={event => {
        event.currentTarget.style.removeProperty("--hero-x");
        event.currentTarget.style.removeProperty("--hero-y");
      }}>
      <div className="tn-today-hero-head"><span>AUJOURD’HUI</span><Link href="/service">Voir le service <ArrowUpRight size={15} /></Link></div>
      <div className={`tn-today-metric${data.reservations ? "" : " tn-today-metric-empty"}`}>{data.reservations ? <><strong>{phase === "after" ? data.completedCovers : data.covers}</strong><div><span>{phase === "after" ? "couverts terminés" : "couverts enregistrés"}</span><small>{data.reservations} réservation{data.reservations === 1 ? "" : "s"} du jour</small></div></> : <h2>Préparons votre prochain service.</h2>}</div>
      {data.arrivals.length > 0 ? <details className="tn-arrival-distribution">
        <summary>Répartition des arrivées <ChevronRight size={15} /></summary>
        <ul>{data.arrivals.map(item => <li key={item.label}><span>{item.label}</span><meter min={0} max={data.covers} value={item.covers} aria-label={`${item.label} : ${item.covers} couverts`} /><strong>{item.covers}</strong></li>)}</ul>
      </details> : <p>Aucune réservation du jour n’est enregistrée dans TableNow. Cela ne signifie pas que votre restaurant n’en a pas. <Link href="/service">Ajouter une réservation <ArrowRight size={14} /></Link></p>}
      <small className="tn-today-source">Source : réservations enregistrées dans TableNow</small>
    </section>
    <div className="tn-today-next">
      <section className="tn-today-priority">
        <div className="tn-today-kicker"><span />{decision ? "À VOTRE DÉCISION" : "VOTRE PROCHAIN PAS"}</div>
        <h2>{decision?.title || "Trois points à partager avant le service."}</h2>
        {!decision && <div className="tn-today-advice">
          <p>Les changements du jour, les points à surveiller et la personne à solliciter en cas de besoin : partagez-les avec votre équipe avant l’ouverture.</p>
          <span className="tn-advice-basis">Conseil métier général · à adapter à votre organisation</span>
          <details><summary>Pourquoi ce conseil ?</summary><p>Il peut aider à limiter les malentendus. Son effet n’a pas été mesuré pour votre restaurant ; aucune donnée connectée n’est nécessaire pour le préparer.</p><p>Base : pratique professionnelle du briefing. Confiance limitée à ce conseil général, sans diagnostic de votre activité. Vous décidez des points à retenir avant tout envoi.</p><p>Source : <a href="https://www.lightspeedhq.fr/blog/20-conseils-rapides-pour-optimiser-la-productivite-de-votre-restaurant/" target="_blank" rel="noreferrer">Guide Lightspeed, conseil 10</a>, publié le 12 avril 2022, consulté le 21 septembre 2026.</p></details>
        </div>}
        {decision ? <Link className="tn-primary" href="/decisions">Examiner la décision <ArrowRight size={18} /></Link> : <button className="tn-primary" disabled={busy} onClick={onPrepare}>{busy ? "Préparation en cours…" : phase === "after" ? "Préparer le prochain service" : "Préparer le briefing"}<ArrowRight size={18} /></button>}
      </section>
      <section className="tn-today-preparation">
        {progress ? <>
          <button className="tn-today-progress-link" onClick={onShowPreparation}><span className="tn-today-progress-number"><strong>{progress.done}</strong> / {progress.total}</span><span><strong>Votre préparation avance</strong><small>{progress.total === progress.done ? "Les actions enregistrées sont terminées" : `${progress.total - progress.done} action(s) restent à terminer`}</small></span><ChevronRight size={18} /></button>
          <progress max={progress.total} value={progress.done} aria-label="Actions de préparation terminées" />
        </> : <button className="tn-today-progress-link" onClick={onAddTask}><ClipboardList size={23} /><span><strong>Préparons votre service</strong><small>Ajouter votre première action</small></span><ChevronRight size={18} /></button>}
      </section>
      <Link className="tn-today-priorities" href={`/onboarding?restaurantId=${workspace.restaurants[0]?.id || ""}&section=priorities`}><ListChecks size={18} /><span>Vos priorités, votre accompagnement</span><ChevronRight size={16} /></Link>
    </div>
  </div>;
}
