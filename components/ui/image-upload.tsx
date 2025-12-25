"use client";

import { useState, useRef } from "react";
import { Upload, X, Camera, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  variant?: "profile" | "banner";
  className?: string;
}

export function ImageUpload({
  label,
  value,
  onChange,
  variant = "profile",
  className,
}: ImageUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSize = variant === "profile" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  const acceptedFormats = ["image/jpeg", "image/png", "image/webp"];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file type
    if (!acceptedFormats.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WebP image");
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      setError(`Image must be less than ${maxSizeMB}MB`);
      return;
    }

    // Upload to Cloudinary
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", variant === "profile" ? "provider-profiles" : "provider-banners");

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      onChange(data.url);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const isProfile = variant === "profile";

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/50",
          isProfile ? "aspect-square w-40 mx-auto" : "aspect-[4/1] w-full max-w-2xl"
        )}
      >
        {uploading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Uploading...</span>
          </div>
        ) : value ? (
          <>
            <img
              src={value}
              alt={label}
              className={cn(
                "h-full w-full object-cover",
                isProfile && "rounded-full"
              )}
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white shadow-lg hover:bg-red-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isProfile ? (
              <Camera className="h-8 w-8" />
            ) : (
              <ImageIcon className="h-8 w-8" />
            )}
            <span className="text-sm font-medium">
              {isProfile ? "Upload Photo" : "Upload Banner"}
            </span>
            <span className="text-xs">
              {isProfile ? "Max 2MB" : "Max 5MB"} • JPG, PNG, WebP
            </span>
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedFormats.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {value && !error && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm text-primary hover:underline font-medium"
        >
          Change {isProfile ? "Photo" : "Banner"}
        </button>
      )}
    </div>
  );
}
