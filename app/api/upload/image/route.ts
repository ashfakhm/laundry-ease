import { NextRequest, NextResponse } from "next/server";
import cloudinary from "cloudinary";
import { logger } from "@/lib/logger";
import { AppError } from "@/lib/api/errors";
import { requireAuth } from "@/lib/api/auth";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { ObjectId } from "mongodb";

// Check if Cloudinary is configured
const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
const allowBase64Fallback =
  process.env.NODE_ENV !== "production" ||
  process.env.ALLOW_BASE64_UPLOAD_FALLBACK === "1";

// Configure Cloudinary only if credentials exist
if (isCloudinaryConfigured) {
  cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "upload:image",
      max: 30,
      windowMs: 5 * 60 * 1000,
    });

    const { user } = await requireAuth();
    if (!user?.id || !ObjectId.isValid(user.id)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "provider-images";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9/_-]{1,80}$/.test(folder)) {
      return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
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
            }
          )
          .end(buffer);
      });
    } else if (allowBase64Fallback) {
      // Fallback to base64 encoding
      logger.warn("UPLOAD", "Cloudinary not configured. Using base64 encoding as fallback.");
      const base64 = buffer.toString("base64");
      imageUrl = `data:${file.type};base64,${base64}`;
    } else {
      return NextResponse.json(
        { error: "Image upload service is unavailable. Please try again later." },
        { status: 503 },
      );
    }

    return NextResponse.json({ url: imageUrl }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: error.statusCode },
      );
    }

    logger.error("UPLOAD", "Image upload error", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
}
