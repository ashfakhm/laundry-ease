import { describe, expect, it } from "vitest";
import {
  appendUniqueSortedMessages,
  deriveComplaintUiStateFromRealtime,
} from "./chat-state";

describe("chat realtime state helpers", () => {
  it("dedupes POST response and socket echo by message id", () => {
    const message = {
      _id: "msg_1",
      createdAt: "2026-03-06T10:00:00.000Z",
      sender_id: "user_1",
      sender_role: "seeker",
      message: "hello",
      booking_id: "booking_1",
    };

    const result = appendUniqueSortedMessages([], [message, message]);
    expect(result).toHaveLength(1);
    expect(result[0]?._id).toBe("msg_1");
  });

  it("locks the complaint composer when a thread is archived", () => {
    const state = deriveComplaintUiStateFromRealtime(
      {
        complaintId: "complaint_1",
        status: "resolved",
        providerAccessGranted: false,
        archived: true,
      },
      "provider",
    );

    expect(state.isResolved).toBe(true);
    expect(state.isAccessBlocked).toBe(true);
    expect(state.error).toBe("Dispute is resolved. Chat is archived.");
  });
});
