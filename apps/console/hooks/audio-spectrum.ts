/** Normalised frequency bands from measured microphone samples; no generated animation. */
export function spectrumBands(samples: Uint8Array, count = 16): number[] {
  return Array.from({ length: count }, (_, band) => {
    const start = Math.floor(band * samples.length / count);
    const end = Math.max(start + 1, Math.floor((band + 1) * samples.length / count));
    let total = 0;
    for (let index = start; index < end && index < samples.length; index += 1) total += samples[index]!;
    return Math.min(1, total / (end - start) / 255);
  });
}

/** Owns only the local analyser stream. Speech transcription keeps its existing browser service. */
export function startAudioSpectrum(onLevels: (levels: number[]) => void, onUnavailable: () => void) {
  let cancelled = false;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let frame = 0;
  const close = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== "closed") void context.close().catch(() => {});
  };
  void (async () => {
    try {
      const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor || !navigator.mediaDevices?.getUserMedia) throw new Error("AUDIO_METER_UNAVAILABLE");
      context = new Constructor();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cancelled) { close(); return; }
      await context.resume();
      if (cancelled) { close(); return; }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);
      let previous = 0;
      const measure = (time: number) => {
        if (cancelled) return;
        if (time - previous >= 60) {
          analyser.getByteFrequencyData(samples);
          onLevels(spectrumBands(samples));
          previous = time;
        }
        frame = requestAnimationFrame(measure);
      };
      frame = requestAnimationFrame(measure);
    } catch {
      if (!cancelled) onUnavailable();
      close();
    }
  })();
  return close;
}
