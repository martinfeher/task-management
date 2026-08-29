/**
 * Dry-run verification: converts every existing Task.details (and
 * TaskVersion.details) HTML value to a TaskDoc, validates it against the
 * closed schema, round-trips it back to HTML, and reports any tasks where
 * the plain-text content changed — a signal that the conversion lost or
 * altered visible text and needs manual review before backfilling.
 *
 * This script performs NO writes. Safe to run repeatedly.
 *
 * Usage: npx tsx scripts/verify-details-doc-conversion.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { taskDetailsToPlainText } from "../lib/task-details-content";
import { docToPlainText, htmlToDoc, validateTaskDoc } from "../lib/task-document";

function normalizeForCompare(text: string) {
  // The legacy `taskDetailsToPlainText()` never decodes the literal `&nbsp;`
  // HTML entity (only real `\u00a0` chars), so old plain-text can contain the
  // raw 6-character string "&nbsp;". A real HTML parser (used by the new
  // converter) decodes it correctly into a space. Treat both as equivalent
  // here so this known legacy quirk isn't reported as a false regression.
  return text.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

async function verifyRows(
  label: string,
  rows: { id: string; details: string }[],
) {
  let ok = 0;
  let mismatched = 0;
  let errored = 0;
  const mismatches: { id: string; before: string; after: string }[] = [];
  const errors: { id: string; message: string }[] = [];

  for (const row of rows) {
    try {
      const doc = htmlToDoc(row.details);
      validateTaskDoc(doc); // throws on any schema violation

      const before = normalizeForCompare(taskDetailsToPlainText(row.details));
      const after = normalizeForCompare(docToPlainText(doc));

      if (before === after) {
        ok += 1;
      } else {
        mismatched += 1;
        mismatches.push({ id: row.id, before, after });
      }
    } catch (error) {
      errored += 1;
      errors.push({ id: row.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(`\n=== ${label} ===`);
  console.log(`total: ${rows.length}  ok: ${ok}  text-mismatch: ${mismatched}  errors: ${errored}`);

  if (mismatches.length > 0) {
    console.log("\n--- plain-text mismatches (review before backfill) ---");
    for (const m of mismatches.slice(0, 20)) {
      console.log(`\n[${m.id}]`);
      console.log(`  before: ${m.before.slice(0, 200)}`);
      console.log(`  after:  ${m.after.slice(0, 200)}`);
    }
    if (mismatches.length > 20) console.log(`  ...and ${mismatches.length - 20} more`);
  }

  if (errors.length > 0) {
    console.log("\n--- conversion/validation errors ---");
    for (const e of errors.slice(0, 20)) {
      console.log(`[${e.id}] ${e.message}`);
    }
  }

  return { ok, mismatched, errored };
}

async function main() {
  const tasks = await prisma.task.findMany({
    where: { details: { not: "" } },
    select: { id: true, details: true },
  });

  const versions = await prisma.taskVersion.findMany({
    where: { details: { not: "" } },
    select: { id: true, details: true },
  });

  const taskResult = await verifyRows("Task.details", tasks);
  const versionResult = await verifyRows("TaskVersion.details", versions);

  console.log("\n=== summary ===");
  console.log(
    `Task: ${taskResult.ok}/${tasks.length} clean, TaskVersion: ${versionResult.ok}/${versions.length} clean`,
  );

  const hasProblems = taskResult.mismatched + taskResult.errored + versionResult.mismatched + versionResult.errored > 0;
  process.exit(hasProblems ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("Verification script failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
