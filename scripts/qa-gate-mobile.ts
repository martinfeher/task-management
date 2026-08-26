/**
 * Week 2 mobile QA gate — full read/write/image/version/recurrence cycle.
 * Usage: npm run qa:gate:mobile -- http://localhost:3000
 */
import { spawnSync } from "node:child_process";

const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

function run(label: string, script: string) {
  console.log(`\n--- ${label} ---\n`);
  const result = spawnSync("npx", ["tsx", script, baseUrl], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed`);
  }
}

async function main() {
  console.log(`Mobile QA gate at ${baseUrl}`);
  run("REST API verification", "scripts/verify-mobile-api.ts");
  run("Web persistence gate", "scripts/qa-gate-web.ts");
  console.log("\nMobile QA gate passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
