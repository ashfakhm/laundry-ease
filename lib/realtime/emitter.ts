import realtimeContracts from "@/lib/realtime/contracts";
import { logger } from "@/lib/logger";

type ComplaintMessageRecord = Record<string, unknown>;
type OrderMessageRecord = Record<string, unknown>;

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

export function emitOrderMessageCreated(message: OrderMessageRecord) {
  const serialized = realtimeContracts.serializeOrderChatMessage(message);
  emitToRoom(
    realtimeContracts.getOrderRoom(serialized.order_id),
    realtimeContracts.SERVER_EVENTS.ORDER_MESSAGE_CREATED,
    { message: serialized },
    {
      orderId: serialized.order_id,
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

export function emitOrderMessageDeleted(
  orderId: string,
  messageId: string,
  mode: "for_everyone" | "hard_delete",
) {
  emitToRoom(
    realtimeContracts.getOrderRoom(orderId),
    realtimeContracts.SERVER_EVENTS.ORDER_MESSAGE_DELETED,
    { messageId, mode },
    { orderId, messageId, mode },
  );
}

export function emitComplaintMessageDeleted(
  complaintId: string,
  messageId: string,
  mode: "for_everyone" | "hard_delete",
) {
  emitToRoom(
    realtimeContracts.getComplaintRoom(complaintId),
    realtimeContracts.SERVER_EVENTS.COMPLAINT_MESSAGE_DELETED,
    { messageId, mode },
    { complaintId, messageId, mode },
  );
}
