"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileKey2, Mail, Plus, RotateCcw, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { AppChrome } from "./AppChrome";
import { LoadingScreen } from "./LoadingScreen";
import { ModalFrame } from "./ModalFrame";

interface Pilot {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  tenantId: string;
  organizationName: string;
  tenantSlug: string;
  onboardingComplete: boolean;
}

interface PrivacyReview {
  id: string;
  tenantId: string;
  organizationName: string;
  type: string;
  status: string;
  details: string | null;
  scheduledFor: string | null;
  createdAt: string;
  email: string;
  displayName: string | null;
}

export function AdminPilots() {
  const { session, loading } = useSession();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [privacyRequests, setPrivacyRequests] = useState<PrivacyReview[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ email: "", organizationName: "", restaurantName: "", role: "owner", locale: "fr" });
  const [review, setReview] = useState<PrivacyReview | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const refresh = useCallback(async () => {
    const [nextPilots, nextPrivacyRequests] = await Promise.all([
      api<Pilot[]>("/v1/admin/pilots"),
      api<PrivacyReview[]>("/v1/admin/privacy/requests"),
    ]);
    setPilots(nextPilots);
    setPrivacyRequests(nextPrivacyRequests);
  }, []);
  useEffect(() => { if (session?.membership.role === "platform_admin") void refresh(); }, [session, refresh]);
  if (loading || !session) return <LoadingScreen />;
  if (session.membership.role !== "platform_admin") return <AppChrome session={session} active="admin" title="Accès réservé"><div className="inline-error"><ShieldCheck size={17} />Seule l'administration TableNow gère la cohorte pilote.</div></AppChrome>;

  const invite = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice("");
    try { await api("/v1/admin/pilots", { method: "POST", body: JSON.stringify(form) }); await refresh(); setFormOpen(false); setForm({ email: "", organizationName: "", restaurantName: "", role: "owner", locale: "fr" }); setNotice("Invitation envoyée et espace de démonstration créé."); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Impossible de créer l'invitation."); }
    finally { setBusy(false); }
  };
  const action = async (path: string, method: string, success: string) => { setNotice(""); try { await api(path, { method, ...(method === "POST" ? { body: "{}" } : {}) }); await refresh(); setNotice(success); } catch (caught) { setNotice(caught instanceof Error ? caught.message : "L'action n'a pas abouti."); } };
  const decidePrivacy = async (approved: boolean) => {
    if (!review || reviewNote.trim().length < 3) return;
    setBusy(true); setNotice("");
    try {
      await api(`/v1/admin/privacy/requests/${review.id}/decision`, { method: "POST", body: JSON.stringify({ approved, note: reviewNote }) });
      setReview(null); setReviewNote(""); await refresh();
      setNotice(approved ? (review.type === "deletion" ? "Effacement approuvé. Il sera exécuté à la fin du délai de réversibilité." : "Demande marquée comme traitée et décision journalisée.") : "Demande refusée et décision journalisée.");
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "La décision n'a pas été enregistrée."); }
    finally { setBusy(false); }
  };
  const pending = pilots.filter((pilot) => pilot.status === "pending").length;
  const accepted = pilots.filter((pilot) => pilot.status === "accepted").length;

  return <AppChrome session={session} active="admin" title="Pilotes privés" subtitle="Invitez, suivez et révoquez les accès sans exposer l'application publiquement." onRefresh={() => void refresh()}>
    <div className="view-stack"><section className="kpi-grid three"><article className="kpi-card lime"><header><span><UserPlus /></span><small>Invitations ouvertes</small></header><strong>{pending}</strong><p>adresses autorisées à entrer</p></article><article className="kpi-card"><header><span><CheckCircle2 /></span><small>Pilotes actifs</small></header><strong>{accepted}</strong><p>comptes ayant accepté l'accès</p></article><article className="kpi-card"><header><span><ShieldCheck /></span><small>Mode d'accès</small></header><strong>Privé</strong><p>aucune inscription libre</p></article></section>
      <div className="toolbar"><div className="cohort-note"><span className="live-dot" /> Cohorte isolée de la production actuelle</div><button className="primary-button compact" onClick={() => setFormOpen(true)}><Plus size={16} /> Inviter un pilote</button></div>
      {notice && <div className="notice-banner"><CheckCircle2 size={16} />{notice}</div>}
      <section className="panel table-panel"><div className="pilot-table table-head"><span>Organisation</span><span>Invité</span><span>Accès</span><span>État</span><span>Créée</span><span /></div>{pilots.map((pilot) => <article className="pilot-table table-row" key={pilot.id}><span><strong>{pilot.organizationName}</strong><small>{pilot.tenantSlug}</small></span><span><strong>{pilot.email}</strong><small>{pilot.role}</small></span><span><small>Code e-mail · 6 chiffres</small></span><span><span className={`status-badge status-${pilot.status}`}>{pilot.status === "pending" ? "En attente" : pilot.status === "accepted" ? "Actif" : pilot.status === "revoked" ? "Révoqué" : "Expiré"}</span></span><span>{new Date(pilot.createdAt).toLocaleDateString("fr-FR")}</span><span className="table-actions">{pilot.status === "pending" && <><button className="icon-button tiny" title="Renvoyer" aria-label={`Renvoyer l'invitation à ${pilot.email}`} onClick={() => void action(`/v1/admin/invitations/${pilot.id}/resend`, "POST", "Invitation renvoyée.")}><RotateCcw size={14} /></button><button className="icon-button tiny danger" title="Révoquer" aria-label={`Révoquer l'invitation de ${pilot.email}`} onClick={() => void action(`/v1/admin/invitations/${pilot.id}`, "DELETE", "Invitation révoquée.")}><Trash2 size={14} /></button></>}</span></article>)}{!pilots.length && <div className="empty-state"><Mail size={24} /><strong>Aucun pilote invité</strong><p>Créez le premier espace privé sans toucher à l'application actuelle.</p></div>}</section>
      <section className="panel table-panel"><div className="panel-title"><div><span>Droits RGPD</span><h2>Demandes à superviser</h2></div><i>{privacyRequests.filter((item) => item.status === "requires_review").length}</i></div>{privacyRequests.map((item) => <div className="privacy-request admin-privacy-row" key={item.id}><span className="request-icon">{item.status === "requires_review" ? <FileKey2 size={17} /> : <Clock3 size={17} />}</span><div><strong>{privacyAdminLabel(item.type)} · {item.organizationName}</strong><small>{item.displayName || item.email} · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</small></div><span className={`status-badge status-${item.status}`}>{item.status === "requires_review" ? "À examiner" : item.status === "processing" ? "Réversibilité" : item.status}</span><span>{item.scheduledFor ? `Exécution ${new Date(item.scheduledFor).toLocaleDateString("fr-FR")}` : "Revue humaine"}</span>{item.status === "requires_review" ? <button className="secondary-button compact" onClick={() => { setReview(item); setReviewNote(""); }}>Examiner</button> : <span />}</div>)}{!privacyRequests.length && <div className="empty-state"><ShieldCheck size={24} /><strong>Aucune demande à traiter</strong><p>Les exports ordinaires sont automatisés ; les autres droits restent sous contrôle humain.</p></div>}</section>
    </div>
    {formOpen && <ModalFrame title="Inviter un restaurateur" eyebrow="Cohorte privée" onClose={() => setFormOpen(false)}><form onSubmit={invite}><label><span>Adresse e-mail invitée</span><input type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="direction@restaurant.fr" /></label><div className="form-grid two"><label><span>Organisation ou groupe</span><input required value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="Groupe Maison Rivage" /></label><label><span>Premier établissement</span><input value={form.restaurantName} onChange={(e) => setForm({ ...form, restaurantName: e.target.value })} placeholder="Rivage — Bastille" /></label></div><label><span>Rôle initial</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="owner">Propriétaire</option><option value="group_admin">Direction de groupe</option><option value="manager">Responsable</option><option value="viewer">Lecture seule</option></select></label><div className="pilot-commitment"><ShieldCheck size={17} /><p><strong>L'invitation crée un espace V2 isolé.</strong> Elle ne donne aucun accès à Supabase, au VPS ou à l'application TableNow actuelle.</p></div><footer><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? "Création…" : "Créer et inviter"}<ArrowRight size={15} /></button></footer></form></ModalFrame>}
    {review && <ModalFrame title={`${privacyAdminLabel(review.type)} · ${review.displayName || review.email}`} eyebrow="Revue humaine obligatoire" onClose={() => setReview(null)} className={review.type === "deletion" ? "danger-modal" : ""}><div className="modal-copy"><p>{review.type === "deletion" ? "Le compte sera anonymisé à la date indiquée. Les données du restaurant restent sous le contrôle de l'organisation. L'utilisateur peut annuler avant l'exécution." : "Vérifiez l'identité, réalisez la demande dans les systèmes concernés, puis documentez précisément la décision."}</p>{review.details && <div className="pilot-commitment"><FileKey2 size={17} /><p>{review.details}</p></div>}<label><span>Motif documenté</span><textarea autoFocus value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={4} placeholder="Vérification de l'identité, actions réalisées et motif de la décision…" /></label></div><footer><button className="secondary-button" disabled={busy || reviewNote.trim().length < 3} onClick={() => void decidePrivacy(false)}>Refuser</button><button className={review.type === "deletion" ? "danger-button" : "primary-button"} disabled={busy || reviewNote.trim().length < 3} onClick={() => void decidePrivacy(true)}>{review.type === "deletion" ? <Trash2 size={15} /> : <CheckCircle2 size={15} />}{review.type === "deletion" ? "Approuver l'effacement" : "Marquer comme traitée"}</button></footer></ModalFrame>}
  </AppChrome>;
}

function privacyAdminLabel(type: string) { return ({ deletion: "Demande d'effacement", rectification: "Rectification", restriction: "Limitation du traitement", objection: "Opposition", access: "Accès", export: "Export" } as Record<string, string>)[type] || type; }
