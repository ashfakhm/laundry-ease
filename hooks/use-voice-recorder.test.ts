import { describe, expect, it, vi } from "vitest";
import {
  getMimeTypeEssence,
  repairRecordedAudioBlob,
} from "./use-voice-recorder";

describe("use-voice-recorder helpers", () => {
  it("normalizes mime type essence", () => {
    expect(getMimeTypeEssence("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(getMimeTypeEssence(" audio/mp4 ;codecs=mp4a.40.2 ")).toBe(
      "audio/mp4",
    );
  });

  it("repairs webm blobs using measured duration", async () => {
    const originalBlob = new Blob(["audio"], { type: "audio/webm;codecs=opus" });
    const fixedBlob = new Blob(["fixed"], { type: "audio/webm" });
    const fixDuration = vi.fn().mockResolvedValue(fixedBlob);

    const result = await repairRecordedAudioBlob(
      originalBlob,
      12_345,
      fixDuration,
    );

    expect(fixDuration).toHaveBeenCalledWith(originalBlob, 12_345, {
      logger: false,
    });
    expect(result).toBe(fixedBlob);
  });

  it("bypasses repair for non-webm blobs", async () => {
    const blob = new Blob(["audio"], { type: "audio/mp4" });
    const fixDuration = vi.fn();

    const result = await repairRecordedAudioBlob(blob, 12_345, fixDuration);

    expect(fixDuration).not.toHaveBeenCalled();
    expect(result).toBe(blob);
  });
});
