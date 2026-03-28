import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/security";
import { deleteProviderLeavePeriod, getProviderLeavePeriods } from "@/lib/db/provider-availability";
import { getDb } from "@/lib/mongodb";
import {
  buildProviderAvailabilitySummary,
  sortLeavePeriods,
} from "@/lib/services/provider-availability";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    await requireSameOrigin(req);

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    if (!ObjectId.isValid(id)) {
      return errorResponse(
        new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid leave id"),
      );
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);
    const leaveId = new ObjectId(id);
    const deleted = await deleteProviderLeavePeriod({ db, providerId, leaveId });

    if (!deleted) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Leave period not found"),
      );
    }

    const leavePeriods = sortLeavePeriods(
      await getProviderLeavePeriods(db, providerId),
    );

    return successResponse({
      deleted: true,
      leavePeriods,
      availability: buildProviderAvailabilitySummary({ leavePeriods }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
