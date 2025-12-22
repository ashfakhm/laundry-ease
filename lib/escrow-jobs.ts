import { getHeldOrdersPastEscrowDate, releaseEscrowPayment } from "@/lib/db";

/**
 * Escrow auto-release job logic
 * Finds all orders past escrow date and releases payment if no open complaints
 */
export async function releaseEscrowPaymentsJob() {
  const ordersToRelease = await getHeldOrdersPastEscrowDate();
  if (!ordersToRelease.length) return { released: [], failed: [] };
  const released = [],
    failed = [];
  for (const order of ordersToRelease) {
    const success = await releaseEscrowPayment(order._id);
    if (success) released.push(order._id);
    else failed.push(order._id);
  }
  return { released, failed };
}
