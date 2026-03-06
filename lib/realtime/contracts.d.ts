export type ComplaintMessageDto = {
  _id: string;
  complaint_id: string;
  sender_id: string;
  sender_role: string;
  message_type: string;
  content: string;
  attachments: string[];
  createdAt: string;
};

export type OrderChatMessageDto = {
  _id: string;
  order_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  createdAt: string;
};

export type ComplaintStateUpdateDto = {
  complaintId: string;
  status: string;
  providerAccessGranted: boolean;
  archived: boolean;
};

export type TypingStartDto = {
  userId: string;
  userName: string;
  room: string;
};

export type TypingStopDto = {
  userId: string;
  room: string;
};

declare const realtimeContracts: {
  CLIENT_EVENTS: {
    COMPLAINT_JOIN: "complaint:join";
    ORDER_JOIN: "order:join";
    ROOM_LEAVE: "room:leave";
    TYPING_START: "typing:start";
    TYPING_STOP: "typing:stop";
  };
  SERVER_EVENTS: {
    COMPLAINT_MESSAGE_CREATED: "complaint:message:created";
    COMPLAINT_STATE_UPDATED: "complaint:state:updated";
    ORDER_MESSAGE_CREATED: "order:message:created";
    TYPING_START: "typing:start";
    TYPING_STOP: "typing:stop";
  };
  getComplaintRoom(complaintId: string): string;
  getOrderRoom(orderId: string): string;
  serializeComplaintMessage(
    message: Record<string, unknown>,
  ): ComplaintMessageDto;
  serializeComplaintStateUpdate(
    input: Record<string, unknown>,
  ): ComplaintStateUpdateDto;
  serializeOrderChatMessage(
    message: Record<string, unknown>,
  ): OrderChatMessageDto;
};

export default realtimeContracts;
