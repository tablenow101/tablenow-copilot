"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, CheckCircle2, Download, FileKey2, LockKeyhole, ShieldCheck, Trash2, X } from "lucide-react";
import { api, apiHref } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { AppChrome } from "./AppChrome";
import { LoadingScreen } from "./LoadingScreen";
import { ModalFrame } from "./ModalFrame";

interface PrivacyState {
  preferences: { productEmails: boolean; usageAnalytics: boolean; modelImprovement: boolean; updatedAt?: string };
  requests: Array<{ id: string; type: string; details: string | null; status: string; exportExpiresAt: string | null; scheduledFor: string | null; completedAt: string | null; createdAt: string }>;
}

export function PrivacyCenter() {
  const { session, loading } = useSession();
  const [state, setState] = useState<PrivacyState | null>(null);
  const [notice, setNotice] = useState("");
  const [confirmDeletion, setConfirmDeletion] = useState(false);
  const [otherRequest, setOtherRequest] = useState<"rectification" | "restriction" | "objection" | null>(null);
  const [requestDetails, setRequestDetails] = useState("");
  const refresh = useCallback(async () => setState(await api<PrivacyState>("/v1/privacy")), []);
  useEffect(() => { if (session) void refresh(); }, [session, refresh]);
  if (loading || !session || !state) return <LoadingScreen />;

  const toggle = async (key: keyof PrivacyState["preferences"]) => {
    if (key === "updatedAt") return;
    const preferences = { ...state.preferences, [key]: !state.preferences[key] };
    setState({ ...state, preferences });
    try { await api("/v1/privacy/preferences", { method: "PUT", body: JSON.stringify(preferences) }); setNotice("Préférences enregistrées et journalisées."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Impossible d'enregistrer."); await refresh(); }
  };
  const request = async (type: "export" | "deletion" | "rectification" | "restriction" | "objection", details?: string) => { try { await api("/v1/privacy/requests", { method: "POST", body: JSON.stringify({ type, ...(details ? { details } : {}) }) }); setNotice(type === "export" ? "Votre export est en préparation." : type === "deletion" ? "Votre demande d'effacement est enregistrée avec un délai de réversibilité de 30 jours." : "Votre demande est enregistrée pour revue humaine."); setConfirmDeletion(false); setOtherRequest(null); setRequestDetails(""); await refresh(); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Impossible de créer la demande."); } };
  const cancel = async (id: string) => { try { await api(`/v1/privacy/requests/${id}/cancel`, { method: "POST", body: "{}" }); setNotice("Demande annulée."); await refresh(); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Impossible d'annuler la demande."); } };

  return <AppChrome session={session} active="privacy" title="Confidentialité" subtitle="Vos choix, vos exports et vos demandes — accessibles sans passer par le support." onRefresh={() => void refresh()}>
    <div className="privacy-layout"><section className="privacy-main"><div className="privacy-promise"><div><ShieldCheck size={24} /><span><strong>Données privées par défaut.</strong><p>La bêta n'active ni publicité, ni cookie marketing, ni réutilisation des conversations pour entraîner un modèle.</p></span></div><span>RGPD · PILOTE</span></div>{notice && <div className="notice-banner"><CheckCircle2 size={16} />{notice}</div>}
      <section className="panel privacy-section"><header><div><span className="eyebrow">Préférences facultatives</span><h2>Choisir ce qui dépasse le service essentiel</h2></div></header><Preference title="E-mails produit" text="Recevoir les nouveautés et invitations à des entretiens produit." value={state.preferences.productEmails} onChange={() => void toggle("productEmails")} /><Preference title="Mesure d'usage" text="Autoriser des métriques agrégées pour améliorer les parcours, sans publicité." value={state.preferences.usageAnalytics} onChange={() => void toggle("usageAnalytics")} /><Preference title="Amélioration des modèles" text="Autoriser l'utilisation de conversations préalablement pseudonymisées. Désactivé par défaut." value={state.preferences.modelImprovement} onChange={() => void toggle("modelImprovement")} /></section>
      <section className="panel privacy-section"><header><div><span className="eyebrow">Vos droits</span><h2>Agir sans passer par le support</h2></div></header><div className="rights-grid"><button onClick={() => void request("export")}><FileKey2 size={20} /><span><strong>Préparer mon export</strong><small>Compte, restaurants, actions et données associées dans un JSON portable.</small></span></button><button className="danger-right" onClick={() => setConfirmDeletion(true)}><Trash2 size={20} /><span><strong>Demander l'effacement</strong><small>Délai de 30 jours, revue des obligations et possibilité d'annuler.</small></span></button></div><div className="other-rights"><span>Autres demandes :</span><button onClick={() => setOtherRequest("rectification")}>Rectification</button><button onClick={() => setOtherRequest("restriction")}>Limitation</button><button onClick={() => setOtherRequest("objection")}>Opposition</button></div></section>
      <section className="panel table-panel"><div className="panel-title"><div><span>Suivi transparent</span><h2>Mes demandes</h2></div><i>{state.requests.length}</i></div>{state.requests.map((item) => <div className="privacy-request" key={item.id}><span className="request-icon">{item.type === "export" ? <Archive size={17} /> : <Trash2 size={17} />}</span><div><strong>{requestLabel(item.type)}</strong><small>Créée le {new Date(item.createdAt).toLocaleDateString("fr-FR")}</small></div><span className={`status-badge status-${item.status}`}>{requestStatus(item.status)}</span>{item.status === "ready" ? <a className="row-action" href={apiHref(`/v1/privacy/requests/${item.id}/download`)}><Download size={14} /> Télécharger</a> : ["received", "requires_review", "processing"].includes(item.status) ? <button className="row-action" onClick={() => void cancel(item.id)}><X size={14} /> Annuler</button> : <span />}</div>)}{!state.requests.length && <div className="empty-state"><LockKeyhole size={22} /><strong>Aucune demande en cours</strong><p>Chaque demande apparaîtra ici avec son état réel.</p></div>}</section>
    </section><aside className="privacy-aside"><div><LockKeyhole size={20} /><h3>Ce qui est essentiel</h3><p>Deux cookies seulement : session sécurisée et protection CSRF. Ils ne suivent pas votre navigation hors de TableNow.</p></div><div><Archive size={20} /><h3>Durées par défaut</h3><ul><li>Code : 10 minutes</li><li>Session : 7 jours</li><li>Export : 7 jours</li><li>Réservations : 24 mois puis anonymisation</li><li>Journaux sécurité : 12 mois</li></ul></div><div><ShieldCheck size={20} /><h3>Contact</h3><p>Pour toute question ou rectification : <a href="mailto:privacy@tablenow.io">privacy@tablenow.io</a></p></div></aside></div>
    {confirmDeletion && <ModalFrame title="Demander l'effacement ?" eyebrow="Action réversible pendant 30 jours" onClose={() => setConfirmDeletion(false)} className="danger-modal"><div className="modal-copy"><p>TableNow enregistrera la demande, vérifiera les obligations légales et vous laissera 30 jours pour l'annuler. Rien n'est supprimé immédiatement.</p><div className="pilot-commitment"><ShieldCheck size={17} /><p>Les données des clients du restaurant suivent aussi les instructions du restaurant responsable de traitement.</p></div></div><footer><button className="secondary-button" onClick={() => setConfirmDeletion(false)}>Conserver mes données</button><button className="danger-button" onClick={() => void request("deletion")}><Trash2 size={15} /> Enregistrer la demande</button></footer></ModalFrame>}
    {otherRequest && <ModalFrame title={`Demande de ${requestLabel(otherRequest).toLowerCase()}`} eyebrow="Exercice de vos droits" onClose={() => setOtherRequest(null)}><div className="modal-copy"><p>Décrivez précisément les données ou traitements concernés. Une personne habilitée examinera la demande et la décision sera journalisée.</p><label><span>Détails de la demande</span><textarea autoFocus rows={5} value={requestDetails} onChange={(event) => setRequestDetails(event.target.value)} placeholder="Je souhaite…" /></label></div><footer><button className="secondary-button" onClick={() => setOtherRequest(null)}>Annuler</button><button className="primary-button" disabled={requestDetails.trim().length < 5} onClick={() => void request(otherRequest, requestDetails)}>Envoyer la demande</button></footer></ModalFrame>}
  </AppChrome>;
}

function Preference({ title, text, value, onChange }: { title: string; text: string; value: boolean; onChange: () => void }) { return <div className="preference-row"><div><strong>{title}</strong><p>{text}</p></div><button className={`switch ${value ? "on" : ""}`} role="switch" aria-label={title} aria-checked={value} onClick={onChange}><i /></button></div>; }
function requestStatus(status: string) { return ({ received: "Reçue", processing: "En préparation", requires_review: "Revue nécessaire", ready: "Prête", completed: "Terminée", cancelled: "Annulée", failed: "À reprendre" } as Record<string, string>)[status] || status; }
function requestLabel(type: string) { return ({ export: "Export de données", deletion: "Effacement", rectification: "Rectification", restriction: "Limitation", objection: "Opposition", access: "Accès" } as Record<string, string>)[type] || type; }
