import { NextResponse } from "next/server";
import { RATE_LIMIT_STRICT_WINDOW_MS } from "@/lib/constants";
import { env } from "@/lib/env";
import { demoCronJobSchema } from "@/lib/api/schemas";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AppError, ErrorCode } from "@/lib/api/errors";
import { requireAdminWithDbCheck } from "@/lib/api/auth";
import { enforceRateLimit, requireSameOrigin } from "@/lib/api/security";
import { runDemoCronJob } from "@/lib/demo/cron-dispatch";

export async function POST(req: Request) {
  try {
    await requireSameOrigin(req);
    await enforceRateLimit(req, {
      bucket: "admin:demo:cron:run",
      max: 20,
      windowMs: RATE_LIMIT_STRICT_WINDOW_MS,
    });
    await requireAdminWithDbCheck();

    if (env.DEMO_MODE !== "1") {
      return errorResponse(new AppError(ErrorCode.NOT_FOUND, 404, "Demo mode is disabled"));
    }

    const body = await req.json();
    const parsed = demoCronJobSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 400, "Invalid demo cron request"));
    }

    const baseUrl =
      env.NEXTAUTH_URL ||
      env.NEXT_PUBLIC_BASE_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const result = await runDemoCronJob(parsed.data.job, baseUrl);
    if (!result.ok) {
      return NextResponse.json(result.payload, { status: result.status });
    }

    return successResponse({
      job: parsed.data.job,
      durationMs: result.durationMs,
      payload:
        result.payload &&
        typeof result.payload === "object" &&
        "data" in result.payload &&
        (result.payload as { data?: unknown }).data !== undefined
          ? (result.payload as { data: unknown }).data
          : result.payload,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }

    return errorResponse(
      new AppError(ErrorCode.INTERNAL_ERROR, 500, "Internal server error"),
    );
  }
}
