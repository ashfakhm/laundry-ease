import dns from "node:dns";
import { MongoClient, type MongoClientOptions } from "mongodb";
import { env } from "./env";
import { ensureDbIndexes } from "./db-indexes";

// Force public DNS servers for SRV record resolution.
// Some ISPs/networks/firewalls block or don't support SRV DNS queries,
// causing `querySrv ECONNREFUSED` with mongodb+srv:// URIs.
// Google & Cloudflare public DNS reliably resolve SRV records.
if (process.env.MONGODB_URI?.startsWith("mongodb+srv://")) {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4", "1.0.0.1"]);
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexInitPromise: Promise<void> | undefined;
}

const clientOptions: MongoClientOptions = {
  // Fail fast instead of hanging for 30s (default) when DB is unreachable.
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI, clientOptions);

  const connectPromise = client.connect().catch((err) => {
    // Log the real error so devs can see it in the terminal.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      "\n\x1b[31m╔══════════════════════════════════════════════════════════╗\x1b[0m",
    );
    console.error(
      "\x1b[31m║           MongoDB Connection Failed                      ║\x1b[0m",
    );
    console.error(
      "\x1b[31m╚══════════════════════════════════════════════════════════╝\x1b[0m\n",
    );
    console.error(`  Error: ${msg}\n`);

    if (msg.includes("querySrv") || msg.includes("ECONNREFUSED")) {
      console.error(
        "  Likely cause: DNS SRV lookup failed or connection refused.",
      );
      console.error("  Fixes to try:");
      console.error("    1. Check your internet connection");
      console.error("    2. Add your IP to MongoDB Atlas Network Access:");
      console.error("       Atlas → Network Access → Add Current IP Address");
      console.error("       (or add 0.0.0.0/0 for development only)");
      console.error(
        "    3. Try using the non-SRV connection string (mongodb://)",
      );
    } else if (msg.includes("authentication") || msg.includes("auth")) {
      console.error("  Likely cause: Invalid MongoDB credentials.");
      console.error(
        "  Fix: Check MONGODB_URI username/password in your .env file.",
      );
    } else if (msg.includes("timed out") || msg.includes("timeout")) {
      console.error("  Likely cause: Network cannot reach MongoDB Atlas.");
      console.error("  Fixes to try:");
      console.error("    1. Add your IP to MongoDB Atlas Network Access");
      console.error(
        "    2. Check if a firewall/VPN is blocking the connection",
      );
      console.error("    3. Try a different network (e.g. mobile hotspot)");
    } else {
      console.error("  Fixes to try:");
      console.error("    1. Verify MONGODB_URI in your .env is correct");
      console.error("    2. Add your IP to Atlas Network Access");
      console.error("    3. Check your internet connection");
    }
    console.error("");

    // Reset the cached promise so the next request retries instead of
    // returning the same failed promise forever.
    clientPromise = undefined;
    if (process.env.NODE_ENV === "development") {
      global._mongoClientPromise = undefined;
    }

    throw err;
  });

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = connectPromise;
    }
    return global._mongoClientPromise as Promise<MongoClient>;
  }

  return connectPromise;
}

export async function getDb() {
  if (!clientPromise) clientPromise = createClientPromise();
  const client = await clientPromise;
  const db = client.db(env.MONGODB_DB);

  if (!global._mongoIndexInitPromise) {
    global._mongoIndexInitPromise = ensureDbIndexes(db);
  }

  await global._mongoIndexInitPromise;
  return { db, client };
}
