/**
 * Backfills `detailsDoc` / `detailsText` / `schemaVersion` for every existing
 * Task and TaskVersion row from the legacy `details` HTML column.
 *
 * Idempotent: rows whose `detailsDoc` is already set are skipped, so this can
 * be re-run safely (e.g. after fixing a conversion edge case).
 *
 * The legacy `details` HTML column is left untouched — this is purely
 * additive. Nothing reads `detailsDoc` yet, so this is safe to run against
 * production data ahead of any API/UI changes.
 *
 * Usage:
 *   npx tsx scripts/backfill-details-doc.ts --dry-run   (report only, no writes)
 *   npx tsx scripts/backfill-details-doc.ts             (apply)
 *   npx tsx scripts/backfill-details-doc.ts --force     (re-convert rows that already have detailsDoc)
 */
import "dotenv/config";
import { Prisma } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";
import { CURRENT_SCHEMA_VERSION, docToPlainText, htmlToDoc, validateTaskDoc } from "../lib/task-document";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isForce = args.includes("--force");

async function backfillTasks() {
  const where = isForce ? {} : { detailsDoc: { equals: Prisma.DbNull } };
  const tasks = await prisma.task.findMany({
    where,
    select: { id: true, name: true, details: true },
  });

  console.log(`\n=== Task backfill (${isDryRun ? "dry run" : "apply"}) ===`);
  console.log(`${tasks.length} row(s) to process`);

  let updated = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      const doc = htmlToDoc(task.details);
      validateTaskDoc(doc);
      const plainText = docToPlainText(doc);

      if (!isDryRun) {
        await prisma.task.update({
          where: { id: task.id },
          data: {
            detailsDoc: doc,
            detailsText: plainText,
            schemaVersion: CURRENT_SCHEMA_VERSION,
          },
        });
      }
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  [${task.id}] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`Task: ${updated} converted, ${failed} failed`);
  return { updated, failed };
}

async function backfillTaskVersions() {
  const where = isForce ? {} : { detailsDoc: { equals: Prisma.DbNull } };
  const versions = await prisma.taskVersion.findMany({
    where,
    select: { id: true, name: true, details: true },
  });

  console.log(`\n=== TaskVersion backfill (${isDryRun ? "dry run" : "apply"}) ===`);
  console.log(`${versions.length} row(s) to process`);

  let updated = 0;
  let failed = 0;

  for (const version of versions) {
    try {
      const doc = htmlToDoc(version.details);
      validateTaskDoc(doc);

      if (!isDryRun) {
        await prisma.taskVersion.update({
          where: { id: version.id },
          data: { detailsDoc: doc },
        });
      }
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(`  [${version.id}] FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`TaskVersion: ${updated} converted, ${failed} failed`);
  return { updated, failed };
}

async function main() {
  if (isDryRun) console.log("Running in DRY-RUN mode — no writes will be made.");

  const taskResult = await backfillTasks();
  const versionResult = await backfillTaskVersions();

  const totalFailed = taskResult.failed + versionResult.failed;
  console.log(`\n=== done ===`);
  console.log(
    `Tasks: ${taskResult.updated} ok / ${taskResult.failed} failed. Versions: ${versionResult.updated} ok / ${versionResult.failed} failed.`,
  );

  process.exit(totalFailed > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("Backfill script failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
