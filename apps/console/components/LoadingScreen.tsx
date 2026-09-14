import { Brand } from "./Brand";

export function LoadingScreen({ label = "TableNow prépare votre espace" }: { label?: string }) {
  return <main className="loading-screen"><Brand className="loading-brand" /><div className="loading-line"><i /></div><p>{label}</p></main>;
}
