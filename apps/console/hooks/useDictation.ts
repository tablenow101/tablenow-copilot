"use client";
import { useEffect, useRef, useState } from "react";
import { createDictationSession, type Recognition } from "./dictation-session";

type RecognitionConstructor = new () => Recognition;
type Session = ReturnType<typeof createDictationSession>;

export function useDictation(onFinalText: (text: string) => void, onInterimText?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const [interimText, setInterimText] = useState("");
  const ref = useRef<Session | null>(null);
  const callbacks = useRef({ onFinalText, onInterimText });
  useEffect(() => { callbacks.current = { onFinalText, onInterimText }; }, [onFinalText, onInterimText]);
  useEffect(() => () => {
    const session = ref.current;
    ref.current = null;
    session?.cancel();
  }, []);

  function stop() { ref.current?.stop(); }
  // Detach before accepting a manual edit so late browser results cannot
  // overwrite it. This clears the preview; the caller keeps the visible draft,
  // including interim words, in its own edited/submitted value.
  function cancel() { ref.current?.cancel(); }
  function toggle() {
    if (ref.current) { stop(); return; }
    const scope = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice("La dictée n’est pas disponible dans ce navigateur. Vous pouvez écrire ou utiliser le micro du clavier.");
      return;
    }
    const session = createDictationSession(new Constructor(), {
      onFinalText: (text) => { if (ref.current === session) callbacks.current.onFinalText(text); },
      onInterimText: (text) => {
        if (ref.current !== session) return;
        setInterimText(text);
        callbacks.current.onInterimText?.(text);
      },
      onError: (error) => {
        if (ref.current !== session) return;
        ref.current = null;
        setListening(false);
        setNotice(error === "not-allowed"
          ? "Micro refusé. Autorisez-le dans votre navigateur ou continuez par écrit."
          : "La dictée a été interrompue. Votre texte est conservé et reste à relire.");
      },
      onEnd: () => {
        if (ref.current !== session) return;
        ref.current = null;
        setListening(false);
        setNotice("Dictée arrêtée. Relisez votre texte. Rien n’a été envoyé.");
      },
    });
    ref.current = session;
    try {
      session.start();
      setInterimText("");
      callbacks.current.onInterimText?.("");
      setListening(true);
      setNotice("Écoute en cours. La transcription utilise le service vocal du navigateur.");
    } catch {
      session.cancel();
      setListening(false);
      setNotice("Impossible d’ouvrir le micro. Votre texte est conservé ; vous pouvez continuer par écrit.");
    }
  }
  return { listening, notice, interimText, toggle, stop, cancel };
}
