import { afterEach, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { ensureDbIndexes } from "./db-indexes";

function makeDb(failingIndexNames: Set<string>): Db {
  return {
    collection() {
      return {
        async createIndex(
          _keys: Record<string, unknown>,
          options?: { name?: string },
        ) {
          const name = String(options?.name || "unnamed");
          if (failingIndexNames.has(name)) {
            throw new Error(`Failed index: ${name}`);
          }
          return name;
        },
      };
    },
  } as unknown as Db;
}

const originalNodeEnv = process.env.NODE_ENV;
const originalAllowStartWithIndexErrors = process.env.ALLOW_START_WITH_INDEX_ERRORS;
const mutableEnv = process.env as Record<string, string | undefined>;

afterEach(() => {
  mutableEnv.NODE_ENV = originalNodeEnv;
  if (originalAllowStartWithIndexErrors === undefined) {
    delete mutableEnv.ALLOW_START_WITH_INDEX_ERRORS;
  } else {
    mutableEnv.ALLOW_START_WITH_INDEX_ERRORS = originalAllowStartWithIndexErrors;
  }
});

describe("ensureDbIndexes", () => {
  it("fails fast in production when a critical index cannot be created", async () => {
    mutableEnv.NODE_ENV = "production";
    delete mutableEnv.ALLOW_START_WITH_INDEX_ERRORS;

    const db = makeDb(new Set(["orders_booking_id_unique"]));

    await expect(ensureDbIndexes(db)).rejects.toThrow(
      /Critical database index initialization failed/,
    );
  });

  it("allows startup when override is set even if critical index fails", async () => {
    mutableEnv.NODE_ENV = "production";
    mutableEnv.ALLOW_START_WITH_INDEX_ERRORS = "1";

    const db = makeDb(new Set(["orders_booking_id_unique"]));

    await expect(ensureDbIndexes(db)).resolves.toBeUndefined();
  });

  it("does not fail startup for non-critical index failures", async () => {
    mutableEnv.NODE_ENV = "production";
    delete mutableEnv.ALLOW_START_WITH_INDEX_ERRORS;

    const db = makeDb(new Set(["bookings_provider_status_createdAt"]));

    await expect(ensureDbIndexes(db)).resolves.toBeUndefined();
  });
});
