"use client";
import { useEffect, useRef, useState } from "react";
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const ref = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);
  useEffect(
    () => () => {
      const recognition = ref.current;
      if (recognition) {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
    },
    [],
  );
  function toggle() {
    if (listening) {
      ref.current?.stop();
      return;
    }
    const scope = window as unknown as {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Constructor =
      scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice(
        "La dictée n’est pas disponible dans ce navigateur. Vous pouvez écrire ou utiliser le micro du clavier.",
      );
      return;
    }
    const recognition = new Constructor();
    ref.current = recognition;
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      callback.current(text);
      setNotice("Dictée prête à relire. Rien n’a été envoyé.");
    };
    recognition.onerror = (event) => {
      setListening(false);
      setNotice(
        event.error === "not-allowed"
          ? "Micro refusé. Autorisez-le dans votre navigateur ou continuez par écrit."
          : "La dictée a été interrompue. Votre texte est conservé.",
      );
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
      setListening(true);
      setNotice(
        "Écoute en cours. La transcription utilise le service vocal du navigateur.",
      );
    } catch {
      setListening(false);
      setNotice(
        "Impossible d’ouvrir le micro. Vous pouvez continuer par écrit.",
      );
    }
  }
  return { listening, notice, toggle };
}
