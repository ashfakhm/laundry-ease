"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import fixWebmDuration from "fix-webm-duration";
import { MAX_VOICE_MESSAGE_DURATION_SEC } from "@/lib/constants";

export type VoiceRecorderStatus = "idle" | "recording" | "uploading";
export type RecordedVoiceMessage = {
  url: string;
  durationMs: number;
};

interface UseVoiceRecorderOptions {
  /** Cloudinary folder for uploads. */
  folder?: string;
  /** Max recording duration in seconds. */
  maxDurationSec?: number;
  /** Called with the uploaded voice payload on success. */
  onRecorded: (voiceMessage: RecordedVoiceMessage) => void;
  /** Called on error. */
  onError?: (message: string) => void;
}

type FixWebmDurationFn = (
  blob: Blob,
  duration: number,
  options?: { logger?: false | ((message: string) => void) },
) => Promise<Blob>;

export function getMimeTypeEssence(mimeType: string): string {
  const [essence = ""] = mimeType.split(";");
  return essence.trim().toLowerCase();
}

export async function repairRecordedAudioBlob(
  blob: Blob,
  durationMs: number,
  fixDuration: FixWebmDurationFn = fixWebmDuration,
): Promise<Blob> {
  if (getMimeTypeEssence(blob.type) !== "audio/webm" || durationMs <= 0) {
    return blob;
  }

  return fixDuration(blob, durationMs, { logger: false });
}

function getAudioFileExtension(mimeType: string): string {
  switch (getMimeTypeEssence(mimeType)) {
    case "audio/mp4":
      return "mp4";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/ogg":
      return "ogg";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default:
      return "webm";
  }
}

function normalizeRecordedDurationMs(durationMs: number): number {
  return Number.isFinite(durationMs) && durationMs > 0
    ? Math.round(durationMs)
    : 0;
}

export function useVoiceRecorder({
  folder = "voice-messages",
  maxDurationSec = MAX_VOICE_MESSAGE_DURATION_SEC,
  onRecorded,
  onError,
}: UseVoiceRecorderOptions) {
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const cancelledRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const upload = useCallback(
    async (blob: Blob, durationMs: number) => {
      setStatus("uploading");
      try {
        const normalizedDurationMs = normalizeRecordedDurationMs(durationMs);
        const formData = new FormData();
        formData.append(
          "file",
          blob,
          `voice-${Date.now()}.${getAudioFileExtension(blob.type)}`,
        );
        formData.append("folder", folder);

        const res = await fetch("/api/upload/audio", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json().catch(() => ({}))) as {
          data?: { url?: string };
          error?: string;
        };

        if (!res.ok || !data.data?.url) {
          throw new Error(data.error || "Failed to upload voice message");
        }

        onRecorded({
          url: data.data.url,
          durationMs: normalizedDurationMs,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to upload voice message";
        onError?.(message);
      } finally {
        setStatus("idle");
        setDuration(0);
      }
    },
    [folder, onRecorded, onError],
  );

  const startRecording = useCallback(async () => {
    cancelledRef.current = false;
    chunksRef.current = [];
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer WebM/Opus, fallback to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        stopStream();
        const durationMs = normalizeRecordedDurationMs(
          Date.now() - startTimeRef.current,
        );

        if (cancelledRef.current) {
          chunksRef.current = [];
          setStatus("idle");
          setDuration(0);
          return;
        }

        if (chunksRef.current.length === 0) {
          setStatus("idle");
          setDuration(0);
          return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        void (async () => {
          const repairedBlob = await repairRecordedAudioBlob(blob, durationMs);
          await upload(repairedBlob, durationMs);
        })();
      };

      recorder.start(250); // Collect data every 250ms
      setStatus("recording");
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop at max duration
        if (elapsed >= maxDurationSec) {
          recorder.stop();
        }
      }, 500);
    } catch (err) {
      stopStream();
      stopTimer();
      setStatus("idle");
      setDuration(0);

      if (err instanceof DOMException && err.name === "NotAllowedError") {
        onError?.("Microphone permission denied. Please allow microphone access.");
      } else {
        onError?.("Could not start recording. Please check your microphone.");
      }
    }
  }, [maxDurationSec, stopTimer, stopStream, upload, onError]);

  const stopRecording = useCallback(() => {
    cancelledRef.current = false;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
    stopStream();
    chunksRef.current = [];
    setStatus("idle");
    setDuration(0);
  }, [stopTimer, stopStream]);

  return {
    status,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording: status === "recording",
    isUploading: status === "uploading",
  };
}
