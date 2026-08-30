import Link from "next/link";

export default function NotFound() {
  return <main className="center-page"><div className="auth-card"><span className="eyebrow">TableNow</span><h1>Écran introuvable.</h1><p>Ce parcours n'existe pas dans le copilote.</p><Link className="primary-button" href="/today">Revenir à Aujourd'hui</Link></div></main>;
}
