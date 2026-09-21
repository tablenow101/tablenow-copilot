"use client";
import { useEffect, useRef, useState } from "react";
import { createDictationSession, type Recognition } from "./dictation-session";
import { startAudioSpectrum } from "./audio-spectrum";

type RecognitionConstructor = new () => Recognition;
type Session = ReturnType<typeof createDictationSession>;

export function useDictation(onFinalText: (text: string) => void, onInterimText?: (text: string) => void, locale = "fr") {
  const [state, setState] = useState<"idle" | "requesting" | "listening" | "transcribing">("idle");
  const [notice, setNotice] = useState("");
  const [interimText, setInterimText] = useState("");
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [spectrumUnavailable, setSpectrumUnavailable] = useState(false);
  const ref = useRef<Session | null>(null);
  const meter = useRef<(() => void) | null>(null);
  const finishTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onFinalText, onInterimText });
  useEffect(() => { callbacks.current = { onFinalText, onInterimText }; }, [onFinalText, onInterimText]);
  const french = locale === "fr";
  function stopMeter() { meter.current?.(); meter.current = null; setAudioLevels([]); }
  function clearFinishTimeout() { if (finishTimeout.current) clearTimeout(finishTimeout.current); finishTimeout.current = null; }
  useEffect(() => () => {
    const session = ref.current;
    ref.current = null;
    meter.current?.();
    if (finishTimeout.current) clearTimeout(finishTimeout.current);
    session?.cancel();
  }, []);

  function stop() {
    if (!ref.current) return;
    const session = ref.current;
    setState("transcribing");
    stopMeter();
    setNotice(french ? "Fin de la transcription… Rien n’est envoyé." : "Finishing transcription… Nothing is sent.");
    try { session.stop(); }
    catch { session.cancel(); }
    // Some browsers never emit onend after stop; retain the visible phrase and release the mic.
    if (ref.current === session) finishTimeout.current = setTimeout(() => {
      if (ref.current !== session) return;
      session.finish();
    }, 5_000);
  }
  // Callers keep the visible draft (including interim words) before cancelling for edits/send.
  function cancel() { clearFinishTimeout(); stopMeter(); ref.current?.cancel(); }
  function toggle() {
    if (ref.current) { stop(); return; }
    const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice(french ? "La dictée n’est pas disponible dans ce navigateur. Écrivez ou utilisez le micro du clavier." : "Dictation is unavailable in this browser. Type or use your keyboard microphone.");
      return;
    }
    setState("requesting");
    setSpectrumUnavailable(false);
    setNotice(french ? "Ouverture du micro… Autorisez l’accès si le navigateur le demande." : "Opening microphone… Allow access if your browser asks.");
    const session = createDictationSession(new Constructor(), {
      onStart: () => {
        if (ref.current !== session) return;
        setState("listening");
        setNotice(french ? "Écoute en cours · transcription par le service vocal du navigateur. Rien n’est envoyé à TableNow avant la flèche." : "Listening · browser speech service. Nothing is sent to TableNow before the arrow.");
        meter.current = startAudioSpectrum(levels => { if (ref.current === session) setAudioLevels(levels); }, () => { if (ref.current === session) setSpectrumUnavailable(true); });
      },
      onFinalText: text => { if (ref.current === session) callbacks.current.onFinalText(text); },
      onInterimText: text => {
        if (ref.current !== session) return;
        setInterimText(text);
        callbacks.current.onInterimText?.(text);
      },
      onError: error => {
        if (ref.current !== session) return;
        ref.current = null;
        clearFinishTimeout(); stopMeter(); setState("idle");
        setNotice(["not-allowed", "service-not-allowed"].includes(error)
          ? french ? "Micro refusé. Autorisez-le dans votre navigateur ou continuez par écrit. Votre texte est conservé." : "Microphone denied. Allow access or type. Your text is kept."
          : error === "audio-capture"
            ? french ? "Aucun micro disponible. Vérifiez votre appareil ou continuez par écrit." : "No microphone available. Check your device or type."
            : french ? "La dictée a été interrompue. Votre texte est conservé ; relisez-le avant d’envoyer." : "Dictation was interrupted. Your text is kept; review it before sending.");
      },
      onEnd: () => {
        if (ref.current !== session) return;
        ref.current = null;
        clearFinishTimeout(); stopMeter(); setState("idle");
        setNotice(french ? "Dictée arrêtée. Relisez ou corrigez le texte, puis envoyez avec la flèche." : "Dictation stopped. Review or edit your text, then send with the arrow.");
      },
    }, french ? "fr-FR" : "en-US");
    ref.current = session;
    try { session.start(); setInterimText(""); callbacks.current.onInterimText?.(""); }
    catch { session.cancel(); setState("idle"); setNotice(french ? "Impossible d’ouvrir le micro. Votre texte est conservé ; continuez par écrit." : "Could not open the microphone. Your text is kept; type instead."); }
  }
  return { listening: state === "listening", busy: state === "requesting" || state === "transcribing", state, notice, interimText, audioLevels, spectrumUnavailable, toggle, stop, cancel };
}
