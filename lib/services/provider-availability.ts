import { type Db, ObjectId } from "mongodb";
import type {
  ProviderAvailabilitySummary,
  ProviderLeavePeriod,
} from "@/types/users";

const INDIA_TIME_ZONE = "Asia/Kolkata";

export const ACTIVE_BOOKING_CONFLICT_STATUSES = [
  "requested",
  "accepted",
  "pickup_proposed",
  "reschedule_requested",
  "confirmed",
  "invoice_created",
] as const;

export const ACTIVE_ORDER_CONFLICT_STATUSES = [
  "invoiced",
  "processing",
  "washing",
  "ironing",
  "ready",
  "out_for_delivery",
] as const;

type LeavePeriodLike = Pick<ProviderLeavePeriod, "startDate" | "endDate"> & {
  _id?: ObjectId | string | { toString(): string };
  createdAt?: Date | string;
};

export type ProviderWithLeavePeriods = {
  leavePeriods?: LeavePeriodLike[] | null;
};

type BookingConflictDoc = {
  _id: ObjectId | string;
  status?: string;
  deadline?: Date | string;
  pickupSlot?: {
    dateTime?: Date | string;
  };
};

type OrderConflictDoc = {
  _id: ObjectId | string;
  process_status?: string;
  deadline?: Date | string;
  deliverySlot?: {
    dateTime?: Date | string;
  };
};

export type AvailabilityConflict = {
  kind: "booking" | "order";
  id: string;
  status: string;
  href: string;
  scheduledDate?: string;
  deadlineDate?: string;
};

export type LeaveConflictSummary = {
  bookings: AvailabilityConflict[];
  orders: AvailabilityConflict[];
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function objectIdToString(
  value: ObjectId | string | { toString(): string } | undefined,
): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toString();
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function datePartsToKey(parts: Intl.DateTimeFormatPart[]): string | null {
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysToDateKey(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    pad2(date.getUTCMonth() + 1),
    pad2(date.getUTCDate()),
  ].join("-");
}

export function normalizeLeaveDateRange(input: {
  startDate: string;
  endDate: string;
}): { startDate: string; endDate: string } {
  const startDate = input.startDate.trim();
  const endDate = input.endDate.trim();

  if (!isDateKey(startDate) || !isDateKey(endDate)) {
    throw new Error("Leave dates must be in YYYY-MM-DD format");
  }

  if (startDate > endDate) {
    throw new Error("Leave start date cannot be after end date");
  }

  return { startDate, endDate };
}

export function sortLeavePeriods(
  leavePeriods?: LeavePeriodLike[] | null,
): LeavePeriodLike[] {
  return [...(leavePeriods ?? [])].sort((left, right) => {
    if (left.startDate !== right.startDate) {
      return left.startDate.localeCompare(right.startDate);
    }

    if (left.endDate !== right.endDate) {
      return left.endDate.localeCompare(right.endDate);
    }

    return objectIdToString(left._id).localeCompare(objectIdToString(right._id));
  });
}

export function hasOverlappingLeavePeriod(
  leavePeriods: LeavePeriodLike[] | null | undefined,
  candidate: { startDate: string; endDate: string },
  options?: { excludeId?: string },
): boolean {
  const normalizedCandidate = normalizeLeaveDateRange(candidate);

  return (leavePeriods ?? []).some((leavePeriod) => {
    const leaveId = objectIdToString(leavePeriod._id);
    if (options?.excludeId && leaveId === options.excludeId) {
      return false;
    }

    return (
      leavePeriod.startDate <= normalizedCandidate.endDate &&
      leavePeriod.endDate >= normalizedCandidate.startDate
    );
  });
}

export function toIndiaDateKey(value?: Date | string | null): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (isDateKey(trimmed)) {
      return trimmed;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: INDIA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return datePartsToKey(formatter.formatToParts(parsed));
  }

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return datePartsToKey(formatter.formatToParts(value));
}

export function isDateKeyInsideLeavePeriod(
  dateKey: string | null | undefined,
  leavePeriod: { startDate: string; endDate: string },
): boolean {
  if (!dateKey) return false;
  return dateKey >= leavePeriod.startDate && dateKey <= leavePeriod.endDate;
}

export function findLeavePeriodForDateKey(
  leavePeriods: LeavePeriodLike[] | null | undefined,
  dateKey: string | null | undefined,
): LeavePeriodLike | null {
  if (!dateKey) return null;

  return (
    sortLeavePeriods(leavePeriods).find((leavePeriod) =>
      isDateKeyInsideLeavePeriod(dateKey, leavePeriod),
    ) ?? null
  );
}

