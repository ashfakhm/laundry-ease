export type OrderProcessStatus =
  | "invoiced"
  | "processing"
  | "washing"
  | "ironing"
  | "ready"
  | "out_for_delivery"
  | "delivered";

/**
 * Server-authoritative order process lifecycle.
 * Keep this centralized so API + UI can stay consistent.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<
  Record<OrderProcessStatus, readonly OrderProcessStatus[]>
> = {
  invoiced: ["processing"],
  processing: ["washing", "ready"],
  washing: ["ironing", "ready"],
  ironing: ["ready"],
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
} as const;

export function getAllowedNextStates(
  current: OrderProcessStatus
): readonly OrderProcessStatus[] {
  return ORDER_STATUS_TRANSITIONS[current] ?? [];
}

export function isValidTransition(args: {
  from: OrderProcessStatus;
  to: OrderProcessStatus;
}): boolean {
  return getAllowedNextStates(args.from).includes(args.to);
}
