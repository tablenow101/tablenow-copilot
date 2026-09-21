type RecognitionResult = { 0: { transcript: string }; isFinal: boolean };
export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type Callbacks = {
  onFinalText: (text: string) => void;
  onInterimText: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart?: () => void;
};

// SpeechRecognition results are cumulative within a session. Only newly final
// segments may be appended to the draft; provisional text is always replaced.
// On stop/error the last phrase becomes an editable draft, never a sent message.
export function createDictationSession(recognition: Recognition, callbacks: Callbacks, language = "fr-FR") {
  const finalIndexes = new Set<number>();
  let closed = false;
  let stopping = false;
  let latestInterim = "";
  function clearInterim() {
    latestInterim = "";
    callbacks.onInterimText("");
  }
  function preserveInterim() {
    if (!latestInterim) return;
    callbacks.onFinalText(latestInterim);
    clearInterim();
  }
  function detach() {
    closed = true;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onstart = null;
  }
  recognition.lang = language;
  recognition.onstart = () => { if (!closed) callbacks.onStart?.(); };
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = (event) => {
    if (closed) return;
    const final: string[] = [];
    const interim: string[] = [];
    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index]!;
      const text = result[0].transcript.trim();
      if (result.isFinal) {
        if (index >= event.resultIndex && !finalIndexes.has(index)) {
          finalIndexes.add(index);
          if (text) final.push(text);
        }
      } else if (text) interim.push(text);
    }
    if (final.length) callbacks.onFinalText(final.join(" "));
    latestInterim = interim.join(" ");
    callbacks.onInterimText(latestInterim);
  };
  recognition.onerror = (event) => {
    if (closed) return;
    detach();
    preserveInterim();
    callbacks.onError(event.error);
    try { recognition.abort(); } catch { /* Already stopped by the browser. */ }
  };
  recognition.onend = () => {
    if (closed) return;
    detach();
    preserveInterim();
    callbacks.onEnd();
  };
  return {
    start: () => recognition.start(),
    stop: () => {
      if (closed || stopping) return;
      stopping = true;
      recognition.stop();
    },
    finish: () => {
      if (closed) return;
      detach();
      preserveInterim();
      try { recognition.abort(); } catch { /* Already stopped by the browser. */ }
      callbacks.onEnd();
    },
    cancel: () => {
      if (closed) return;
      detach();
      clearInterim();
      try { recognition.abort(); } catch { /* Already stopped by the browser. */ }
      callbacks.onEnd();
    },
  };
}
