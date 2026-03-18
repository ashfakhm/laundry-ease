import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { Role } from "@/types/enums";

type UserDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  role: Role;
  businessName?: string;
};

type OrderDoc = {
  _id: ObjectId;
  booking_id: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  process_status: string;
  payment_status: string;
  total_price: number;
  razorpay_payment_id?: string;
  otp_confirmed_at?: Date;
  escrow_frozen_at?: Date;
  [key: string]: unknown;
};

type ComplaintDoc = {
  _id: ObjectId;
  order_id: ObjectId;
  booking_id?: ObjectId;
  seeker_id: ObjectId;
  provider_id: ObjectId;
  complaint_type: string;
  title: string;
  description: string;
  photos?: string[];
  status: string;
  provider_access_granted?: boolean;
  participants?: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

type ComplaintMessageDoc = {
  _id: ObjectId;
  complaint_id: ObjectId;
  sender_id: ObjectId;
  sender_role: string;
  message_type: string;
  content: string;
  attachments?: string[];
  createdAt: Date;
  [key: string]: unknown;
};

type NotificationDoc = {
  _id: ObjectId;
  recipient_id: ObjectId;
  recipient_role: "seeker" | "provider";
  complaint_id: ObjectId;
  category: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  [key: string]: unknown;
};

type InMemoryStore = {
  usersByEmail: Record<string, UserDoc>;
  orders: OrderDoc[];
  complaints: ComplaintDoc[];
  complaint_messages: ComplaintMessageDoc[];
  notifications: NotificationDoc[];
  seekers: UserDoc[];
  providers: UserDoc[];
  admins: UserDoc[];
};

const {
  ctx,
  mockRequireAuth,
  mockRequireSeeker,
  mockRequireAdmin,
  mockRequireAdminWithDbCheck,
  mockGetUserByEmail,
  mockGetOrderById,
  mockCreateComplaint,
  mockFreezeEscrow,
  mockGetDb,
  mockRefundRazorpayPayment,
  mockInitiateOrderPayout,
  mockRequireSameOrigin,
  mockEnforceRateLimit,
} = vi.hoisted(() => ({
  ctx: {
    actor: "seeker" as "seeker" | "provider" | "admin",
    store: {
      usersByEmail: {} as Record<string, UserDoc>,
      orders: [] as OrderDoc[],
      complaints: [] as ComplaintDoc[],
      complaint_messages: [] as ComplaintMessageDoc[],
      notifications: [] as NotificationDoc[],
      seekers: [] as UserDoc[],
      providers: [] as UserDoc[],
      admins: [] as UserDoc[],
    } as InMemoryStore,
  },
  mockRequireAuth: vi.fn(),
  mockRequireSeeker: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockRequireAdminWithDbCheck: vi.fn(),
  mockGetUserByEmail: vi.fn(),
  mockGetOrderById: vi.fn(),
  mockCreateComplaint: vi.fn(),
  mockFreezeEscrow: vi.fn(),
  mockGetDb: vi.fn(),
  mockRefundRazorpayPayment: vi.fn(),
  mockInitiateOrderPayout: vi.fn(),
  mockRequireSameOrigin: vi.fn(),
  mockEnforceRateLimit: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({
  requireAuth: mockRequireAuth,
  requireSeeker: mockRequireSeeker,
  requireAdmin: mockRequireAdmin,
  requireAdminWithDbCheck: mockRequireAdminWithDbCheck,
}));

vi.mock("@/lib/db/index", () => ({
  getUserByEmail: mockGetUserByEmail,
  getOrderById: mockGetOrderById,
  createComplaint: mockCreateComplaint,
  freezeEscrow: mockFreezeEscrow,
}));

vi.mock("@/lib/mongodb", () => ({
  getDb: mockGetDb,
}));

vi.mock("@/lib/razorpay", () => ({
  refundRazorpayPayment: mockRefundRazorpayPayment,
}));

vi.mock("@/lib/payouts", () => ({
  initiateOrderPayout: mockInitiateOrderPayout,
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
  },
}));

import { POST as createComplaint, GET as listComplaints } from "./route";
import {
  GET as getComplaintMessages,
  POST as postComplaintMessage,
} from "./[id]/messages/route";
import { POST as acceptComplaint } from "../admin/complaints/[id]/accept/route";
import { POST as addProviderToComplaint } from "../admin/complaints/[id]/add-provider/route";
import { POST as resolveComplaint } from "../admin/complaints/[id]/resolve/route";

const SEEKER_ID = "507f1f77bcf86cd799439021";
const PROVIDER_ID = "507f1f77bcf86cd799439022";
const ADMIN_ID = "507f1f77bcf86cd799439023";
const ORDER_ID = "507f1f77bcf86cd799439031";
const BOOKING_ID = "507f1f77bcf86cd799439032";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof ObjectId)
  );
}

