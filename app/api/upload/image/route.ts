import { NextRequest } from "next/server";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { successResponse, errorResponse } from "@/lib/api/response";
import cloudinary from "cloudinary";
import { logger } from "@/lib/logger";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAuth } from "@/lib/api/auth";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { ObjectId } from "mongodb";
import { env } from "@/lib/env";

// Check if Cloudinary is configured
const isCloudinaryConfigured = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);
const allowBase64Fallback =
  process.env.NODE_ENV !== "production" ||
  env.ALLOW_BASE64_UPLOAD_FALLBACK === "1";

// Configure Cloudinary only if credentials exist
if (isCloudinaryConfigured) {
  cloudinary.v2.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "upload:image",
      max: 30,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });

    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id)) {
      return errorResponse(new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"));
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "provider-images";

    if (!file) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "No file provided"));
    }
    if (!/^[a-zA-Z0-9/_-]{1,80}$/.test(folder)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid folder name"));
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid file type. Only JPG, PNG, and WebP are allowed."));
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "File too large. Maximum size is 5MB."));
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Use Cloudinary if configured, otherwise controlled base64 fallback.
    let imageUrl: string;

    if (isCloudinaryConfigured) {
      // Upload to Cloudinary
      imageUrl = await new Promise<string>((resolve, reject) => {
        cloudinary.v2.uploader
          .upload_stream(
            {
              folder,
              public_id: `${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}`,
              resource_type: "auto",
              transformation: [
                { width: 1200, height: 1200, crop: "limit" },
                { quality: "auto:good" },
                { fetch_format: "auto" },
              ],
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result?.secure_url || "");
            },
          )
          .end(buffer);
      });
    } else if (allowBase64Fallback) {
      // Fallback to base64 encoding
      logger.warn(
        "UPLOAD",
        "Cloudinary not configured. Using base64 encoding as fallback.",
      );
      const base64 = buffer.toString("base64");
      imageUrl = `data:${file.type};base64,${base64}`;
    } else {
      return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 503, "Image upload service is unavailable. Please try again later."));
    }

    return successResponse({ url: imageUrl });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    logger.error("UPLOAD", "Image upload error", error);
    return errorResponse(new AppError(ErrorCode.INTERNAL_ERROR, 500, "Failed to upload image"));
  }
}
