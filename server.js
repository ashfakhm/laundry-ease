/* eslint-disable @typescript-eslint/no-require-imports */
const dns = require("node:dns");
const { createServer } = require("node:http");

const next = require("next");
const { MongoClient, ObjectId } = require("mongodb");
const { Server } = require("socket.io");
const { getToken } = require("next-auth/jwt");

const realtimeContracts = require("./lib/realtime/contracts");
const {
  authorizeBookingRoom,
  authorizeComplaintRoom,
  resolveRealtimeUserFromToken,
} = require("./lib/realtime/socket-auth");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = Number(process.env.PORT || 3000);

if (process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"]);
}

let mongoClientPromise;

function getMongoClient() {
  if (!mongoClientPromise) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required for realtime server");
    }

    const client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    mongoClientPromise = client.connect();
  }

  return mongoClientPromise;
}

async function getRealtimeDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "laundryease");
}

async function findUserByEmail(email) {
  const db = await getRealtimeDb();
  const normalizedEmail = email.trim().toLowerCase();
  const collections = [
    ["seekers", "seeker"],
    ["providers", "provider"],
    ["admins", "admin"],
  ];

  for (const [collectionName, role] of collections) {
    const user = await db.collection(collectionName).findOne(
      { email: normalizedEmail },
      { projection: { _id: 1, email: 1 } },
    );
    if (user?._id) {
      return {
        _id: user._id.toString(),
        email: user.email,
        role,
      };
    }
  }

  return null;
}

async function findBookingById(bookingId) {
  const db = await getRealtimeDb();
  const booking = await db.collection("bookings").findOne(
    { _id: new ObjectId(bookingId) },
    { projection: { seeker_id: 1, provider_id: 1 } },
  );
  if (!booking) return null;

  return {
    seeker_id: booking.seeker_id?.toString?.() || "",
    provider_id: booking.provider_id?.toString?.() || "",
  };
}

async function findComplaintById(complaintId) {
  const db = await getRealtimeDb();
  const complaint = await db.collection("complaints").findOne(
    { _id: new ObjectId(complaintId) },
    {
      projection: {
        seeker_id: 1,
        provider_id: 1,
        provider_access_granted: 1,
        status: 1,
      },
    },
  );
  if (!complaint) return null;

  return {
    seekerId: complaint.seeker_id?.toString?.() || "",
    providerId: complaint.provider_id?.toString?.() || "",
    providerAccessGranted: Boolean(complaint.provider_access_granted),
    status: typeof complaint.status === "string" ? complaint.status : "open",
  };
}

async function bootstrap() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
  });

  globalThis._socketIoServer = io;

  io.use(async (socket, nextMiddleware) => {
    try {
      const token = await getToken({
        req: socket.request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      const user = await resolveRealtimeUserFromToken(token, {
        findUserByEmail,
      });

      if (!user) {
        return nextMiddleware(new Error("Unauthorized"));
      }

      socket.data.user = user;
      return nextMiddleware();
    } catch (error) {
      return nextMiddleware(
        error instanceof Error ? error : new Error("Unauthorized"),
      );
    }
  });

  io.on("connection", (socket) => {
    socket.on(
      realtimeContracts.CLIENT_EVENTS.BOOKING_JOIN,
      async (payload, acknowledge) => {
        const result = await authorizeBookingRoom(
          {
            bookingId: payload?.bookingId,
            user: socket.data.user,
          },
          { findBookingById },
        );

        if (!result.ok) {
          acknowledge?.(result);
          return;
        }

        await socket.join(result.room);
        acknowledge?.(result);
      },
    );

    socket.on(
      realtimeContracts.CLIENT_EVENTS.COMPLAINT_JOIN,
      async (payload, acknowledge) => {
        const result = await authorizeComplaintRoom(
          {
            complaintId: payload?.complaintId,
            user: socket.data.user,
          },
          { findComplaintById },
        );

        if (!result.ok) {
          acknowledge?.(result);
          return;
        }

        await socket.join(result.room);
        acknowledge?.(result);
      },
    );

    socket.on(realtimeContracts.CLIENT_EVENTS.ROOM_LEAVE, async (payload) => {
      if (typeof payload?.room !== "string" || payload.room.trim().length === 0) {
        return;
      }

      await socket.leave(payload.room);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start custom server", error);
  process.exit(1);
});
