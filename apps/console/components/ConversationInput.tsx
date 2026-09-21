"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, LoaderCircle, Mic, Plus, Square, X } from "lucide-react";
import { apiHref } from "@/lib/api";
import { AttachmentRequestError, requestAttachment, type ConversationAttachment as Attachment } from "@/lib/conversation-attachments";
function rejectedFileMessage(caught: unknown, french: boolean) {
  const status = caught instanceof AttachmentRequestError ? caught.status : undefined;
  if (status === 401 || status === 403) return french ? "L’accès aux documents doit être renouvelé. Reconnectez-vous avant de réessayer." : "Document access must be renewed. Sign in again before retrying.";
  if (status === 413) return french ? "Le fichier dépasse la limite de 2 Mo. Choisissez un fichier plus petit." : "The file exceeds the 2 MB limit. Choose a smaller file.";
  if (status === 429) return french ? "Trop de demandes rapprochées. Patientez avant de réessayer." : "Too many requests. Wait before trying again.";
  return french ? "Le fichier a été refusé. Vérifiez son format et sa taille, puis réessayez." : "The file was rejected. Check its type and size, then try again.";
}

export function ConversationInput({ value, onChange, onSend, onVoice, recording, voiceBusy, placeholder, sendLabel, voiceLabel, french = true, sending = false }: {
  value: string; onChange: (value: string) => void; onSend: () => void | Promise<void>; onVoice: () => void; recording: boolean; voiceBusy: boolean; placeholder: string; sendLabel: string; voiceLabel: string; french?: boolean; sending?: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const attachmentPanelId = useId();
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = "44px";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 140)}px`;
  }, [value]);
  const mutationRef = useRef(false);
  const sendInFlight = useRef(false);
  const [localSending, setLocalSending] = useState(false);
  const pending = sending || localSending;
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(true);
  const [fileStatus, setFileStatus] = useState(french ? "Chargement des documents…" : "Loading documents…");
  const [fileError, setFileError] = useState("");
  const [listUnavailable, setListUnavailable] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    setFileStatus(french ? "Chargement des documents…" : "Loading documents…");
    void requestAttachment<{ files: Attachment[] }>("GET")
      .then(result => { if (live) { setFiles(result.files); setListUnavailable(false); setFileError(""); } })
      .catch(() => { if (live) { setListUnavailable(true); setFileError(french ? "Vos documents ne sont pas accessibles pour le moment. Rechargez la liste." : "Your documents are unavailable right now. Reload the list."); } })
      .finally(() => { if (live) { setBusy(false); setFileStatus(""); } });
    return () => { live = false; };
  }, [french]);
  async function refreshFiles(clearError = true) {
    setBusy(true);
    setFileStatus(french ? "Vérification des documents enregistrés…" : "Checking saved documents…");
    if (clearError) setFileError("");
    try {
      const result = await requestAttachment<{ files: Attachment[] }>("GET");
      setFiles(result.files); setListUnavailable(false);
    } catch {
      setListUnavailable(true);
      setFileError(previous => [previous, french ? "Impossible de recharger la liste. Réessayez avant tout nouvel ajout." : "Could not reload the list. Try again before adding another file."].filter(Boolean).join(" "));
    } finally { setBusy(false); setFileStatus(""); }
  }
  async function upload(file?: File) {
    if (!file || busy || listUnavailable || mutationRef.current) return;
    if (file.size === 0 || file.size > 2000000) { setFileError(french ? "Choisissez un fichier non vide de 2 Mo maximum." : "Choose a non-empty file up to 2 MB."); if (picker.current) picker.current.value = ""; return; }
    if (!["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(file.type)) { setFileError(french ? "Choisissez un PDF, une image PNG/JPEG ou un fichier texte." : "Choose a PDF, PNG/JPEG image or text file."); if (picker.current) picker.current.value = ""; return; }
    mutationRef.current = true;
    setBusy(true); setFileError("");
    setFileStatus(french ? "Lecture du fichier…" : "Reading file…");
    let saving = false;
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const timeout = setTimeout(() => { reader.abort(); reject(new Error("FILE_READ_TIMEOUT")); }, 15_000);
        reader.onload = () => { clearTimeout(timeout); resolve(String(reader.result).split(",")[1]!); };
        reader.onerror = reader.onabort = () => { clearTimeout(timeout); reject(new Error("FILE_READ_FAILED")); };
        reader.readAsDataURL(file);
      });
      saving = true;
      setFileStatus(french ? "Enregistrement privé en cours…" : "Saving privately…");
      const stored = await requestAttachment<Attachment>("POST", undefined, JSON.stringify({ name: file.name, mimeType: file.type, base64 }));
      setFiles(previous => [...previous, stored]);
      setFileStatus(french ? "Document enregistré. Aucune analyse effectuée." : "Document saved. No analysis performed.");
      setAttachmentsOpen(false);
    } catch (caught) {
      setFileStatus("");
      if (caught instanceof AttachmentRequestError && caught.unconfirmed) {
        setFileError(french ? "L’enregistrement n’a pas pu être confirmé. Vérifiez la liste avant de renvoyer ce fichier." : "Saving could not be confirmed. Check the list before sending this file again.");
        await refreshFiles(false);
      } else {
        setFileError(saving ? rejectedFileMessage(caught, french) : french ? "Ce fichier ne peut pas être lu. Sélectionnez-le à nouveau." : "This file could not be read. Select it again.");
      }
    } finally { mutationRef.current = false; setBusy(false); if (picker.current) picker.current.value = ""; }
  }
  async function remove(id: string) {
    if (busy || mutationRef.current) return;
    mutationRef.current = true;
    setBusy(true); setFileError("");
    setFileStatus(french ? "Retrait du document…" : "Removing document…");
    try {
      await requestAttachment("DELETE", id);
      setFiles(previous => previous.filter(file => file.id !== id));
      setFileStatus(french ? "Document retiré." : "Document removed.");
    } catch (caught) {
      setFileStatus("");
      if (caught instanceof AttachmentRequestError && caught.unconfirmed) {
        setFileError(french ? "Le retrait n’a pas pu être confirmé. Vérifiez la liste avant de réessayer." : "Removal could not be confirmed. Check the list before trying again.");
        await refreshFiles(false);
      } else setFileError(french ? "Le document n’a pas pu être retiré. Réessayez." : "The document could not be removed. Try again.");
    } finally { mutationRef.current = false; setBusy(false); }
  }
  async function send() {
    if (pending || sendInFlight.current || !value.trim()) return;
    sendInFlight.current = true;
    setLocalSending(true);
    setError("");
    try { await onSend(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : french ? "Envoi impossible. Votre texte est conservé ; réessayez." : "Could not send. Your text has been kept; try again."); }
    finally { sendInFlight.current = false; setLocalSending(false); }
  }
  return <div className="tn-conversation-input" aria-busy={pending} data-state={pending ? "sending" : recording ? "recording" : value.trim() ? "editing" : "idle"}>
    <div className="tn-conversation-bar">
      <input className="sr-only" ref={picker} type="file" tabIndex={-1} accept="application/pdf,image/png,image/jpeg,text/plain" aria-label={french ? "Ajouter un document" : "Attach a document"} onChange={event => void upload(event.target.files?.[0])} />
      <button type="button" aria-label="Documents" title={french ? "Ajouter ou consulter un document" : "Add or view a document"} aria-expanded={attachmentsOpen} aria-controls={attachmentPanelId} onClick={() => setAttachmentsOpen(open => !open)}><Plus size={20} strokeWidth={1.5} /></button>
      <textarea ref={textarea} rows={1} maxLength={2000} aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <button type="button" aria-label={voiceLabel} onClick={onVoice} aria-pressed={recording} disabled={!recording && (voiceBusy || pending)}>{recording ? <Square size={18} strokeWidth={1.5} /> : <Mic size={19} strokeWidth={1.5} />}</button>
      <button type="button" className="tn-conversation-send" aria-label={pending ? french ? "Envoi en cours" : "Sending" : sendLabel} onClick={() => void send()} disabled={pending || !value.trim()}>{pending ? <LoaderCircle size={18} className="spinning" /> : <ArrowUp size={18} strokeWidth={1.5} />}</button>
    </div>
    {attachmentsOpen && <section id={attachmentPanelId} className="tn-conversation-attachments" aria-label={french ? "Ajouter un document" : "Attach a document"}>
      <p>{french ? "Conservez un document dans votre espace privé. TableNow ne l’analyse pas encore et ne l’utilise pas dans ses réponses." : "Keep a document in your private space. TableNow does not yet analyse it or use it in replies."}</p>
      <small>{french ? "PDF, PNG, JPEG ou texte · 2 Mo maximum" : "PDF, PNG, JPEG or text · Up to 2 MB"}</small>
      <div className="tn-conversation-attachment-actions"><button type="button" disabled={busy || listUnavailable} onClick={() => picker.current?.click()}>{french ? "Choisir un fichier" : "Choose a file"}</button><button type="button" onClick={() => setAttachmentsOpen(false)}>{french ? "Fermer" : "Close"}</button></div>
    </section>}
    {fileStatus && <p className="tn-conversation-status" role="status">{busy && <LoaderCircle size={14} className="spinning" />}{fileStatus}</p>}
    {files.length > 0 && <details className="tn-conversation-files"><summary>{files.length} {french ? files.length === 1 ? "document enregistré" : "documents enregistrés" : files.length === 1 ? "saved document" : "saved documents"}</summary><ul>{files.map(file => <li key={file.id}><a href={apiHref(`/v1/onboarding-attachments/${file.id}`)} download title={file.name}>{file.name}</a><button type="button" disabled={busy} onClick={() => void remove(file.id)} aria-label={`${french ? "Retirer" : "Remove"} ${file.name}`}><X size={15} /></button></li>)}</ul><small>{french ? "Stockage privé uniquement · Analyse non activée" : "Private storage only · Analysis not enabled"}</small></details>}
    {fileError && <div className="form-error" role="alert"><p>{fileError}</p><button type="button" disabled={busy} onClick={() => void refreshFiles()}>{french ? "Recharger la liste" : "Reload the list"}</button></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