export function getNextAvailableDate(
  leavePeriods: LeavePeriodLike[] | null | undefined,
  fromDateKey: string,
): string {
  let candidate = fromDateKey;

  for (const leavePeriod of sortLeavePeriods(leavePeriods)) {
    if (candidate < leavePeriod.startDate) {
      break;
    }

    if (candidate <= leavePeriod.endDate) {
      candidate = addDaysToDateKey(leavePeriod.endDate, 1);
    }
  }

  return candidate;
}

export function buildProviderAvailabilitySummary(
  provider: ProviderWithLeavePeriods,
  options?: {
    now?: Date;
    requestedDeadline?: Date | string | null;
  },
): ProviderAvailabilitySummary {
  const leavePeriods = sortLeavePeriods(provider.leavePeriods);
  const nowDateKey = toIndiaDateKey(options?.now ?? new Date());
  const currentLeave = findLeavePeriodForDateKey(leavePeriods, nowDateKey);
  const requestedDeadlineKey = toIndiaDateKey(options?.requestedDeadline);
  const requestedLeave = findLeavePeriodForDateKey(
    leavePeriods,
    requestedDeadlineKey,
  );

  let nextAvailableDate: string | undefined;
  if (requestedLeave && requestedDeadlineKey) {
    nextAvailableDate = getNextAvailableDate(leavePeriods, requestedDeadlineKey);
  } else if (currentLeave && nowDateKey) {
    nextAvailableDate = getNextAvailableDate(leavePeriods, nowDateKey);
  }

  return {
    isCurrentlyOnLeave: Boolean(currentLeave),
    activeLeaveEndDate: currentLeave?.endDate,
    isUnavailableForRequestedDeadline: Boolean(requestedLeave),
    nextAvailableDate,
  };
}

export function buildProviderPublicAvailability<T extends ProviderWithLeavePeriods>(
  provider: T,
  requestedDeadline?: Date | string | null,
): Omit<T, "leavePeriods"> & { availability: ProviderAvailabilitySummary } {
  const { leavePeriods: _leavePeriods, ...rest } = provider;

  return {
    ...rest,
    availability: buildProviderAvailabilitySummary(provider, {
      requestedDeadline,
    }),
  };
}

export async function findLeaveConflictsForProvider(args: {
  db: Db;
  providerId: ObjectId;
  leavePeriod: { startDate: string; endDate: string };
}): Promise<LeaveConflictSummary> {
  const { db, providerId, leavePeriod } = args;

  const [bookings, orders] = await Promise.all([
    db
      .collection<BookingConflictDoc>("bookings")
      .find({
        provider_id: providerId,
        status: { $in: [...ACTIVE_BOOKING_CONFLICT_STATUSES] },
      })
      .project({
        status: 1,
        deadline: 1,
        pickupSlot: 1,
      })
      .toArray(),
    db
      .collection<OrderConflictDoc>("orders")
      .find({
        provider_id: providerId,
        process_status: { $in: [...ACTIVE_ORDER_CONFLICT_STATUSES] },
      })
      .project({
        process_status: 1,
        deadline: 1,
        deliverySlot: 1,
      })
      .toArray(),
  ]);

  return {
    bookings: bookings.flatMap((booking) => {
        const scheduledDate = toIndiaDateKey(booking.pickupSlot?.dateTime);
        const deadlineDate = toIndiaDateKey(booking.deadline);
        const conflicts =
          isDateKeyInsideLeavePeriod(scheduledDate, leavePeriod) ||
          isDateKeyInsideLeavePeriod(deadlineDate, leavePeriod);

        if (!conflicts) {
          return [];
        }

        return [
          {
            kind: "booking" as const,
            id: objectIdToString(booking._id),
            status: booking.status ?? "unknown",
            href: `/provider/manage-booking`,
            scheduledDate: scheduledDate ?? undefined,
            deadlineDate: deadlineDate ?? undefined,
          },
        ];
      }),
    orders: orders.flatMap((order) => {
        const scheduledDate = toIndiaDateKey(order.deliverySlot?.dateTime);
        const deadlineDate = toIndiaDateKey(order.deadline);
        const conflicts =
          isDateKeyInsideLeavePeriod(scheduledDate, leavePeriod) ||
          isDateKeyInsideLeavePeriod(deadlineDate, leavePeriod);

        if (!conflicts) {
          return [];
        }

        return [
          {
            kind: "order" as const,
            id: objectIdToString(order._id),
            status: order.process_status ?? "unknown",
            href: `/provider/order-status`,
            scheduledDate: scheduledDate ?? undefined,
            deadlineDate: deadlineDate ?? undefined,
          },
        ];
      }),
  };
}
