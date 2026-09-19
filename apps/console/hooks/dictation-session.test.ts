import { describe, expect, it, vi } from "vitest";
import { createDictationSession, type Recognition } from "./dictation-session";

function setup() {
  const recognition: Recognition = {
    lang: "", continuous: false, interimResults: false,
    onresult: null, onerror: null, onend: null,
    start: vi.fn(), stop: vi.fn(), abort: vi.fn(),
  };
  const events = {
    onFinalText: vi.fn(), onInterimText: vi.fn(),
    onEnd: vi.fn(), onError: vi.fn(),
  };
  const session = createDictationSession(recognition, events);
  const result = (transcript: string, isFinal: boolean) => ({ 0: { transcript }, isFinal });
  return { recognition, events, session, result };
}

describe("browser dictation session", () => {
  it("replaces provisional words and emits each finalized segment only once", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Prépare", false)] });
    recognition.onresult?.({ resultIndex: 0, results: [result("Prépare le service", true)] });
    recognition.onresult?.({ resultIndex: 1, results: [result("Prépare le service", true), result("de demain", false)] });
    recognition.onresult?.({ resultIndex: 1, results: [result("Prépare le service", true), result("de demain soir", true)] });
    recognition.onresult?.({ resultIndex: 0, results: [result("Prépare le service", true), result("de demain soir", true)] });
    expect(events.onFinalText.mock.calls).toEqual([["Prépare le service"], ["de demain soir"]]);
    expect(events.onInterimText.mock.calls).toEqual([["Prépare"], [""], ["de demain"], [""], [""]]);
  });
  it("keeps the final browser result after Stop and does not send anything", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Un groupe", false)] });
    session.stop();
    session.stop();
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    recognition.onresult?.({ resultIndex: 0, results: [result("Un groupe de huit personnes", true)] });
    recognition.onend?.();
    expect(events.onFinalText).toHaveBeenCalledExactlyOnceWith("Un groupe de huit personnes");
    expect(events.onEnd).toHaveBeenCalledTimes(1);
  });

  it("retains confirmed and provisional text when the browser fails", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Demain", true), result("à midi", false)] });
    const lateResult = recognition.onresult;
    recognition.onerror?.({ error: "network" });
    lateResult?.({ resultIndex: 1, results: [result("Demain", true), result("résultat trop tardif", true)] });
    expect(events.onFinalText.mock.calls).toEqual([["Demain"], ["à midi"]]);
    expect(events.onInterimText.mock.calls).toEqual([["à midi"], [""]]);
    expect(events.onError).toHaveBeenCalledExactlyOnceWith("network");
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it("ignores in-flight recognition results after a manual edit cancels listening", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Dix couverts", false)] });
    const lateResult = recognition.onresult;
    session.cancel();
    session.cancel();
    lateResult?.({ resultIndex: 0, results: [result("Dix couverts", true)] });
    expect(events.onFinalText).not.toHaveBeenCalled();
    expect(events.onInterimText.mock.calls).toEqual([["Dix couverts"], [""]]);
    expect(events.onEnd).toHaveBeenCalledTimes(1);
    expect(recognition.abort).toHaveBeenCalledTimes(1);
  });

  it("keeps repeated words when they belong to distinct dictated segments", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Oui", true)] });
    recognition.onresult?.({ resultIndex: 1, results: [result("Oui", true), result("oui", true)] });
    expect(events.onFinalText.mock.calls).toEqual([["Oui"], ["oui"]]);
  });

  it("freezes the last provisional phrase when Stop ends without a final result", () => {
    const { recognition, events, session, result } = setup();
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("Prévoir une table de six", false)] });
    session.stop();
    recognition.onend?.();
    expect(events.onFinalText.mock.calls).toEqual([["Prévoir une table de six"]]);
    expect(events.onInterimText.mock.calls).toEqual([["Prévoir une table de six"], [""]]);
  });

  it("lets manual editing replace visible provisional text without duplication", () => {
    const { recognition, result } = setup();
    let draft = "Demain";
    let interim = "";
    const session = createDictationSession(recognition, {
      onFinalText: text => { draft = [draft, text].filter(Boolean).join(" "); },
      onInterimText: text => { interim = text; },
      onError: vi.fn(), onEnd: vi.fn(),
    });
    session.start();
    recognition.onresult?.({ resultIndex: 0, results: [result("midi", false)] });
    const edited = `${draft} ${interim} !`;
    session.cancel();
    draft = edited;
    expect([draft, interim].filter(Boolean).join(" ")).toBe("Demain midi !");
  });

  it("retains the prior session's unfinished phrase when dictation restarts", () => {
    let draft = "";
    let interim = "";
    const callbacks = {
      onFinalText: (text: string) => { draft = [draft, text].filter(Boolean).join(" "); },
      onInterimText: (text: string) => { interim = text; },
      onError: vi.fn(), onEnd: vi.fn(),
    };
    const first = setup();
    const session1 = createDictationSession(first.recognition, callbacks);
    session1.start();
    first.recognition.onresult?.({ resultIndex: 0, results: [first.result("Préparer le service", false)] });
    first.recognition.onerror?.({ error: "network" });
    const second = setup();
    const session2 = createDictationSession(second.recognition, callbacks);
    session2.start();
    second.recognition.onresult?.({ resultIndex: 0, results: [second.result("pour demain", true)] });
    expect(draft).toBe("Préparer le service pour demain");
    expect(interim).toBe("");
  });

});
