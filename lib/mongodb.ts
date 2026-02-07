import { MongoClient } from "mongodb";
import { env } from "./env";
import { ensureDbIndexes } from "./db-indexes";

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
  var _mongoIndexInitPromise: Promise<void> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise(): Promise<MongoClient> {
  const client = new MongoClient(env.MONGODB_URI);
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise)
      global._mongoClientPromise = client.connect();
    return global._mongoClientPromise as Promise<MongoClient>;
  }
  return client.connect();
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
