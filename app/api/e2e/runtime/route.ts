import { AppError, ErrorCode } from "@/lib/api/errors";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  getE2ERuntimeProbe,
  isE2ERuntimeProbeVisible,
} from "@/lib/e2e/runtime";

export async function GET() {
  if (!isE2ERuntimeProbeVisible()) {
    return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Not Found"));
  }

  return successResponse(getE2ERuntimeProbe());
}
