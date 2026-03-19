"use client";

import { useState, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  RotateCw,
  ZoomIn,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCroppedImage } from "@/lib/crop-image";

interface ImageCropModalProps {
  /** Object URL of the image to crop */
  imageSrc: string;
  /** "profile" → 1:1 circle crop, "banner" → 4:1 rectangle */
  variant: "profile" | "banner";
  /** Called with the cropped File on confirm */
  onConfirm: (file: File) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function ImageCropModal({
  imageSrc,
  variant,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const isProfile = variant === "profile";
  const aspect = isProfile ? 1 : 4;

  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedPixels: Area) => {
      setCroppedAreaPixels(croppedPixels);
    },
    [],
  );

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const croppedFile = await getCroppedImage(
        imageSrc,
        croppedAreaPixels,
        rotation,
      );
      onConfirm(croppedFile);
    } catch {
      // If crop fails, fall back to confirming with the original
      // This shouldn't happen in practice
      onCancel();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && !processing) onCancel();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "relative flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden",
            "w-full max-w-lg",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-base font-bold text-foreground">
              Adjust {isProfile ? "Photo" : "Banner"}
            </h3>
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Crop Area */}
          <div
            className={cn(
              "relative bg-black",
              isProfile ? "h-80" : "h-64",
            )}
          >
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              cropShape={isProfile ? "round" : "rect"}
              showGrid={!isProfile}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="px-5 py-4 space-y-4 border-t border-border">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
              />
              <span className="text-xs text-muted-foreground font-medium w-10 text-right tabular-nums">
                {zoom.toFixed(1)}x
              </span>
            </div>

            {/* Rotation */}
            <div className="flex items-center gap-3">
              <RotateCw className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow-md"
              />
              <span className="text-xs text-muted-foreground font-medium w-10 text-right tabular-nums">
                {rotation}°
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-muted/30">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={processing}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply Crop
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
