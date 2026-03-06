import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEmit = vi.fn();
const mockTo = vi.fn(() => ({ emit: mockEmit }));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  emitComplaintMessageCreated,
  emitComplaintStateUpdated,
} from "./emitter";

describe("realtime emitter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>)._socketIoServer;
  });

  describe("when _socketIoServer is undefined", () => {
    it("emitComplaintMessageCreated is a no-op", () => {
      expect(() =>
        emitComplaintMessageCreated({
          _id: "msg2",
          complaint_id: "c1",
          sender_id: "u1",
          sender_role: "seeker",
          message_type: "TEXT",
          content: "hello",
          attachments: [],
          createdAt: new Date(),
        }),
      ).not.toThrow();

      expect(mockTo).not.toHaveBeenCalled();
    });

    it("emitComplaintStateUpdated is a no-op", () => {
      expect(() =>
        emitComplaintStateUpdated({
          complaintId: "c1",
          status: "resolved",
          providerAccessGranted: true,
        }),
      ).not.toThrow();

      expect(mockTo).not.toHaveBeenCalled();
    });
  });

  describe("when _socketIoServer is present", () => {
    beforeEach(() => {
      (globalThis as Record<string, unknown>)._socketIoServer = {
        to: mockTo,
      };
    });

    it("emitComplaintMessageCreated emits to the correct room", () => {
      emitComplaintMessageCreated({
        _id: "msg2",
        complaint_id: "c1",
        sender_id: "u1",
        sender_role: "admin",
        message_type: "TEXT",
        content: "update",
        attachments: [],
        createdAt: new Date("2025-01-01T00:00:00Z"),
      });

      expect(mockTo).toHaveBeenCalledWith("complaint:c1");
      expect(mockEmit).toHaveBeenCalledWith(
        "complaint:message:created",
        expect.objectContaining({
          message: expect.objectContaining({
            _id: "msg2",
            complaint_id: "c1",
            content: "update",
          }),
        }),
      );
    });

    it("emitComplaintStateUpdated emits to the correct room", () => {
      emitComplaintStateUpdated({
        complaintId: "c1",
        status: "resolved",
        providerAccessGranted: true,
      });

      expect(mockTo).toHaveBeenCalledWith("complaint:c1");
      expect(mockEmit).toHaveBeenCalledWith(
        "complaint:state:updated",
        expect.objectContaining({
          complaintId: "c1",
          status: "resolved",
          providerAccessGranted: true,
          archived: true,
        }),
      );
    });

    it("handles emit errors gracefully", () => {
      mockEmit.mockImplementationOnce(() => {
        throw new Error("transport closed");
      });

      expect(() =>
        emitComplaintMessageCreated({
          _id: "msg3",
          complaint_id: "c2",
          sender_id: "u1",
          sender_role: "seeker",
          message_type: "TEXT",
          content: "test",
          attachments: [],
          createdAt: new Date(),
        }),
      ).not.toThrow();
    });
  });
});
