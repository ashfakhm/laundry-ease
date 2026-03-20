"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIVE_VOICE_MESSAGE_EVENT = "laundryease:voice-message:play";
const WAVEFORM_BARS = [8, 12, 18, 11, 16, 24, 13, 19, 10, 15, 22, 12, 18, 9];

export function getFiniteAudioDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

export function getPreferredVoiceMessageDuration({
  mediaDuration,
  voiceDurationMs,
}: {
  mediaDuration: number;
  voiceDurationMs?: number;
}): number {
  const stableMediaDuration = getFiniteAudioDuration(mediaDuration);
  if (stableMediaDuration > 0) {
    return stableMediaDuration;
  }

  return Number.isFinite(voiceDurationMs) && (voiceDurationMs ?? 0) > 0
    ? (voiceDurationMs as number) / 1000
    : 0;
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainder = roundedSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getVoiceMessageTimeLabel({
  duration,
  isScrubbing,
  scrubTime,
}: {
  duration: number;
  isScrubbing: boolean;
  scrubTime: number;
}): string {
  if (isScrubbing) {
    return formatAudioTime(scrubTime);
  }

  if (duration <= 0 || !Number.isFinite(duration)) {
    return "--:--";
  }

  return formatAudioTime(duration);
}

type VoiceMessageBubbleProps = {
  src: string;
  voiceDurationMs?: number;
  isOwnMessage?: boolean;
  className?: string;
};

export function VoiceMessageBubble({
  src,
  voiceDurationMs,
  isOwnMessage = false,
  className,
}: VoiceMessageBubbleProps) {
  const audioId = useId();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;

    function handleActiveVoiceMessage(event: Event) {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id === audioId) {
        return;
      }

      const audio = audioRef.current;
      if (!audio || audio.paused) {
        return;
      }

      audio.pause();
    }

    window.addEventListener(
      ACTIVE_VOICE_MESSAGE_EVENT,
      handleActiveVoiceMessage,
    );

    return () => {
      window.removeEventListener(
        ACTIVE_VOICE_MESSAGE_EVENT,
        handleActiveVoiceMessage,
      );
      audio?.pause();
    };
  }, [audioId]);

  const duration = getPreferredVoiceMessageDuration({
    mediaDuration,
    voiceDurationMs,
  });
  const displayedProgressTime = isScrubbing ? scrubTime : currentTime;
  const displayedProgress =
    duration > 0 ? clamp(displayedProgressTime / duration, 0, 1) : 0;
  const progressPercent = displayedProgress * 100;
  const progressIndicatorLeft =
    progressPercent <= 0
      ? "0.35rem"
      : progressPercent >= 100
        ? "calc(100% - 0.35rem)"
        : `${progressPercent}%`;
  const canSeek = duration > 0;

  function syncDurationFromAudio(audio: HTMLAudioElement) {
    setMediaDuration(getFiniteAudioDuration(audio.duration));
  }

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        window.dispatchEvent(
          new CustomEvent(ACTIVE_VOICE_MESSAGE_EVENT, {
            detail: { id: audioId },
          }),
        );
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setIsPlaying(false);
    }
  }

  function handleSliderChange(nextValue: number) {
    const audio = audioRef.current;
    if (!audio || duration <= 0) {
      return;
    }

    const nextTime = clamp(nextValue, 0, duration);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    setScrubTime(nextTime);
  }

  return (
    <div
      className={cn(
        "w-full max-w-[18rem] rounded-[1.4rem] px-3 py-2.5 shadow-sm ring-1 ring-black/5",
        isOwnMessage
          ? "bg-black/30 text-primary-foreground"
          : "bg-slate-100/95 text-foreground dark:bg-white/10 dark:text-white",
        className,
      )}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        onLoadedMetadata={(event) => {
          syncDurationFromAudio(event.currentTarget);
        }}
        onLoadedData={(event) => {
          syncDurationFromAudio(event.currentTarget);
        }}
        onDurationChange={(event) => {
          syncDurationFromAudio(event.currentTarget);
        }}
        onCanPlay={(event) => {
          syncDurationFromAudio(event.currentTarget);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0;
          setCurrentTime(0);
          setIsScrubbing(false);
          setScrubTime(0);
          setIsPlaying(false);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void togglePlayback();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
            isOwnMessage
              ? "bg-white/20 text-white hover:bg-white/28"
              : "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-white/12 dark:text-white",
          )}
          aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        >
          {isPlaying ? (
            <Pause className="h-[18px] w-[18px] fill-current" />
          ) : (
            <Play className="h-[18px] w-[18px] fill-current" />
          )}
        </button>

        <div
          className="relative flex min-w-0 flex-1 items-center"
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={cn(
              "absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full",
              isOwnMessage ? "bg-white/12" : "bg-slate-300/90 dark:bg-white/12",
            )}
          />
          <div
            className={cn(
              "absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full transition-[width]",
              isOwnMessage ? "bg-white/65" : "bg-primary/55 dark:bg-white/55",
            )}
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm",
              isOwnMessage
                ? "border-white/70 bg-white"
                : "border-primary/25 bg-primary dark:border-white/20 dark:bg-white",
            )}
            style={{ left: progressIndicatorLeft }}
          />

          <div className="relative flex h-10 w-full items-center gap-[3px] px-1.5">
            {WAVEFORM_BARS.map((height, index) => {
              const ratio = (index + 1) / WAVEFORM_BARS.length;
              const isActive = displayedProgress >= ratio;

              return (
                <span
                  key={`${height}-${index}`}
                  className={cn(
                    "w-[3px] rounded-full transition-colors",
                    isOwnMessage
                      ? isActive
                        ? "bg-white"
                        : "bg-white/30"
                      : isActive
                        ? "bg-primary dark:bg-white"
                        : "bg-slate-300 dark:bg-white/25",
                  )}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step="0.1"
            value={clamp(displayedProgressTime, 0, duration > 0 ? duration : 1)}
            disabled={!canSeek}
            aria-label="Seek voice message"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
            onPointerDown={(event) => {
              event.stopPropagation();
              setIsScrubbing(true);
              setScrubTime(displayedProgressTime);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              setIsScrubbing(false);
            }}
            onPointerCancel={() => {
              setIsScrubbing(false);
            }}
            onBlur={() => {
              setIsScrubbing(false);
            }}
            onChange={(event) => {
              event.stopPropagation();
              const nextValue = Number(event.currentTarget.value);
              setIsScrubbing(true);
              setScrubTime(nextValue);
              handleSliderChange(nextValue);
            }}
          />
        </div>

        <span
          className={cn(
            "w-11 shrink-0 text-right text-xs font-semibold tabular-nums",
            isOwnMessage ? "text-white/85" : "text-foreground/65",
          )}
        >
          {getVoiceMessageTimeLabel({
            duration,
            isScrubbing,
            scrubTime,
          })}
        </span>
      </div>
    </div>
  );
}
