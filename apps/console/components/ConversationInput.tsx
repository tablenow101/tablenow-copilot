"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, ChevronDown, ChevronUp, LoaderCircle, Mic, Plus, Square, X } from "lucide-react";
import { apiHref } from "@/lib/api";
import { AttachmentRequestError, requestAttachment, type ConversationAttachment as Attachment } from "@/lib/conversation-attachments";
function rejectedFileMessage(caught: unknown, french: boolean) {
  const status = caught instanceof AttachmentRequestError ? caught.status : undefined;
  if (status === 401 || status === 403) return french ? "L’accès aux documents doit être renouvelé. Reconnectez-vous avant de réessayer." : "Document access must be renewed. Sign in again before retrying.";
  if (status === 413) return french ? "Le fichier dépasse la limite de 2 Mo. Choisissez un fichier plus petit." : "The file exceeds the 2 MB limit. Choose a smaller file.";
  if (status === 429) return french ? "Trop de demandes rapprochées. Patientez avant de réessayer." : "Too many requests. Wait before trying again.";
  return french ? "Le fichier a été refusé. Vérifiez son format et sa taille, puis réessayez." : "The file was rejected. Check its type and size, then try again.";
}

export function ConversationInput({ value, onChange, onSend, onVoice, recording, voiceBusy, placeholder, sendLabel, voiceLabel, french = true, sending = false, voiceNotice = "", audioLevels = [], spectrumUnavailable = false, collapsed: controlledCollapsed, onCollapsedChange, contextKey }: {
  value: string; onChange: (value: string) => void; onSend: (attachmentIds: string[]) => boolean | void | Promise<boolean | void>; onVoice: () => void; recording: boolean; voiceBusy: boolean; placeholder: string; sendLabel: string; voiceLabel: string; french?: boolean; sending?: boolean; voiceNotice?: string; audioLevels?: number[]; spectrumUnavailable?: boolean; collapsed?: boolean; onCollapsedChange?: (collapsed: boolean) => void; contextKey?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const attachmentPanelId = useId();
  const bodyId = useId();
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? localCollapsed;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [extraction, setExtraction] = useState<{ id: string; name: string; extraction: { status: "extracted" | "unsupported" | "unreadable"; text?: string; message: string; truncated: boolean } } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const contextGeneration = useRef(0);
  useEffect(() => { contextGeneration.current += 1; setSelectedIds([]); setExtraction(null); }, [contextKey]);
  const collapse = () => { const next = !collapsed; if (next && (recording || voiceBusy)) onVoice(); if (onCollapsedChange) onCollapsedChange(next); else setLocalCollapsed(next); };

  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!textarea.current) return;
    textarea.current.style.height = "44px";
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 140)}px`;
  }, [value, collapsed]);
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
      setSelectedIds(previous => previous.filter(id => result.files.some(file => file.id === id)));
    } catch {
      setListUnavailable(true);
      setFileError(previous => [previous, french ? "Impossible de recharger la liste. Réessayez avant tout nouvel ajout." : "Could not reload the list. Try again before adding another file."].filter(Boolean).join(" "));
    } finally { setBusy(false); setFileStatus(""); }
  }
  async function upload(file?: File) {
    if (!file || busy || listUnavailable || mutationRef.current) return;
    if (file.size === 0 || file.size > 2000000) { setFileError(french ? "Choisissez un fichier non vide de 2 Mo maximum." : "Choose a non-empty file up to 2 MB."); if (picker.current) picker.current.value = ""; return; }
    if (!["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(file.type)) { setFileError(french ? "Choisissez un PDF, une image PNG/JPEG ou un fichier texte." : "Choose a PDF, PNG/JPEG image or text file."); if (picker.current) picker.current.value = ""; return; }
    const generation = contextGeneration.current;
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
      if (generation === contextGeneration.current) setSelectedIds(previous => previous.length < 3 ? [...previous, stored.id] : previous);
      setFileStatus(french ? "Document enregistré. Sélectionnez-le puis envoyez votre demande pour l’utiliser." : "Document saved. Select it, then send your request to use it.");
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
      setSelectedIds(previous => previous.filter(selected => selected !== id));
      setExtraction(previous => previous?.id === id ? null : previous);
      setFileStatus(french ? "Document retiré." : "Document removed.");
    } catch (caught) {
      setFileStatus("");
      if (caught instanceof AttachmentRequestError && caught.unconfirmed) {
        setFileError(french ? "Le retrait n’a pas pu être confirmé. Vérifiez la liste avant de réessayer." : "Removal could not be confirmed. Check the list before trying again.");
        await refreshFiles(false);
      } else setFileError(french ? "Le document n’a pas pu être retiré. Réessayez." : "The document could not be removed. Try again.");
    } finally { mutationRef.current = false; setBusy(false); }
  }
  async function inspect(id: string) {
    if (extracting) return;
    const generation = contextGeneration.current;
    setExtracting(true); setFileError("");
    try { const result = await requestAttachment<NonNullable<typeof extraction>>("GET", id, undefined, "extraction"); if (generation === contextGeneration.current) setExtraction(result); }
    catch { setFileError(french ? "Le contenu n’a pas pu être lu. Votre document reste enregistré ; réessayez." : "Could not read content. Your document remains saved; try again."); }
    finally { setExtracting(false); }
  }
  function select(id: string) {
    setSelectedIds(previous => previous.includes(id) ? previous.filter(item => item !== id) : previous.length < 3 ? [...previous, id] : previous);
  }
  async function send() {
    if (pending || sendInFlight.current || !value.trim()) return;
    if (value.trim().length > 2000) { setError(french ? "Votre message dépasse 2 000 caractères. Raccourcissez-le ; votre texte reste conservé." : "Your message exceeds 2,000 characters. Shorten it; your text is kept."); return; }
    sendInFlight.current = true;
    setLocalSending(true);
    setError("");
    const submittedIds = [...selectedIds];
    try { const sent = await onSend(submittedIds); if (sent !== false) setSelectedIds(previous => previous.filter(id => !submittedIds.includes(id))); }
    catch (caught) { setError(caught instanceof Error ? caught.message : french ? "Envoi impossible. Votre texte est conservé ; réessayez." : "Could not send. Your text has been kept; try again."); }
    finally { sendInFlight.current = false; setLocalSending(false); }
  }
  return <div className="tn-conversation-input" aria-busy={pending} data-state={pending ? "sending" : recording ? "recording" : voiceBusy ? "transcribing" : value.trim() ? "editing" : "idle"}>
    <button type="button" className="tn-conversation-collapse" aria-expanded={!collapsed} aria-controls={bodyId} onClick={collapse}>{collapsed ? <><span>{french ? "Parler à TableNow" : "Talk to TableNow"}{value.trim() ? french ? " · brouillon conservé" : " · draft kept" : ""}{selectedIds.length ? ` · ${selectedIds.length} document(s)` : ""}</span><ChevronUp size={15} /></> : <><span className="sr-only">{french ? "Réduire la barre TableNow" : "Collapse TableNow composer"}</span><ChevronDown size={15} /></>}</button>
    <div id={bodyId} hidden={collapsed}>
    <div className="tn-conversation-bar">
      <input className="sr-only" ref={picker} type="file" tabIndex={-1} accept="application/pdf,image/png,image/jpeg,text/plain" aria-label={french ? "Ajouter un document" : "Attach a document"} onChange={event => void upload(event.target.files?.[0])} />
      <button type="button" aria-label="Documents" title={french ? "Ajouter ou consulter un document" : "Add or view a document"} aria-expanded={attachmentsOpen} aria-controls={attachmentPanelId} onClick={() => setAttachmentsOpen(open => !open)}><Plus size={20} strokeWidth={1.5} /></button>
      <textarea ref={textarea} rows={1} maxLength={2000} aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} />
      <button type="button" aria-label={voiceLabel} onClick={onVoice} aria-pressed={recording || voiceBusy} disabled={!recording && pending}>{recording || voiceBusy ? <Square size={18} strokeWidth={1.5} /> : <Mic size={19} strokeWidth={1.5} />}</button>
      <button type="button" className="tn-conversation-send" aria-label={pending ? french ? "Envoi en cours" : "Sending" : sendLabel} onClick={() => void send()} disabled={pending || !value.trim()}>{pending ? <LoaderCircle size={18} className="spinning" /> : <ArrowUp size={18} strokeWidth={1.5} />}</button>
    </div>
    {(voiceNotice || recording || voiceBusy || pending) && <div className="tn-conversation-voice" role="status">
      {recording && audioLevels.length > 0 && <span className="tn-audio-spectrum" aria-hidden="true">{audioLevels.map((level, index) => <i key={index} style={{ height: `${2 + Math.max(0, Math.min(1, level)) * 22}px` }} />)}</span>}
      <span>{pending ? french ? "Traitement de votre demande…" : "Processing your request…" : voiceNotice}{recording && spectrumUnavailable ? french ? " Niveau sonore indisponible sur ce navigateur." : " Sound level unavailable in this browser." : ""}</span>
    </div>}
    {selectedIds.length > 0 && <ul className="tn-conversation-selection" aria-label={french ? "Documents à joindre au prochain message" : "Documents for the next message"}>{selectedIds.map(id => <li key={id}><span>{files.find(file => file.id === id)?.name || "Document"}</span><button type="button" disabled={pending} aria-label={french ? `Ne pas joindre ${files.find(file => file.id === id)?.name || "ce document"}` : "Unselect document"} onClick={() => select(id)}><X size={14} /></button></li>)}</ul>}
    {attachmentsOpen && <section id={attachmentPanelId} className="tn-conversation-attachments" aria-label={french ? "Ajouter un document" : "Attach a document"}>
      <p>{french ? "Stockage privé. Sélectionnez jusqu’à trois documents pour votre prochain message. Le texte lisible peut servir à la réponse ; le contenu des PDF et images n’est pas encore extrait." : "Private storage. Select up to three documents for your next message. Readable text may be used in the reply; PDF and image content is not yet extracted."}</p>
      <small>{french ? "PDF, PNG, JPEG ou texte · 2 Mo maximum" : "PDF, PNG, JPEG or text · Up to 2 MB"}</small>
      <div className="tn-conversation-attachment-actions"><button type="button" disabled={busy || listUnavailable} onClick={() => picker.current?.click()}>{french ? "Choisir un fichier" : "Choose a file"}</button><button type="button" onClick={() => setAttachmentsOpen(false)}>{french ? "Fermer" : "Close"}</button></div>
    </section>}
    {fileStatus && <p className="tn-conversation-status" role="status">{busy && <LoaderCircle size={14} className="spinning" />}{fileStatus}</p>}
    {files.length > 0 && <details className="tn-conversation-files"><summary>{files.length} {french ? files.length === 1 ? "document enregistré" : "documents enregistrés" : files.length === 1 ? "saved document" : "saved documents"}</summary><ul>{files.map(file => <li key={file.id}>
      <label><input type="checkbox" checked={selectedIds.includes(file.id)} disabled={pending || (!selectedIds.includes(file.id) && selectedIds.length >= 3)} onChange={() => select(file.id)} /><span>{file.name}</span></label>
      <div><button type="button" disabled={extracting} onClick={() => void inspect(file.id)}>{french ? "Lire" : "Read"}</button><a href={apiHref(`/v1/onboarding-attachments/${file.id}`)} download aria-label={`${french ? "Télécharger" : "Download"} ${file.name}`}>↓</a><button type="button" disabled={busy || pending} onClick={() => void remove(file.id)} aria-label={`${french ? "Supprimer du stockage privé" : "Delete from private storage"} ${file.name}`}><X size={15} /></button></div>
    </li>)}</ul></details>}
    {extracting && <p className="tn-conversation-status" role="status">{french ? "Lecture du contenu…" : "Reading content…"}</p>}
    {extraction && <section className="tn-attachment-extraction" aria-label={french ? "Contenu du document" : "Document content"}><strong>{extraction.name}</strong><p>{extraction.extraction.message}</p>{extraction.extraction.text && <pre>{extraction.extraction.text}</pre>}<small>{french ? "Cette lecture n’est pas une analyse. Envoyez une demande avec ce document pour recevoir une réponse." : "Reading is not analysis. Send a request with this document to get a reply."}</small><button type="button" onClick={() => setExtraction(null)}>{french ? "Fermer" : "Close"}</button></section>}
    {fileError && <div className="form-error" role="alert"><p>{fileError}</p><button type="button" disabled={busy} onClick={() => void refreshFiles()}>{french ? "Recharger la liste" : "Reload the list"}</button></div>}
    {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  </div>;
}
