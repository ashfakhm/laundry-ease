import { createOrder, getBookingById, getUserByEmail } from "@/lib/db";
import { ObjectId } from "mongodb";
import { OrderItem } from "@/types/orders";
import { calculateDistance } from "@/lib/distance";
import { requireProvider } from "@/lib/api/auth";
import { successResponse, withErrorHandling } from "@/lib/api/response";
import { createOrderSchema } from "@/lib/api/schemas";
import { Errors } from "@/lib/api/errors";
import { Role } from "@/types/enums";
import { logger } from "@/lib/logger";

interface ProviderData {
  role: Role;
  coordinates?: { lat: number; lng: number };
  radius_km?: number;
  per_km_rate?: number;
  covers_beyond_radius?: boolean;
}

export const POST = withErrorHandling(async (req: Request) => {
  const session = await requireProvider();

  const body = await req.json();
  const result = createOrderSchema.safeParse(body);

  if (!result.success) {
    throw Errors.validation(
      "Invalid order data",
      result.error.flatten().fieldErrors
    );
  }

  const { booking_id, items } = result.data;

  const booking = await getBookingById(new ObjectId(booking_id));

  if (!booking) {
    throw Errors.notFound("Booking not found");
  }

  if (booking.provider_id.toString() !== session.user.id) {
    throw Errors.forbidden(
      "You are not authorized to create an order for this booking"
    );
  }

  if (booking.status !== "accepted") {
    throw Errors.badRequest(
      "Booking must be accepted before creating an order"
    );
  }

  // Calculate total price with line items
  const processedItems: OrderItem[] = items.map((item) => ({
    ...item,
    line_total: item.quantity * item.unit_price,
  }));

  const total_price = processedItems.reduce(
    (acc, item) => acc + item.line_total,
    0
  );

  // Calculate distance using Haversine formula
  const booking_coords = booking.seeker_coordinates;
  const providerUser = (await getUserByEmail(
    session.user.email
  )) as ProviderData | null;
  const provider_coords = providerUser?.coordinates;

  // Default to 1km if coords missing
  const delivery_distance_km =
    booking_coords && provider_coords
      ? calculateDistance(booking_coords, provider_coords)
      : 1;

  if (!booking_coords || !provider_coords) {
    logger.warn("ORDERS", "Missing coordinates for booking, using default 1km", { bookingId: booking_id });
  }

  let delivery_charge = 0;
  if (providerUser?.role === Role.PROVIDER) {
    const providerData = providerUser;
    if (
      providerData.radius_km &&
      providerData.per_km_rate &&
      providerData.covers_beyond_radius
    ) {
      if (delivery_distance_km > providerData.radius_km) {
        delivery_charge =
          (delivery_distance_km - providerData.radius_km) *
          providerData.per_km_rate;
      }
    }
  }

  const platform_commission = total_price * 0.05; // 5% of item total
  const provider_payout_amount = (total_price - platform_commission) + delivery_charge; // (Items - 5%) + 100% Delivery

  const order = await createOrder({
    booking_id: new ObjectId(booking_id),
    seeker_id: new ObjectId(booking.seeker_id.toString()),
    provider_id: new ObjectId(booking.provider_id.toString()),
    items: processedItems,
    total_price,
    delivery_distance_km,
    delivery_charge,
    platform_commission,
    provider_payout_amount,
    deadline: booking.deadline ? new Date(booking.deadline) : undefined,
  });

  return successResponse(order, 201);
});
