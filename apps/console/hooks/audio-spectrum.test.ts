import { afterEach, describe, expect, it, vi } from "vitest";
import { spectrumBands, startAudioSpectrum } from "./audio-spectrum";

afterEach(() => vi.unstubAllGlobals());
describe("measured microphone spectrum", () => {
  it("shows silence as zero and derives each band only from its measured samples", () => {
    expect(spectrumBands(new Uint8Array(32))).toEqual(Array(16).fill(0));
    expect(spectrumBands(new Uint8Array([0, 0, 255, 255]), 2)).toEqual([0, 1]);
    expect(spectrumBands(new Uint8Array([128, 128]), 1)[0]).toBeCloseTo(128 / 255);
  });
  it("closes a late microphone permission stream after cancellation without displaying fake sound", async () => {
    let resolvePermission!: (stream: MediaStream) => void;
    const stop = vi.fn(), close = vi.fn().mockResolvedValue(undefined), levels = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("window", { AudioContext: class { state = "suspended"; close = close; } });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => new Promise<MediaStream>(resolve => { resolvePermission = resolve; }) } });
    const cancel = startAudioSpectrum(levels, vi.fn());
    cancel();
    resolvePermission({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await vi.waitFor(() => expect(stop).toHaveBeenCalled());
    expect(levels).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});
