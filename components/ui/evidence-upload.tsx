"use client";

import { useState, useRef } from "react";
import { X, Loader2, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface EvidenceUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function EvidenceUpload({
  value = [],
  onChange,
  maxFiles = 5,
  disabled = false,
}: EvidenceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (value.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} photos allowed`);
      return;
    }

    setError(null);
    setUploading(true);

    // Upload files sequentially or parallel
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate
        if (file.size > 5 * 1024 * 1024)
          throw new Error(`File ${file.name} is too large (max 5MB)`);
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error(`File ${file.name} format not supported`);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "complaint-evidence");

        const res = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        return data.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      onChange([...value, ...uploadedUrls]);
    } catch (err: unknown) {
      console.error("Upload Error:", err);
      const message =
        err instanceof Error ? err.message : "Failed to upload some images";
      setError(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (urlToRemove: string) => {
    onChange(value.filter((url) => url !== urlToRemove));
  };

  return (
    <div className="space-y-4">
      {/* Grid of Images */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-lg overflow-hidden border border-border group"
            >
              <Image
                src={url}
                alt="Uploaded evidence image"
                width={128}
                height={128}
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {value.length < maxFiles && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled || uploading}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className={cn(
              "flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-border/60 rounded-xl hover:bg-muted/50 hover:border-primary/50 transition-all text-sm font-medium text-muted-foreground",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
              </>
            ) : (
              <>
                <ImagePlus className="w-4 h-4" /> Add Evidence Photos (
                {value.length}/{maxFiles})
              </>
            )}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
