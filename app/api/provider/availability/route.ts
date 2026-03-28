import { ObjectId } from "mongodb";
import { requireProvider } from "@/lib/api/auth";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { successResponse, errorResponse } from "@/lib/api/response";
import { requireSameOrigin } from "@/lib/api/security";
import { providerLeaveSchema } from "@/lib/api/schemas";
import {
  createProviderLeavePeriod,
  getProviderLeavePeriods,
} from "@/lib/db/provider-availability";
import { getDb } from "@/lib/mongodb";
import {
  buildProviderAvailabilitySummary,
  findLeaveConflictsForProvider,
  normalizeLeaveDateRange,
  sortLeavePeriods,
} from "@/lib/services/provider-availability";
import type { ProviderLeavePeriod } from "@/types/users";

export async function GET() {
  try {
    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const { db } = await getDb();
    const providerId = new ObjectId(user.id);
    const leavePeriods = sortLeavePeriods(
      await getProviderLeavePeriods(db, providerId),
    );

    return successResponse({
      leavePeriods,
      availability: buildProviderAvailabilitySummary({ leavePeriods }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);

    const { user } = await requireProvider();
    if (!ObjectId.isValid(user.id)) {
      return errorResponse(
        new AppError(ErrorCode.UNAUTHORIZED, 401, "Unauthorized"),
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = providerLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        new AppError(
          ErrorCode.VALIDATION_ERROR,
          400,
          "Invalid leave dates",
          parsed.error.flatten().fieldErrors,
        ),
      );
    }

    const normalizedRange = normalizeLeaveDateRange(parsed.data);
    const providerId = new ObjectId(user.id);
    const { db } = await getDb();

    const leavePeriod: ProviderLeavePeriod = {
      _id: new ObjectId(),
      ...normalizedRange,
      createdAt: new Date(),
    };

    const creationResult = await createProviderLeavePeriod({
      db,
      providerId,
      leavePeriod,
    });

    if (creationResult.providerMissing) {
      return errorResponse(
        new AppError(ErrorCode.NOT_FOUND, 404, "Provider not found"),
      );
    }

    if (creationResult.overlapRejected) {
      return errorResponse(
        new AppError(
          ErrorCode.CONFLICT,
          409,
          "Leave dates overlap an existing leave period",
        ),
      );
    }

    const leavePeriods = sortLeavePeriods(
      await getProviderLeavePeriods(db, providerId),
    );
    const conflicts = await findLeaveConflictsForProvider({
      db,
      providerId,
      leavePeriod: normalizedRange,
    });

    return successResponse(
      {
        leavePeriod,
        leavePeriods,
        conflicts,
        availability: buildProviderAvailabilitySummary({ leavePeriods }),
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
