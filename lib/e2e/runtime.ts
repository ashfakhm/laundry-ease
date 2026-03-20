import { env } from "@/lib/env";

export type E2ERuntimeProbe = {
  safeForSmokeReuse: boolean;
  e2eFakePayments: boolean;
  razorpayxConfigured: boolean;
  nodeEnv: string;
};

type E2ERuntimeProbeInput = {
  nodeEnv?: string;
  e2eTestRun?: string;
  e2eFakePayments?: string;
  razorpayxAccountNumber?: string;
};

export function isE2ERuntimeProbeVisible(
  input: Pick<E2ERuntimeProbeInput, "nodeEnv" | "e2eTestRun"> = {},
): boolean {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const e2eTestRun = input.e2eTestRun ?? process.env.E2E_TEST_RUN ?? "0";

  return nodeEnv !== "production" || e2eTestRun === "1";
}

export function getE2ERuntimeProbe(
  input: E2ERuntimeProbeInput = {},
): E2ERuntimeProbe {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const e2eFakePayments =
    (input.e2eFakePayments ?? env.E2E_FAKE_PAYMENTS) === "1";
  const razorpayxConfigured = Boolean(
    (input.razorpayxAccountNumber ?? env.RAZORPAYX_ACCOUNT_NUMBER ?? "").trim(),
  );

  return {
    safeForSmokeReuse:
      isE2ERuntimeProbeVisible({
        nodeEnv,
        e2eTestRun: input.e2eTestRun,
      }) && e2eFakePayments,
    e2eFakePayments,
    razorpayxConfigured,
    nodeEnv,
  };
}
