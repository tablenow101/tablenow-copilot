"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, Link2 } from "lucide-react";
import type { OnboardingAnswers } from "@tablenow/contracts";
import type { LocaleMode } from "../lib/onboarding";
import { declaredIntegrationGuides } from "../lib/integration-guidance";

export function IntegrationConnections({ answers, locale, edit }: { answers: OnboardingAnswers; locale: LocaleMode; edit: () => void }) {
  const [opened, setOpened] = useState<string | null>(null);
  const tools = declaredIntegrationGuides(answers);
  const fr = locale === "fr";
  return <section className="onboarding-connections" aria-labelledby="connections-heading">
    <h2 id="connections-heading">{fr ? "Rapprochons vos outils" : "Bring your tools together"}</h2>
    <p>{fr ? "Voici les outils que vous avez indiqués. Ouvrez chacun pour connaître la prochaine étape. Vous pouvez poursuivre et revenir ici plus tard." : "These are the tools you declared. Open each one to see the next step. You can continue and return here later."}</p>
    {tools.length ? <ul className="onboarding-connection-list">{tools.map(tool => <li key={tool.id}>
      <div className="integration-heading"><Link2 size={18} aria-hidden="true" /><strong>{tool.name}</strong><span>{fr ? "À connecter" : "To connect"}</span></div>
      <p>{tool.blocker[locale]}</p>
      <button type="button" className="secondary-button integration-toggle" aria-expanded={opened === tool.id} aria-controls={`integration-${tool.id}`} onClick={() => setOpened(opened === tool.id ? null : tool.id)}>{fr ? "Voir la prochaine étape" : "See the next step"}<ChevronDown size={16} aria-hidden="true" /></button>
      {opened === tool.id && <div id={`integration-${tool.id}`} className="integration-next"><p>{tool.next[locale]}</p>
        {tool.source ? <a className="text-button" href={tool.source} target="_blank" rel="noopener noreferrer">{fr ? `Procédure officielle ${tool.sourceLabel}` : `Official ${tool.sourceLabel} procedure`}<ArrowUpRight size={15} aria-hidden="true" /><span className="sr-only">{fr ? " — nouvel onglet" : " — new tab"}</span></a> : <button className="text-button" type="button" onClick={edit}>{fr ? "Préciser mes outils" : "Specify my tools"}</button>}
        <small>{fr ? "Connexion non active. Aucune donnée n’est synchronisée." : "Connection is not active. No data is being synchronized."}</small>
      </div>}
    </li>)}</ul> : <p className="inline-note">{fr ? "Vous n’avez déclaré aucun outil à connecter. TableNow peut vous accompagner à partir de votre fonctionnement manuel." : "You have not declared any tools to connect. TableNow can support your manual workflow."}</p>}
    <button type="button" className="text-button" onClick={edit}>{fr ? "Corriger mes outils" : "Edit my tools"}</button>
    <p className="inline-note">{fr ? "Votre premier plan s’appuiera sur vos réponses. Les conseils issus de vos logiciels seront identifiés après une connexion et une première lecture réussies." : "Your first plan will use your answers. Advice based on your software data will be identified after a successful connection and first read."}</p>
  </section>;
}
