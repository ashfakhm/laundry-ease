const CLIENT_EVENTS = {
  BOOKING_JOIN: "booking:join",
  COMPLAINT_JOIN: "complaint:join",
  ROOM_LEAVE: "room:leave",
};

const SERVER_EVENTS = {
  BOOKING_MESSAGE_CREATED: "booking:message:created",
  COMPLAINT_MESSAGE_CREATED: "complaint:message:created",
  COMPLAINT_STATE_UPDATED: "complaint:state:updated",
};

function serializeId(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "object" && typeof value.toString === "function") {
    return value.toString();
  }
  return String(value);
}

function serializeDate(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value.toISOString === "function") {
    return value.toISOString();
  }
  return new Date(value || Date.now()).toISOString();
}

function getBookingRoom(bookingId) {
  return `booking:${bookingId}`;
}

function getComplaintRoom(complaintId) {
  return `complaint:${complaintId}`;
}

function serializeBookingChatMessage(message) {
  return {
    _id: serializeId(message?._id),
    booking_id: serializeId(message?.booking_id),
    sender_id: serializeId(message?.sender_id),
    sender_role: typeof message?.sender_role === "string" ? message.sender_role : "system",
    message: typeof message?.message === "string" ? message.message : "",
    createdAt: serializeDate(message?.createdAt),
  };
}

function serializeComplaintMessage(message) {
  return {
    _id: serializeId(message?._id),
    complaint_id: serializeId(message?.complaint_id),
    sender_id: serializeId(message?.sender_id),
    sender_role: typeof message?.sender_role === "string" ? message.sender_role : "system",
    message_type:
      typeof message?.message_type === "string" ? message.message_type : "TEXT",
    content: typeof message?.content === "string" ? message.content : "",
    attachments: Array.isArray(message?.attachments)
      ? message.attachments.filter((item) => typeof item === "string")
      : [],
    createdAt: serializeDate(message?.createdAt),
  };
}

function serializeComplaintStateUpdate(input) {
  const status = typeof input?.status === "string" ? input.status : "open";
  return {
    complaintId: serializeId(input?.complaintId),
    status,
    providerAccessGranted: Boolean(input?.providerAccessGranted),
    archived: status === "resolved" || status === "rejected",
  };
}

module.exports = {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  getBookingRoom,
  getComplaintRoom,
  serializeBookingChatMessage,
  serializeComplaintMessage,
  serializeComplaintStateUpdate,
};
