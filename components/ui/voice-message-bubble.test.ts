import { describe, expect, it } from "vitest";
import {
  clamp,
  formatAudioTime,
  getFiniteAudioDuration,
  getPreferredVoiceMessageDuration,
  getVoiceMessageTimeLabel,
} from "./voice-message-bubble";

describe("voice-message-bubble helpers", () => {
  it("formats duration labels", () => {
    expect(formatAudioTime(12)).toBe("0:12");
    expect(formatAudioTime(65)).toBe("1:05");
    expect(formatAudioTime(120)).toBe("2:00");
  });

  it("returns placeholder when metadata is unavailable", () => {
    expect(
      getVoiceMessageTimeLabel({
        duration: 0,
        isScrubbing: false,
        scrubTime: 0,
      }),
    ).toBe("--:--");
  });

  it("shows scrub target while dragging", () => {
    expect(
      getVoiceMessageTimeLabel({
        duration: 120,
        isScrubbing: true,
        scrubTime: 5,
      }),
    ).toBe("0:05");
  });

  it("prefers a stable stored duration when media metadata is unavailable", () => {
    expect(
      getPreferredVoiceMessageDuration({
        mediaDuration: Number.NaN,
        voiceDurationMs: 42_000,
      }),
    ).toBe(42);
  });

  it("uses finite media metadata when available", () => {
    expect(getFiniteAudioDuration(18.4)).toBe(18.4);
    expect(getFiniteAudioDuration(Number.NaN)).toBe(0);
  });

  it("clamps seek values inside the track duration", () => {
    expect(clamp(-1, 0, 12)).toBe(0);
    expect(clamp(5, 0, 12)).toBe(5);
    expect(clamp(99, 0, 12)).toBe(12);
  });
});
