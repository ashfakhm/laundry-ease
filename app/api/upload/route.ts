import { uploadInvoicePhoto } from "@/lib/cloudinary";
import { requireAuth } from "@/lib/api/auth";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { successResponse, errorResponse } from "@/lib/api/response";

export const runtime = "nodejs";

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
// Allowed file types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  try {
    // Require authentication for file uploads
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 400, "No file uploaded");
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "Invalid file type. Only JPG, PNG, and WebP are allowed.",
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        400,
        "File too large. Maximum size is 5MB.",
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const url = await uploadInvoicePhoto(buffer, file.name, file.type);
    return successResponse({ url });
  } catch (error) {
    return errorResponse(error);
  }
}
