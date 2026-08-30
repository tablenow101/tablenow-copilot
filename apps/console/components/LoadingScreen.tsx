export function LoadingScreen({ label = "TableNow prépare votre espace" }: { label?: string }) {
  return <main className="loading-screen"><div className="brand-mark">T<span>N</span></div><div className="loading-line"><i /></div><p>{label}</p></main>;
}
