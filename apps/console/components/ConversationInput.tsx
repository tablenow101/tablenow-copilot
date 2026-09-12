"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, LoaderCircle, Mic, Plus, Square, X } from "lucide-react";
import { api, apiHref } from "@/lib/api";

type Attachment = { id: string; name: string; byteSize: number };
export function ConversationInput({ value, onChange, onSend, onVoice, recording, voiceBusy, placeholder, sendLabel, voiceLabel, french = true }: {
  value: string; onChange: (value: string) => void; onSend: () => void; onVoice: () => void; recording: boolean; voiceBusy: boolean; placeholder: string; sendLabel: string; voiceLabel: string; french?: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setBusy(true);
    void api<{ files: Attachment[] }>("/v1/onboarding-attachments").then(result => { if (live) setFiles(result.files); }).catch(caught => { if (live) setError(caught instanceof Error ? caught.message : french ? "Documents indisponibles." : "Documents unavailable."); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [french]);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (file.size === 0 || file.size > 2000000) { setError(french ? "Choisissez un fichier non vide de 2 Mo maximum." : "Choose a non-empty file up to 2 MB."); if (picker.current) picker.current.value = ""; return; }
    setBusy(true); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]!);
        reader.onerror = () => reject(new Error(french ? "Ce fichier ne peut pas être lu." : "Cannot read this file."));
        reader.readAsDataURL(file);
      });
      const stored = await api<Attachment>("/v1/onboarding-attachments", { method: "POST", body: JSON.stringify({ name: file.name, mimeType: file.type || "text/plain", base64 }) });
      setFiles(previous => [...previous, stored]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document indisponible."); }
    finally { setBusy(false); if (picker.current) picker.current.value = ""; }
  }
  async function remove(id: string) {
    if (busy) return;
    setBusy(true); setError("");
    try { await api(`/v1/onboarding-attachments/${id}`, { method: "DELETE" }); setFiles(previous => previous.filter(file => file.id !== id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Suppression indisponible."); }
    finally { setBusy(false); }
  }
  return <div className="tn-conversation-input">
    <div className="tn-conversation-bar">
      <input className="sr-only" ref={picker} type="file" tabIndex={-1} accept="application/pdf,image/png,image/jpeg,text/plain" aria-label={french ? "Ajouter un document" : "Attach a document"} onChange={event => void upload(event.target.files?.[0])} />
      <button type="button" aria-label={french ? "Ajouter un document" : "Attach a document"} title={french ? "PDF, image ou texte · 2 Mo maximum" : "PDF, image or text · Up to 2 MB"} onClick={() => picker.current?.click()} disabled={busy}>{busy ? <LoaderCircle size={18} className="spinning" /> : <Plus size={20} strokeWidth={1.5} />}</button>
      <textarea rows={1} maxLength={2000} aria-label={placeholder} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && value.trim()) { event.preventDefault(); onSend(); } }} />
      <button type="button" aria-label={voiceLabel} onClick={onVoice} disabled={voiceBusy}>{recording ? <Square size={18} strokeWidth={1.5} /> : <Mic size={19} strokeWidth={1.5} />}</button>
      <button type="button" className="tn-conversation-send" aria-label={sendLabel} onClick={onSend} disabled={!value.trim()}><ArrowUp size={18} strokeWidth={1.5} /></button>
    </div>
    {files.length > 0 && <details className="tn-conversation-files"><summary>{files.length} {french ? "document(s) enregistré(s)" : "saved document(s)"}</summary><ul>{files.map(file => <li key={file.id}><a href={apiHref(`/v1/onboarding-attachments/${file.id}`)} download>{file.name}</a><button type="button" disabled={busy} onClick={() => void remove(file.id)} aria-label={`${french ? "Retirer" : "Remove"} ${file.name}`}><X size={15} /></button></li>)}</ul><small>{french ? "Documents conservés pour votre onboarding. Leur analyse automatique n’est pas encore activée." : "Saved for your onboarding. Automatic analysis is not enabled yet."}</small></details>}
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
