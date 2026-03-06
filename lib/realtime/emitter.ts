import realtimeContracts from "@/lib/realtime/contracts";
import { logger } from "@/lib/logger";

type BookingMessageRecord = Record<string, unknown>;
type ComplaintMessageRecord = Record<string, unknown>;

function getIo() {
  return globalThis._socketIoServer;
}

function emitToRoom(
  room: string,
  event: string,
  payload: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  const io = getIo();
  if (!io) return;

  try {
    io.to(room).emit(event, payload);
  } catch (error) {
    logger.warn("REALTIME", "Socket emit failed", {
      room,
      event,
      ...context,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

export function emitBookingMessageCreated(message: BookingMessageRecord) {
  const serialized = realtimeContracts.serializeBookingChatMessage(message);
  emitToRoom(
    realtimeContracts.getBookingRoom(serialized.booking_id),
    realtimeContracts.SERVER_EVENTS.BOOKING_MESSAGE_CREATED,
    { message: serialized },
    {
      bookingId: serialized.booking_id,
      messageId: serialized._id,
    },
  );
}

export function emitComplaintMessageCreated(message: ComplaintMessageRecord) {
  const serialized = realtimeContracts.serializeComplaintMessage(message);
  emitToRoom(
    realtimeContracts.getComplaintRoom(serialized.complaint_id),
    realtimeContracts.SERVER_EVENTS.COMPLAINT_MESSAGE_CREATED,
    { message: serialized },
    {
      complaintId: serialized.complaint_id,
      messageId: serialized._id,
    },
  );
}

export function emitComplaintStateUpdated(input: {
  complaintId: string;
  status: string;
  providerAccessGranted?: boolean;
}) {
  const payload = realtimeContracts.serializeComplaintStateUpdate(input);
  emitToRoom(
    realtimeContracts.getComplaintRoom(payload.complaintId),
    realtimeContracts.SERVER_EVENTS.COMPLAINT_STATE_UPDATED,
    payload,
    {
      complaintId: payload.complaintId,
      status: payload.status,
    },
  );
}
