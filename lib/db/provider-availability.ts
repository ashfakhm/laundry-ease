import { type Db, ObjectId } from "mongodb";
import type { Provider, ProviderLeavePeriod } from "@/types/users";

export async function getProviderLeavePeriods(
  db: Db,
  providerId: ObjectId,
): Promise<ProviderLeavePeriod[]> {
  const provider = await db.collection<Provider>("providers").findOne(
    { _id: providerId },
    { projection: { leavePeriods: 1 } },
  );

  return (provider?.leavePeriods as ProviderLeavePeriod[] | undefined) ?? [];
}

export async function createProviderLeavePeriod(args: {
  db: Db;
  providerId: ObjectId;
  leavePeriod: ProviderLeavePeriod;
}): Promise<{
  created: boolean;
  overlapRejected: boolean;
  providerMissing: boolean;
}> {
  const { db, providerId, leavePeriod } = args;
  const now = new Date();

  const result = await db.collection<Provider>("providers").updateOne(
    {
      _id: providerId,
      $or: [
        { leavePeriods: { $exists: false } },
        {
          leavePeriods: {
            $not: {
              $elemMatch: {
                startDate: { $lte: leavePeriod.endDate },
                endDate: { $gte: leavePeriod.startDate },
              },
            },
          },
        },
      ],
    },
    {
      $push: {
        leavePeriods: leavePeriod,
      },
      $set: {
        updatedAt: now,
      },
    },
  );

  if (result.modifiedCount > 0) {
    return {
      created: true,
      overlapRejected: false,
      providerMissing: false,
    };
  }

  const provider = await db
    .collection<Provider>("providers")
    .findOne({ _id: providerId }, { projection: { _id: 1 } });

  return {
    created: false,
    overlapRejected: Boolean(provider),
    providerMissing: !provider,
  };
}

export async function deleteProviderLeavePeriod(args: {
  db: Db;
  providerId: ObjectId;
  leaveId: ObjectId;
}): Promise<boolean> {
  const { db, providerId, leaveId } = args;

  const result = await db.collection<Provider>("providers").updateOne(
    { _id: providerId },
    {
      $pull: {
        leavePeriods: { _id: leaveId },
      },
      $set: {
        updatedAt: new Date(),
      },
    },
  );

  return result.modifiedCount > 0;
}
