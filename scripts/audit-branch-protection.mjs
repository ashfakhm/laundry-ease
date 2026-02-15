#!/usr/bin/env node

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const branches = (process.env.BRANCH_PROTECTION_BRANCHES || "main,Mainv2")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requiredChecks = (
  process.env.BRANCH_PROTECTION_REQUIRED_CHECKS || "Lint, Test, Build, Smoke E2E"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!token) {
  fail("GITHUB_TOKEN is required for branch protection audit.");
}

if (!repository || !repository.includes("/")) {
  fail("GITHUB_REPOSITORY must be provided in owner/repo format.");
}

if (!branches.length) {
  fail("At least one branch must be configured for auditing.");
}

if (!requiredChecks.length) {
  fail("At least one required status check context must be configured.");
}

const [owner, repo] = repository.split("/");

async function fetchProtection(branch) {
  const url = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(
    branch
  )}/protection`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "laundryease-branch-protection-audit",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to read protection for ${branch}: HTTP ${response.status} ${body}`
    );
  }

  return response.json();
}

async function main() {
  let failed = false;

  for (const branch of branches) {
    try {
      const protection = await fetchProtection(branch);
      const contexts =
        protection?.required_status_checks?.contexts?.map((value) =>
          String(value).trim()
        ) || [];
      const missing = requiredChecks.filter(
        (check) => !contexts.includes(check)
      );

      if (missing.length) {
        failed = true;
        console.error(
          `[FAIL] ${branch} is missing required checks: ${missing.join(", ")}`
        );
        console.error(
          `       Configured checks on branch: ${contexts.join(", ") || "(none)"}`
        );
      } else {
        console.log(
          `[PASS] ${branch} enforces required checks: ${requiredChecks.join(", ")}`
        );
      }
    } catch (error) {
      failed = true;
      console.error(
        `[FAIL] Unable to audit ${branch}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log("Branch protection audit completed successfully.");
}

await main();
