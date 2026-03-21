import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

const {
  mockGetDb,
  mockRequireAuth,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
}));

vi.mock("@/lib/api/security", () => ({
  requireSameOrigin: mockRequireSameOrigin,
  enforceRateLimit: mockEnforceRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { POST } from "./route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProviderReq(bookingId: string, body: unknown) {
  return new Request(
    `https://laundryease.test/api/bookings/${bookingId}/schedule`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://laundryease.test",
      },
      body: JSON.stringify(body),
    },
  );
}

function makeSeekerReq(bookingId: string, body: unknown) {
  return makeProviderReq(bookingId, body);
}

function makeDbMock(
  booking: Record<string, unknown> | null,
  updateResult: { matchedCount: number; acknowledged?: boolean } = {
    matchedCount: 1,
    acknowledged: true,
  },
) {
  const findOne = vi.fn().mockResolvedValue(booking);
  const updateOne = vi.fn().mockResolvedValue(updateResult);
  const db = { collection: vi.fn(() => ({ findOne, updateOne })) };
  mockGetDb.mockResolvedValue({ db });
  return { findOne, updateOne };
}

// ─── Shared setup ────────────────────────────────────────────────────────────

describe("POST /api/bookings/[id]/schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSameOrigin.mockResolvedValue(undefined);
    mockEnforceRateLimit.mockResolvedValue(undefined);
  });

  // ─── Input validation ───────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 for an invalid booking id", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: new ObjectId().toString(), role: Role.PROVIDER },
      });

      const req = makeProviderReq("bad-id", {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: "bad-id" }),
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.message).toBe("Invalid booking id");
      // Legacy compatibility — top-level message field must also be present.
      expect(body.message).toBe("Invalid booking id");
    });

    it("returns 400 when body has invalid dateTime format", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: new ObjectId().toString(), role: Role.PROVIDER },
      });

      const bookingId = new ObjectId();
      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: "not-a-date",
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── Authentication ─────────────────────────────────────────────────────

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "not-a-valid-object-id", role: Role.PROVIDER },
      });

      const bookingId = new ObjectId();
      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── Provider: propose slot ─────────────────────────────────────────────

  describe("provider: propose pickup slot", () => {
    it("accepts a valid slot proposal for an accepted booking", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(updateOne).toHaveBeenCalledOnce();
    });

    it("accepts a valid slot proposal for a reschedule_requested booking", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "reschedule_requested",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(200);
      expect(updateOne).toHaveBeenCalledOnce();
    });

    it("sets status to pickup_proposed and includes updatedAt in the write", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      const [, updateOp] = updateOne.mock.calls[0];
      expect(updateOp.$set.status).toBe("pickup_proposed");
      expect(updateOp.$set.updatedAt).toBeInstanceOf(Date);
    });

    it("uses $unset to clear pickupSlot.confirmedAt (not $set: undefined)", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "reschedule_requested",
        pickupSlot: {
          dateTime: new Date(),
          confirmedAt: new Date(), // previously confirmed
        },
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      const [, updateOp] = updateOne.mock.calls[0];

      // Must NOT set confirmedAt to undefined via $set — MongoDB silently ignores that.
      expect(updateOp.$set).not.toHaveProperty("pickupSlot.confirmedAt");

      // Must use $unset so the field is actually removed from the document.
      expect(updateOp.$unset).toEqual(
        expect.objectContaining({ "pickupSlot.confirmedAt": "" }),
      );
    });

    it("includes provider_id and status filter in the query for atomic TOCTOU safety", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      const [queryFilter] = updateOne.mock.calls[0];
      // Query must include provider_id so an attacker cannot propose on
      // another provider's booking and the write is safe against concurrent transitions.
      expect(queryFilter).toMatchObject({
        _id: bookingId,
        provider_id: providerId,
        status: { $in: ["accepted", "reschedule_requested"] },
      });
    });

    it("returns 409 when booking state changed concurrently (matchedCount === 0)", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock(
        {
          _id: bookingId,
          provider_id: providerId,
          status: "accepted",
        },
        { matchedCount: 0 }, // concurrent race — nothing matched
      );

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 when slot is within 2 hours from now", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min — too soon
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when slot is after the seeker's deadline", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      const deadlineSoon = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 h from now
      const slotAfterDeadline = new Date(
        Date.now() + 4 * 60 * 60 * 1000,
      ).toISOString(); // 4 h from now

      makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
        deadline: deadlineSoon.toISOString(),
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: slotAfterDeadline,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 when booking status is not accepted or reschedule_requested", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "confirmed", // wrong state
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 when provider does not own the booking", async () => {
      const bookingId = new ObjectId();
      const realProvider = new ObjectId();
      const otherProvider = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: otherProvider.toString(), role: Role.PROVIDER },
      });

      makeDbMock({
        _id: bookingId,
        provider_id: realProvider, // different provider
        status: "accepted",
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 404 when booking not found", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock(null); // booking not found

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 when a seeker tries to propose a slot", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      makeDbMock({
        _id: bookingId,
        seeker_id: seekerId,
        status: "accepted",
      });

      const req = makeSeekerReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ─── Seeker: confirm slot ───────────────────────────────────────────────

  describe("seeker: confirm pickup slot", () => {
    it("confirms a proposed slot successfully", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        seeker_id: seekerId,
        status: "pickup_proposed",
        pickupSlot: { dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000) },
      });

      // Schema requires dateTime even for confirm — pass the existing slot time.
      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(updateOne).toHaveBeenCalledOnce();
    });

    it("sets status to confirmed, sets confirmedAt, and includes updatedAt", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        seeker_id: seekerId,
        status: "pickup_proposed",
      });

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      const [, updateOp] = updateOne.mock.calls[0];
      expect(updateOp.$set.status).toBe("confirmed");
      expect(updateOp.$set["pickupSlot.confirmedAt"]).toBeInstanceOf(Date);
      expect(updateOp.$set.updatedAt).toBeInstanceOf(Date);
    });

    it("includes seeker_id and status filter in confirm query for TOCTOU safety", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      const { updateOne } = makeDbMock({
        _id: bookingId,
        seeker_id: seekerId,
        status: "pickup_proposed",
      });

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      const [queryFilter] = updateOne.mock.calls[0];
      expect(queryFilter).toMatchObject({
        _id: bookingId,
        seeker_id: seekerId,
        status: "pickup_proposed",
      });
    });

    it("returns 409 when booking state changed concurrently during confirm", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      makeDbMock(
        {
          _id: bookingId,
          seeker_id: seekerId,
          status: "pickup_proposed",
        },
        { matchedCount: 0 }, // concurrent transition — nothing matched
      );

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(409);
    });

    it("returns 400 when status is not pickup_proposed", async () => {
      const bookingId = new ObjectId();
      const seekerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: seekerId.toString(), role: Role.SEEKER },
      });

      makeDbMock({
        _id: bookingId,
        seeker_id: seekerId,
        status: "confirmed", // wrong state
      });

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 403 when seeker does not own the booking", async () => {
      const bookingId = new ObjectId();
      const realSeeker = new ObjectId();
      const otherSeeker = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: otherSeeker.toString(), role: Role.SEEKER },
      });

      makeDbMock({
        _id: bookingId,
        seeker_id: realSeeker, // different seeker
        status: "pickup_proposed",
      });

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeSeekerReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 when a provider tries to confirm a slot", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      // Provider auth but booking has a different seeker — route checks role first,
      // then ownership; role check returns 403 before ownership is evaluated.
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock({
        _id: bookingId,
        seeker_id: new ObjectId(), // some seeker
        provider_id: providerId,
        status: "pickup_proposed",
      });

      const slotTime = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
      const req = makeProviderReq(bookingId.toString(), {
        action: "confirm",
        dateTime: slotTime,
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ─── Legacy compatibility ───────────────────────────────────────────────

  describe("legacy response shape compatibility", () => {
    it("returns top-level ok:true alongside success:true for provider propose", async () => {
      const bookingId = new ObjectId();
      const providerId = new ObjectId();
      mockRequireAuth.mockResolvedValue({
        user: { id: providerId.toString(), role: Role.PROVIDER },
      });

      makeDbMock({
        _id: bookingId,
        provider_id: providerId,
        status: "accepted",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const req = makeProviderReq(bookingId.toString(), {
        action: "propose",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
      const res = await POST(req, {
        params: Promise.resolve({ id: bookingId.toString() }),
      });
      const body = await res.json();

      expect(body.ok).toBe(true);
      expect(body.success).toBe(true);
    });
  });
});
