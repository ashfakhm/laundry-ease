/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Custom Node.js server for LaundryEase.
 *
 * Attaches a Socket.IO server to the same HTTP server as Next.js.
 * Handles JWT auth, room join/leave authorization, typing indicator relay,
 * and per-socket rate limiting.
 *
 * @module server
 */
const dns = require("node:dns");
const { createServer } = require("node:http");

const next = require("next");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { Server } = require("socket.io");

const { getRequestAuthToken } = require("./lib/auth/request-token");
const realtimeContracts = require("./lib/realtime/contracts");
const {
  authorizeComplaintRoom,
  authorizeOrderRoom,
  resolveRealtimeUserFromToken,
} = require("./lib/realtime/socket-auth");

/* ------------------------------------------------------------------ */
/*  CLI helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a CLI argument value by flag name.
 * @param {string[]} flagNames
 * @returns {string | undefined}
 */
function getCliArgValue(flagNames) {
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (flagNames.includes(arg)) {
      return process.argv[index + 1];
    }

    for (const flagName of flagNames) {
      const prefix = `${flagName}=`;
      if (arg.startsWith(prefix)) {
        return arg.slice(prefix.length);
      }
    }
  }

  return undefined;
}

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const cliPort = getCliArgValue(["--port", "-p"]);
const port = Number(process.env.PORT || cliPort || 3000);

if (process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"]);
}

/* ------------------------------------------------------------------ */
/*  MongoDB helpers                                                    */
/* ------------------------------------------------------------------ */

function getMongoClient() {
  if (!globalThis.__laundryEaseMongoClientPromise) {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required for realtime server");
    }

    const client = new MongoClient(process.env.MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
      },
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    globalThis.__laundryEaseMongoClientPromise = client.connect().catch(
      (error) => {
        globalThis.__laundryEaseMongoClientPromise = undefined;
        throw error;
      },
    );
  }

  return globalThis.__laundryEaseMongoClientPromise;
}

async function getRealtimeDb() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "laundryease");
}

/**
 * Resolve a user record from email across seeker/provider/admin collections.
 * @param {string} email
 * @returns {Promise<{_id: string, email: string, role: string} | null>}
 */
async function findUserByEmail(email) {
  const db = await getRealtimeDb();
  const normalizedEmail = email.trim().toLowerCase();
  const collections = [
    ["seekers", "seeker"],
    ["providers", "provider"],
    ["admins", "admin"],
  ];

  for (const [collectionName, role] of collections) {
    const user = await db
      .collection(collectionName)
      .findOne(
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

/**
 * Fetch complaint details for room authorization.
 * @param {string} complaintId
 */
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

/**
 * Fetch order participant IDs.
 * @param {string} orderId
 */
async function findOrderById(orderId) {
  const db = await getRealtimeDb();
  const order = await db
    .collection("orders")
    .findOne(
      { _id: new ObjectId(orderId) },
      { projection: { seeker_id: 1, provider_id: 1 } },
    );
  if (!order) return null;

  return {
    seeker_id: order.seeker_id?.toString?.() || "",
    provider_id: order.provider_id?.toString?.() || "",
  };
}

/* ------------------------------------------------------------------ */
/*  Per-socket rate limiting                                           */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_JOINS = 20;

/**
 * Returns `true` if the socket has exceeded the join-event rate limit.
 * Tracks timestamps on `socket.data._joinTimestamps`.
 * @param {import('socket.io').Socket} socket
 * @returns {boolean}
 */
function isRateLimited(socket) {
  const now = Date.now();
  if (!socket.data._joinTimestamps) {
    socket.data._joinTimestamps = [];
  }

  // Prune old timestamps outside the window.
  socket.data._joinTimestamps = socket.data._joinTimestamps.filter(
    /** @param {number} ts */ (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );

  if (socket.data._joinTimestamps.length >= RATE_LIMIT_MAX_JOINS) {
    return true;
  }

  socket.data._joinTimestamps.push(now);
  return false;
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */

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

  /* ---------- Auth middleware ---------- */

  io.use(async (socket, nextMiddleware) => {
    try {
      const token = await getRequestAuthToken(socket.request);

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

  /* ---------- Connection handler ---------- */

  io.on("connection", (socket) => {
    const userId = socket.data.user?._id || "unknown";

    /* ---- Order room join ---- */
    socket.on(
      realtimeContracts.CLIENT_EVENTS.ORDER_JOIN,
      async (payload, acknowledge) => {
        if (isRateLimited(socket)) {
          acknowledge?.({ ok: false, error: "rate_limited" });
          return;
        }

        const result = await authorizeOrderRoom(
          {
            orderId: payload?.orderId,
            user: socket.data.user,
          },
          { findOrderById },
        );

        if (!result.ok) {
          acknowledge?.(result);
          return;
        }

        await socket.join(result.room);
        acknowledge?.(result);
      },
    );

    /* ---- Complaint room join ---- */
    socket.on(
      realtimeContracts.CLIENT_EVENTS.COMPLAINT_JOIN,
      async (payload, acknowledge) => {
        if (isRateLimited(socket)) {
          acknowledge?.({ ok: false, error: "rate_limited" });
          return;
        }

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

    /* ---- Room leave ---- */
    socket.on(realtimeContracts.CLIENT_EVENTS.ROOM_LEAVE, async (payload) => {
      if (
        typeof payload?.room !== "string" ||
        payload.room.trim().length === 0
      ) {
        return;
      }

      await socket.leave(payload.room);
    });

    /* ---- Typing indicator relay ---- */
    socket.on(realtimeContracts.CLIENT_EVENTS.TYPING_START, (payload) => {
      if (typeof payload?.room !== "string" || !payload.room) return;
      socket
        .to(payload.room)
        .emit(realtimeContracts.SERVER_EVENTS.TYPING_START, {
          userId,
          userName: socket.data.user?.name || "Someone",
          room: payload.room,
        });
    });

    socket.on(realtimeContracts.CLIENT_EVENTS.TYPING_STOP, (payload) => {
      if (typeof payload?.room !== "string" || !payload.room) return;
      socket
        .to(payload.room)
        .emit(realtimeContracts.SERVER_EVENTS.TYPING_STOP, {
          userId,
          room: payload.room,
        });
    });

    /* ---- Disconnect logging ---- */
    socket.on("disconnect", (reason) => {
      if (dev) {
        console.log(`[socket.io] User ${userId} disconnected: ${reason}`);
      }
    });
  });

  httpServer.listen(port, process.env.HOST, () => {
    console.log(`> Ready on http://${hostname}:${port}`);

    // Start local cron jobs
    if (!process.env.VERCEL) {
      try {
        const { startLocalCron } = require("./lib/local-cron");
        startLocalCron(port);
      } catch (err) {
        console.error("Failed to initialize local cron:", err);
      }
    }
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start custom server", error);
  process.exit(1);
});
