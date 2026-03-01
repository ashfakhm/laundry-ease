import { spawnSync } from "node:child_process";

const SMOKE_SPECS = [
  "e2e/smoke-role-journeys.spec.ts",
  "e2e/complaint-chat-journey.spec.ts",
  "e2e/settlement-chain-journey.spec.ts",
  "e2e/booking-lifecycle-journey.spec.ts",
  "e2e/booking-negative-journeys.spec.ts",
];

const shouldSkipE2E = process.argv.includes("--skip-e2e");

const steps = [
  ["Typecheck", "npm", ["run", "typecheck"]],
  ["Lint", "npm", ["run", "lint"]],
  ["Unit and Integration Tests", "npm", ["test"]],
  ["Build", "npm", ["run", "build"]],
];

if (!shouldSkipE2E) {
  steps.push([
    "Smoke E2E",
    "npm",
    ["run", "test:e2e", "--", "--workers=1", ...SMOKE_SPECS],
  ]);
}

for (const [name, command, args] of steps) {
  console.log(`\n==> ${name}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n${name} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nAll configured quality gates passed.");
