import Link from "next/link";

export default function NotFound() {
  return <main className="center-page"><div className="auth-card"><span className="eyebrow">TableNow OS</span><h1>Écran introuvable.</h1><p>Cette page n'existe pas.</p><Link className="primary-button" href="/dashboard">Revenir au dashboard</Link></div></main>;
}
