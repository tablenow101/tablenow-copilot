"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="center-page"><div className="auth-card"><span className="eyebrow">Incident isolé</span><h1>L'écran n'a pas pu être chargé.</h1><p>Vos données n'ont pas été modifiées. Vous pouvez relancer cet écran.</p><button className="primary-button" onClick={reset}>Réessayer</button></div></main>;
}
