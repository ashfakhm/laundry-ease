import { NextRequest } from "next/server";
import {
  RATE_LIMIT_STRICT_WINDOW_MS,
  MAX_VOICE_MESSAGE_BYTES,
} from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";
import cloudinary from "cloudinary";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAuth } from "@/lib/api/auth";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";

const isCloudinaryConfigured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);
const allowBase64Fallback =
  process.env.NODE_ENV !== "production" ||
  env.ALLOW_BASE64_UPLOAD_FALLBACK === "1";

if (isCloudinaryConfigured) {
  cloudinary.v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const VALID_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

function normalizeMimeTypeEssence(mimeType: string): string {
  const [essence = ""] = mimeType.split(";");
  return essence.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "upload:audio",
      max: 20,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "voice-messages";

    if (!file) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "No file provided"));
    }
    if (!/^[a-zA-Z0-9/_-]{1,80}$/.test(folder)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid folder name"),
      );
    }

    // Validate audio MIME type
    const normalizedFileType = normalizeMimeTypeEssence(file.type);
    if (!VALID_AUDIO_TYPES.has(normalizedFileType)) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid file type. Only WebM, MP4, MP3, OGG, and WAV audio are allowed.",
        ),
      );
    }

    // Validate file size
    if (file.size > MAX_VOICE_MESSAGE_BYTES) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Voice message too large. Maximum size is 2MB.",
        ),
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let audioUrl: string;

    if (isCloudinaryConfigured) {
      audioUrl = await new Promise<string>((resolve, reject) => {
        cloudinary.v2.uploader
          .upload_stream(
            {
              folder,
              public_id: `${Date.now()}-voice`,
              resource_type: "video", // Cloudinary uses "video" for audio files
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result?.secure_url || "");
            },
          )
          .end(buffer);
      });
    } else if (allowBase64Fallback) {
      logger.warn(
        "UPLOAD",
        "Cloudinary not configured. Using base64 encoding as fallback for audio.",
      );
      const base64 = buffer.toString("base64");
      audioUrl = `data:${file.type};base64,${base64}`;
    } else {
      return errorResponse(
        new AppError(
          ErrorCode.INTERNAL_ERROR,
          503,
          "Audio upload service is unavailable. Please try again later.",
        ),
      );
    }

    return successResponse({ url: audioUrl });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("UPLOAD", "Audio upload error", error);
    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to upload audio"),
    );
  }
}
