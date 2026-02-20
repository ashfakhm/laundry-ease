import { ClientSession, TransactionOptions } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logger } from "@/lib/logger";

/**
 * Executes a function within a MongoDB transaction.
 * Handles session lifecycle (start, commit/abort via driver helper, end) and error logging.
 *
 * @param fn - The function to execute. Receives the session to pass to DB operations.
 * @param options - Optional transaction options.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  const { client } = await getDb();
  const session = client.startSession();

  try {
    let result: T | undefined;

    // The driver's withTransaction handles retries for TransientTransactionError
    // and UnknownTransactionCommitResult.
    await session.withTransaction(async (session) => {
      result = await fn(session);
      return result;
    }, options);

    return result as T;
  } catch (error) {
    // Log error but generally rethrow so the caller knows it failed
    logger.error("DB", "Transaction failed", error);
    throw error;
  } finally {
    await session.endSession();
  }
}
