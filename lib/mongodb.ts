import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient> | undefined;

function createClientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set in environment");
  const client = new MongoClient(uri);
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise)
      global._mongoClientPromise = client.connect();
    return global._mongoClientPromise as Promise<MongoClient>;
  }
  return client.connect();
}

export async function getDb() {
  if (!clientPromise) clientPromise = createClientPromise();
  const conn = await clientPromise;
  const dbName = process.env.MONGODB_DB || "laundryease";
  return conn.db(dbName);
}

export type Role = "seeker" | "provider";
