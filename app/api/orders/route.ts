import { requireProvider } from "@/lib/api/auth";
import { withErrorHandling } from "@/lib/api/response";
import { Errors } from "@/lib/api/errors";

// Order creation is intentionally disabled at this endpoint.
// Canonical order creation must happen through invoice approval + payment verification flows.
export const POST = withErrorHandling(async () => {
  await requireProvider();
  throw Errors.badRequest(
    "Direct order creation is disabled. Orders are created through invoice approval and payment flow only.",
  );
});
