"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MAX_VOICE_MESSAGE_DURATION_SEC } from "@/lib/constants";

export type VoiceRecorderStatus = "idle" | "recording" | "uploading";

interface UseVoiceRecorderOptions {
  /** Cloudinary folder for uploads. */
  folder?: string;
  /** Max recording duration in seconds. */
  maxDurationSec?: number;
  /** Called with the uploaded URL on success. */
  onRecorded: (url: string) => void;
  /** Called on error. */
  onError?: (message: string) => void;
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
    async (blob: Blob) => {
      setStatus("uploading");
      try {
        const formData = new FormData();
        formData.append("file", blob, `voice-${Date.now()}.webm`);
        formData.append("folder", folder);

        const res = await fetch("/api/upload/audio", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };

        if (!res.ok || !data.url) {
          throw new Error(data.error || "Failed to upload voice message");
        }

        onRecorded(data.url);
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
        void upload(blob);
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
