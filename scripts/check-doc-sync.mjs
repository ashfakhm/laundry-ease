import { execFileSync } from "node:child_process";

const HIGH_IMPACT_PATTERNS = [
  /^app\/api\//,
  /^lib\//,
  /^types\//,
  /^next\.config\.ts$/,
  /^playwright\.config\.ts$/,
  /^package\.json$/,
  /^package-lock\.json$/,
];

const DOC_SYNC_PATTERNS = [
  /^README\.md$/,
  /^docs\/PRD\.md$/,
  /^docs\/PRESENTATION_HELPER\.md$/,
  /^docs\/HONEST_ASSESSMENT\.md$/,
  /^docs\/PRODUCTION_READINESS_REVIEW\.md$/,
  /^docs\/OPERATIONS_RUNBOOK\.md$/,
];

const REQUIRED_DOC_PATHS = [
  "README.md",
  "docs/PRD.md",
  "docs/PRESENTATION_HELPER.md",
  "docs/HONEST_ASSESSMENT.md",
  "docs/PRODUCTION_READINESS_REVIEW.md",
  "docs/OPERATIONS_RUNBOOK.md",
];

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

if (process.env.DOCS_SYNC_BYPASS === "1") {
  console.log("Docs sync check bypassed via DOCS_SYNC_BYPASS=1.");
  process.exit(0);
}

const diffRange = process.env.DOCS_SYNC_DIFF_RANGE?.trim() || null;
const diffDescriptor = diffRange ?? "HEAD (working tree)";

let changedFilesOutput = "";
try {
  const diffArgs = ["diff", "--name-only", "--diff-filter=ACMR"];
  if (diffRange) {
    diffArgs.push(diffRange);
  } else {
    diffArgs.push("HEAD");
  }
  changedFilesOutput = runGit(diffArgs);
} catch (error) {
  console.error(`Unable to inspect changed files for range: ${diffDescriptor}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const changedFiles = changedFilesOutput
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean);

if (changedFiles.length === 0) {
  console.log(`Docs sync check passed: no changed files in ${diffDescriptor}.`);
  process.exit(0);
}

const highImpactChanges = changedFiles.filter((file) =>
  HIGH_IMPACT_PATTERNS.some((pattern) => pattern.test(file)),
);

if (highImpactChanges.length === 0) {
  console.log("Docs sync check passed: no high-impact code changes detected.");
  process.exit(0);
}

const docsUpdates = changedFiles.filter((file) =>
  DOC_SYNC_PATTERNS.some((pattern) => pattern.test(file)),
);

if (docsUpdates.length > 0) {
  console.log(
    `Docs sync check passed: high-impact code changes include documentation updates (${docsUpdates.join(", ")}).`,
  );
  process.exit(0);
}

console.error(
  "Docs sync check failed: high-impact code changed without required docs update.",
);
console.error("High-impact files:");
for (const file of highImpactChanges) {
  console.error(`  - ${file}`);
}

console.error("Update at least one of:");
for (const docPath of REQUIRED_DOC_PATHS) {
  console.error(`  - ${docPath}`);
}

console.error(
  "If this is intentionally docs-neutral, set DOCS_SYNC_BYPASS=1 for that run.",
);
process.exit(1);
