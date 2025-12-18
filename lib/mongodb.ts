import { MongoClient } from "mongodb";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
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
  return { db: client.db(env.MONGODB_DB), client };
}