function equalsValue(a: unknown, b: unknown): boolean {
  const aObj = a instanceof ObjectId;
  const bObj = b instanceof ObjectId;
  if (aObj || bObj) {
    return String(a) === String(b);
  }
  return a === b;
}

function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>,
) {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = doc[key];

    if (isPlainObject(expected)) {
      if ("$in" in expected) {
        const inValues = expected.$in as unknown[];
        if (!inValues.some((candidate) => equalsValue(actual, candidate))) {
          return false;
        }
        continue;
      }

      if ("$nin" in expected) {
        const ninValues = expected.$nin as unknown[];
        if (ninValues.some((candidate) => equalsValue(actual, candidate))) {
          return false;
        }
        continue;
      }

      if ("$ne" in expected) {
        if (equalsValue(actual, expected.$ne)) {
          return false;
        }
        continue;
      }

      if ("$exists" in expected) {
        const exists = actual !== undefined;
        if (Boolean(expected.$exists) !== exists) {
          return false;
        }
        continue;
      }
    }

    if (!equalsValue(actual, expected)) {
      return false;
    }
  }

  return true;
}

function makeCursor<T extends Record<string, unknown>>(items: T[]) {
  return {
    sort(sortSpec: Record<string, 1 | -1>) {
      const [field, direction] = Object.entries(sortSpec)[0];
      const sorted = [...items].sort((a, b) => {
        const av: unknown = a[field];
        const bv: unknown = b[field];
        const at = av instanceof Date ? av.getTime() : (av as number);
        const bt = bv instanceof Date ? bv.getTime() : (bv as number);
        if (at === bt) return 0;
        return at > bt ? direction : -direction;
      });
      return makeCursor(sorted);
    },
    limit(count: number) {
      if (!Number.isFinite(count) || count <= 0) {
        return makeCursor([]);
      }
      return makeCursor(items.slice(0, Math.floor(count)));
    },
    async toArray() {
      return [...items];
    },
  };
}

function getCollectionData(name: string): Record<string, unknown>[] {
  switch (name) {
    case "orders":
      return ctx.store.orders;
    case "complaints":
      return ctx.store.complaints;
    case "complaint_messages":
      return ctx.store.complaint_messages;
    case "notifications":
      return ctx.store.notifications;
    case "seekers":
      return ctx.store.seekers;
    case "providers":
      return ctx.store.providers;
    case "admins":
      return ctx.store.admins;
    default:
      throw new Error(`Unknown in-memory collection: ${name}`);
  }
}

