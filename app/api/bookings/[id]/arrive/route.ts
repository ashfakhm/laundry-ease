import { handleProviderArrival } from "@/lib/bookings/arrive-handler";

// POST: Provider marks themselves as arrived at pickup location
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const lat = typeof body?.lat === "number" ? body.lat : Number.NaN;
  const lng = typeof body?.lng === "number" ? body.lng : Number.NaN;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);

  return handleProviderArrival({
    req,
    bookingId: id,
    coordinates: hasCoordinates ? { lat, lng } : null,
    rateLimitBucket: "bookings:arrive",
    logContext: "arrive_route",
  });
}