function makeDb() {
  return {
    collection(name: string) {
      const collectionData = getCollectionData(name);

      return {
        async findOne(filter: Record<string, unknown>) {
          return (
            collectionData.find((doc) => matchesFilter(doc, filter)) || null
          );
        },
        find(filter: Record<string, unknown> = {}) {
          const found = collectionData.filter((doc) =>
            matchesFilter(doc, filter),
          );
          return makeCursor(found);
        },
        async insertOne(doc: Record<string, unknown>) {
          const nextDoc = {
            _id: doc._id || new ObjectId(),
            ...doc,
          };
          collectionData.push(nextDoc);
          return { acknowledged: true, insertedId: nextDoc._id };
        },
        async insertMany(docs: Record<string, unknown>[]) {
          const insertedIds: Record<number, unknown> = {};
          docs.forEach((doc, index) => {
            const nextDoc = {
              _id: doc._id || new ObjectId(),
              ...doc,
            };
            collectionData.push(nextDoc);
            insertedIds[index] = nextDoc._id;
          });
          return {
            acknowledged: true,
            insertedCount: docs.length,
            insertedIds,
          };
        },
        async updateOne(
          filter: Record<string, unknown>,
          update: Record<string, unknown>,
        ) {
          const idx = collectionData.findIndex((doc) =>
            matchesFilter(doc, filter),
          );
          if (idx === -1) return { matchedCount: 0, modifiedCount: 0 };

          const target = collectionData[idx] as Record<string, unknown>;
          if (isPlainObject(update.$set)) {
            Object.assign(target, update.$set);
          }
          if (isPlainObject(update.$unset)) {
            for (const key of Object.keys(update.$unset)) {
              delete target[key];
            }
          }
          if (isPlainObject(update.$addToSet)) {
            for (const [key, value] of Object.entries(update.$addToSet)) {
              if (!Array.isArray(target[key])) target[key] = [];
              const values = target[key] as unknown[];
              const exists = values.some((v: unknown) => equalsValue(v, value));
              if (!exists) {
                values.push(value);
              }
            }
          }
          return { matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };
}

function setActor(actor: "seeker" | "provider" | "admin") {
  ctx.actor = actor;
}

function currentUser() {
  const emailByActor = {
    seeker: "seeker@test.com",
    provider: "provider@test.com",
    admin: "admin@test.com",
  } as const;
  return ctx.store.usersByEmail[emailByActor[ctx.actor]];
}

function jsonRequest(method: string, url: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      origin: "https://laundryease.test",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  const seekerObjectId = new ObjectId(SEEKER_ID);
  const providerObjectId = new ObjectId(PROVIDER_ID);
  const adminObjectId = new ObjectId(ADMIN_ID);
  const orderObjectId = new ObjectId(ORDER_ID);

  const seeker = {
    _id: seekerObjectId,
    email: "seeker@test.com",
    name: "Seeker User",
    role: Role.SEEKER,
  };
  const provider = {
    _id: providerObjectId,
    email: "provider@test.com",
    name: "Provider User",
    businessName: "Provider Laundry",
    role: Role.PROVIDER,
  };
  const admin = {
    _id: adminObjectId,
    email: "admin@test.com",
    name: "Admin User",
    role: Role.ADMIN,
  };

  ctx.store = {
    usersByEmail: {
      [seeker.email]: seeker,
      [provider.email]: provider,
      [admin.email]: admin,
    },
    seekers: [seeker],
    providers: [provider],
    admins: [admin],
    orders: [
      {
        _id: orderObjectId,
        booking_id: new ObjectId(BOOKING_ID),
        seeker_id: seekerObjectId,
        provider_id: providerObjectId,
        process_status: "delivered",
        payment_status: "held",
        total_price: 500,
        razorpay_payment_id: "pay_order_1",
        otp_confirmed_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
    complaints: [],
    complaint_messages: [],
    notifications: [],
  };

  setActor("seeker");

  mockRequireAuth.mockImplementation(async () => {
    const user = currentUser();
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  });

  mockRequireSeeker.mockImplementation(async () => {
    const user = currentUser();
    if (user.role !== Role.SEEKER) {
      throw new Error("Unauthorized");
    }
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  });

  mockRequireAdmin.mockImplementation(async () => {
    const user = currentUser();
    if (user.role !== Role.ADMIN) {
      throw new Error("Forbidden");
    }
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  });

  mockRequireAdminWithDbCheck.mockImplementation(async () => {
    const user = currentUser();
    if (user.role !== Role.ADMIN) {
      throw new Error("Forbidden");
    }
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  });

  mockGetUserByEmail.mockImplementation(async (email: string) => {
    return ctx.store.usersByEmail[email] || null;
  });

  mockGetOrderById.mockImplementation(async (id: ObjectId) => {
    return (
      ctx.store.orders.find((order) => String(order._id) === String(id)) || null
    );
  });

  mockCreateComplaint.mockImplementation(
    async (payload: Record<string, unknown>) => {
      const complaint: ComplaintDoc = {
        _id: new ObjectId(),
        order_id: payload.order_id as ObjectId,
        booking_id: payload.booking_id as ObjectId | undefined,
        seeker_id: payload.seeker_id as ObjectId,
        provider_id: payload.provider_id as ObjectId,
        complaint_type: payload.complaint_type as string,
        title: payload.title as string,
        description: payload.description as string,
        photos: (payload.photos as string[] | undefined) || [],
        status: "open",
        provider_access_granted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (payload.participants && Array.isArray(payload.participants)) {
        complaint.participants = payload.participants as ObjectId[];
      }
      if (payload.response_deadline instanceof Date) {
        complaint.response_deadline = payload.response_deadline;
      }
      if (payload.acceptedAt instanceof Date) {
        complaint.acceptedAt = payload.acceptedAt;
      }
      if (payload.resolvedAt instanceof Date) {
        complaint.resolvedAt = payload.resolvedAt;
      }
      ctx.store.complaints.push(complaint);

      const initialMessage = {
        _id: new ObjectId(),
        complaint_id: complaint._id,
        sender_id: complaint.seeker_id,
        sender_role: "seeker",
        message_type: "TEXT",
        content: `**${complaint.title}**\n\n${complaint.description}`,
        attachments: complaint.photos || [],
        createdAt: complaint.createdAt,
      };

      ctx.store.complaint_messages.push(initialMessage);

      return complaint;
    },
  );

  mockFreezeEscrow.mockImplementation(async (orderId: ObjectId) => {
    const order = ctx.store.orders.find(
      (candidate) => String(candidate._id) === String(orderId),
    );
    if (order) {
      order.escrow_frozen_at = new Date();
    }
  });

  mockGetDb.mockImplementation(async () => ({
    db: makeDb(),
  }));

  mockRefundRazorpayPayment.mockResolvedValue({ id: "rfnd_1" });
  mockInitiateOrderPayout.mockResolvedValue({
    orderId: ORDER_ID,
    status: "payout_initiated",
    payoutId: "pout_1",
  });

  mockRequireSameOrigin.mockResolvedValue(undefined);
  mockEnforceRateLimit.mockResolvedValue({
    limit: 50,
    remaining: 49,
    resetAt: new Date(),
    retryAfterSeconds: 60,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("complaint ticket lifecycle", () => {
  it("supports open -> accept -> add-provider -> resolve flow and hides finalized complaints", async () => {
    const createRes = await createComplaint(
      jsonRequest("POST", "https://laundryease.test/api/complaints", {
        order_id: ORDER_ID,
        complaint_type: "quality_issue",
        title: "Washed clothes still stained",
        description: "Multiple shirts returned with visible stains.",
        photos: ["https://example.com/evidence-1.jpg"],
      }),
    );
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const complaintId = String(createData.data._id);

    const seekerListBeforeResolve = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const seekerListBeforeData = await seekerListBeforeResolve.json();
    expect(seekerListBeforeResolve.status).toBe(200);
    expect(seekerListBeforeData.data).toHaveLength(1);

    setActor("provider");
    const providerListBeforeAdd = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const providerListBeforeData = await providerListBeforeAdd.json();
    expect(providerListBeforeAdd.status).toBe(200);
    expect(providerListBeforeData.data).toHaveLength(0);

    const providerMessagesBeforeAccess = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    expect(providerMessagesBeforeAccess.status).toBe(403);

    setActor("admin");
    const acceptRes = await acceptComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/accept`,
        { deadlineDays: 5 },
      ),
      routeParams(complaintId),
    );
    expect(acceptRes.status).toBe(200);

    const addProviderRes = await addProviderToComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/add-provider`,
      ),
      routeParams(complaintId),
    );
    expect(addProviderRes.status).toBe(200);

    setActor("provider");
    const providerListAfterAdd = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const providerListAfterData = await providerListAfterAdd.json();
    expect(providerListAfterAdd.status).toBe(200);
    expect(providerListAfterData.data).toHaveLength(1);

    const providerMessagesAfterAccess = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    expect(providerMessagesAfterAccess.status).toBe(200);
    const providerMessagesAfterData = await providerMessagesAfterAccess.json();
    expect(providerMessagesAfterData.data.length).toBeGreaterThanOrEqual(1); // 1 = initial seker message

    const providerReplyRes = await postComplaintMessage(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
        {
          content: "I can recollect and rewash the items today.",
        },
      ),
      routeParams(complaintId),
    );
    expect(providerReplyRes.status).toBe(201);

    setActor("seeker");
    const seekerMessagesWithProviderReply = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    const seekerMessagesData = await seekerMessagesWithProviderReply.json();
    expect(
      seekerMessagesData.data.some(
        (msg: { content?: string }) =>
          msg.content === "I can recollect and rewash the items today.",
      ),
    ).toBe(true);

    setActor("admin");
    const resolveRes = await resolveComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/resolve`,
        { outcome: "refund_full" },
      ),
      routeParams(complaintId),
    );
    expect(resolveRes.status).toBe(200);

    const updatedOrder = ctx.store.orders[0];
    expect(updatedOrder.payment_status).toBe("refunded");
    expect(mockRefundRazorpayPayment).toHaveBeenCalledOnce();

    setActor("seeker");
    const seekerListAfterResolve = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const seekerListAfterData = await seekerListAfterResolve.json();
    expect(seekerListAfterResolve.status).toBe(200);
    expect(seekerListAfterData.data).toHaveLength(0);

    setActor("provider");
    const providerListAfterResolve = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const providerListAfterResolveData = await providerListAfterResolve.json();
    expect(providerListAfterResolve.status).toBe(200);
    expect(providerListAfterResolveData.data).toHaveLength(0);

    const providerMessagesAfterResolve = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    expect(providerMessagesAfterResolve.status).toBe(403);
  });

  it("supports commission-aware partial settlement during complaint resolution", async () => {
    const createRes = await createComplaint(
      jsonRequest("POST", "https://laundryease.test/api/complaints", {
        order_id: ORDER_ID,
        complaint_type: "late_delivery",
        title: "Arrived late and some items still damp",
        description: "Need partial compensation for the issue.",
        photos: ["https://example.com/evidence-1.jpg"],
      }),
    );
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const complaintId = String(createData.data._id);

    setActor("admin");
    const acceptRes = await acceptComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/accept`,
        { deadlineDays: 5 },
      ),
      routeParams(complaintId),
    );
    expect(acceptRes.status).toBe(200);

    const addProviderRes = await addProviderToComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/add-provider`,
      ),
      routeParams(complaintId),
    );
    expect(addProviderRes.status).toBe(200);

    const resolveRes = await resolveComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/resolve`,
        { outcome: "refund_partial", seeker_refund_amount: 200 },
      ),
      routeParams(complaintId),
    );
    const resolveData = await resolveRes.json();

    expect(resolveRes.status).toBe(200);
    expect(resolveData.data.outcome).toBe("refund_partial");
    expect(resolveData.data.settlement.seeker_refund_amount).toBe(200);
    expect(resolveData.data.settlement.provider_payout_amount).toBe(275);
    expect(resolveData.data.settlement.platform_commission).toBe(25);

    const payoutCall = mockInitiateOrderPayout.mock.calls.at(-1);
    expect(payoutCall).toBeDefined();
    expect(String(payoutCall?.[0])).toBe(ORDER_ID);
    expect(payoutCall?.[1]).toMatchObject({
      ignoreEscrowDate: true,
      source: "complaint_refund_partial",
      overrideProviderPayoutAmount: 275,
      overridePlatformCommission: 25,
    });

    expect(mockRefundRazorpayPayment).toHaveBeenCalledWith(
      "pay_order_1",
      20000,
      expect.objectContaining({
        source: "complaint_resolution",
        complaint_id: complaintId,
        outcome: "refund_partial",
      }),
    );

    expect(ctx.store.orders[0].refund_amount).toBe(200);
    expect(ctx.store.orders[0].provider_payout_amount).toBe(275);
    expect(ctx.store.orders[0].platform_commission).toBe(25);
  });

  it("rejects complaint, releases provider payout, and hides it from seeker/provider", async () => {
    const createRes = await createComplaint(
      jsonRequest("POST", "https://laundryease.test/api/complaints", {
        order_id: ORDER_ID,
        complaint_type: "quality_issue",
        title: "Reject flow regression guard",
        description: "Used to validate reject behavior end-to-end.",
        photos: ["https://example.com/evidence-2.jpg"],
      }),
    );
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const complaintId = String(createData.data._id);

    setActor("admin");
    const acceptRes = await acceptComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/accept`,
        { deadlineDays: 5 },
      ),
      routeParams(complaintId),
    );
    expect(acceptRes.status).toBe(200);

    const addProviderRes = await addProviderToComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/add-provider`,
      ),
      routeParams(complaintId),
    );
    expect(addProviderRes.status).toBe(200);

    const resolveRes = await resolveComplaint(
      jsonRequest(
        "POST",
        `https://laundryease.test/api/admin/complaints/${complaintId}/resolve`,
        { outcome: "reject" },
      ),
      routeParams(complaintId),
    );
    const resolveData = await resolveRes.json();

    expect(resolveRes.status).toBe(200);
    expect(resolveData.data.status).toBe("rejected");
    expect(resolveData.data.outcome).toBe("release_payout");
    expect(resolveData.data.settlement.seeker_refund_amount).toBe(0);
    expect(resolveData.data.settlement.provider_payout_amount).toBe(475);
    expect(resolveData.data.settlement.platform_commission).toBe(25);
    expect(mockInitiateOrderPayout).toHaveBeenCalledWith(
      expect.any(ObjectId),
      expect.objectContaining({
        ignoreEscrowDate: true,
        source: "complaint_reject",
        overrideProviderPayoutAmount: 475,
        overridePlatformCommission: 25,
      }),
    );
    expect(mockRefundRazorpayPayment).not.toHaveBeenCalled();

    const storedComplaint = ctx.store.complaints.find(
      (item) => String(item._id) === complaintId,
    );
    expect(storedComplaint?.status).toBe("rejected");
    expect(storedComplaint?.provider_access_granted).toBe(false);

    setActor("seeker");
    const seekerListAfterReject = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const seekerListData = await seekerListAfterReject.json();
    expect(seekerListAfterReject.status).toBe(200);
    expect(seekerListData.data).toHaveLength(0);

    const seekerMessagesAfterReject = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    expect(seekerMessagesAfterReject.status).toBe(403);

    setActor("provider");
    const providerListAfterReject = await listComplaints(
      jsonRequest("GET", "https://laundryease.test/api/complaints"),
    );
    const providerListData = await providerListAfterReject.json();
    expect(providerListAfterReject.status).toBe(200);
    expect(providerListData.data).toHaveLength(0);

    const providerMessagesAfterReject = await getComplaintMessages(
      jsonRequest(
        "GET",
        `https://laundryease.test/api/complaints/${complaintId}/messages`,
      ),
      routeParams(complaintId),
    );
    expect(providerMessagesAfterReject.status).toBe(403);
  });
});
