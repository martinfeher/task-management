/**
 * Claims pre-multi-user data (rows with `userId = NULL`, left over from
 * before the Better Auth migration) for a single "owner" account.
 *
 * Usage:
 *   1. Set LEGACY_OWNER_EMAIL in `.env` to the email you'll sign in with.
 *   2. Sign in once with Google using that exact email, so a `User` row
 *      exists (this also auto-seeds a starter "My tasks" list + priority
 *      tags for the new account — see the note printed at the end).
 *   3. Run: npm run claim:legacy-data
 *      (or: npm run claim:legacy-data -- --dry-run   to preview only)
 *
 * Safety properties:
 *   - Never deletes app data (lists/folders/tasks/tags). It only ever
 *     reassigns `userId` on rows that currently have `userId IS NULL`.
 *   - The only rows this script ever *deletes* are exact duplicates it
 *     itself creates by claiming into an account that already has a
 *     same-key setting or same-slug tag (see claimAppSettings /
 *     claimSingletonSettings / dedupeTagsForUser below) — and even then,
 *     the duplicate's *value* is preserved by copying it onto the
 *     surviving row before the duplicate is removed.
 *   - Idempotent: once a row's `userId` is set, it's no longer a
 *     candidate, so re-running after a successful claim is a safe no-op.
 *   - `--dry-run` runs the exact same logic inside a transaction that is
 *     always rolled back, so you can preview counts with zero risk.
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/app/generated/prisma/client";

type Tx = Omit<PrismaClient, "$transaction" | "$connect" | "$disconnect" | "$on" | "$use" | "$extends">;

const SINGLETON_SETTINGS_MODELS = [
  {
    name: "SidebarTemplateSetting",
    model: "sidebarTemplateSetting" as const,
    fields: ["backgroundId", "baseColor"] as const,
  },
  {
    name: "TaskListTemplateSetting",
    model: "taskListTemplateSetting" as const,
    fields: ["backgroundId", "baseColor"] as const,
  },
  {
    name: "CalendarTaskTemplateSetting",
    model: "calendarTaskTemplateSetting" as const,
    fields: [
      "backgroundId",
      "baseColor",
      "endColor",
      "titleColor",
      "timeColor",
    ] as const,
  },
  {
    name: "TooltipTemplateSetting",
    model: "tooltipTemplateSetting" as const,
    fields: ["backgroundColor", "textColor", "cornerRadiusPx"] as const,
  },
];

class DryRunAbort extends Error {}

async function claimAppSettings(tx: Tx, userId: string) {
  const legacyRows = await tx.appSetting.findMany({ where: { userId: null } });
  let claimed = 0;
  let mergedIntoExisting = 0;

  for (const row of legacyRows) {
    const existing = await tx.appSetting.findUnique({
      where: { userId_key: { userId, key: row.key } },
    });

    if (existing) {
      // The signed-in owner already has their own row for this key
      // (created by using the app post-login, before this script ran).
      // Preserve the legacy value by copying it onto the surviving row,
      // then remove the now-redundant legacy row.
      await tx.appSetting.update({
        where: { id: existing.id },
        data: { value: row.value },
      });
      await tx.appSetting.delete({ where: { id: row.id } });
      mergedIntoExisting += 1;
    } else {
      await tx.appSetting.update({
        where: { id: row.id },
        data: { userId },
      });
      claimed += 1;
    }
  }

  return { claimed, mergedIntoExisting };
}

async function claimSingletonSettings(tx: Tx, userId: string) {
  const results: Record<string, { claimed: boolean; mergedIntoExisting: boolean }> = {};

  for (const { name, model, fields } of SINGLETON_SETTINGS_MODELS) {
    const delegate = tx[model] as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<unknown>;
      delete: (args: unknown) => Promise<unknown>;
    };

    const legacyRow = await delegate.findFirst({ where: { userId: null } });
    if (!legacyRow) {
      results[name] = { claimed: false, mergedIntoExisting: false };
      continue;
    }

    const existing = await delegate.findUnique({ where: { userId } });

    if (existing) {
      // Owner already has their own (likely still-default) row for this
      // setting. Preserve the legacy customization by copying its field
      // values onto the surviving row, then drop the legacy duplicate.
      const data: Record<string, unknown> = {};
      for (const field of fields) {
        data[field] = (legacyRow as Record<string, unknown>)[field];
      }
      await delegate.update({ where: { id: (existing as { id: string }).id }, data });
      await delegate.delete({ where: { id: (legacyRow as { id: string }).id } });
      results[name] = { claimed: false, mergedIntoExisting: true };
    } else {
      await delegate.update({
        where: { id: (legacyRow as { id: string }).id },
        data: { userId },
      });
      results[name] = { claimed: true, mergedIntoExisting: false };
    }
  }

  return results;
}

/**
 * After claiming, a user can end up with duplicate Tag rows sharing the
 * same (userId, slug, category) — e.g. the priority tags auto-seeded on
 * first sign-in (`ensurePriorityTags`) collide with the claimed legacy
 * priority tags. Merge duplicates into the oldest row, reattaching any
 * TaskTag references first so no task loses its label/priority.
 */
async function dedupeTagsForUser(tx: Tx, userId: string) {
  const tags = await tx.tag.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, category: true },
  });

  const groups = new Map<string, typeof tags>();
  for (const tag of tags) {
    const key = `${tag.category}::${tag.slug}`;
    const group = groups.get(key);
    if (group) {
      group.push(tag);
    } else {
      groups.set(key, [tag]);
    }
  }

  let mergedDuplicates = 0;

  for (const group of groups.values()) {
    if (group.length <= 1) continue;

    const [canonical, ...duplicates] = group;
    for (const duplicate of duplicates) {
      const links = await tx.taskTag.findMany({ where: { tagId: duplicate.id } });
      if (links.length > 0) {
        await tx.taskTag.createMany({
          data: links.map((link) => ({ taskId: link.taskId, tagId: canonical.id })),
          skipDuplicates: true,
        });
        await tx.taskTag.deleteMany({ where: { tagId: duplicate.id } });
      }
      await tx.tag.delete({ where: { id: duplicate.id } });
      mergedDuplicates += 1;
    }
  }

  return { mergedDuplicates, priorityTagGroups: groups.size };
}

async function assertNoRemainingLegacyRows(tx: Tx) {
  const [folders, lists, tasks, tags, appSettings, templateStyles] = await Promise.all([
    tx.listFolder.count({ where: { userId: null } }),
    tx.todoList.count({ where: { userId: null } }),
    tx.task.count({ where: { userId: null } }),
    tx.tag.count({ where: { userId: null } }),
    tx.appSetting.count({ where: { userId: null } }),
    tx.templateStyle.count({ where: { userId: null } }),
  ]);

  const singletonCounts = await Promise.all(
    SINGLETON_SETTINGS_MODELS.map(({ model }) =>
      (tx[model] as unknown as { count: (args: unknown) => Promise<number> }).count({
        where: { userId: null },
      }),
    ),
  );

  const remaining =
    folders + lists + tasks + tags + appSettings + templateStyles + singletonCounts.reduce((a, b) => a + b, 0);

  if (remaining > 0) {
    throw new Error(
      `${remaining} row(s) still have userId = NULL after claiming. Aborting the ` +
        "transaction so no partial claim is committed — this likely means a new " +
        "table with a nullable userId was added and this script needs updating.",
    );
  }
}

async function runClaim(tx: Tx, userId: string) {
  const [folders, lists, tasks, tags, templateStyles] = await Promise.all([
    tx.listFolder.updateMany({ where: { userId: null }, data: { userId } }),
    tx.todoList.updateMany({ where: { userId: null }, data: { userId } }),
    tx.task.updateMany({ where: { userId: null }, data: { userId } }),
    tx.tag.updateMany({ where: { userId: null }, data: { userId } }),
    tx.templateStyle.updateMany({ where: { userId: null }, data: { userId } }),
  ]);

  const appSettings = await claimAppSettings(tx, userId);
  const singletons = await claimSingletonSettings(tx, userId);
  const tagDedupe = await dedupeTagsForUser(tx, userId);

  await assertNoRemainingLegacyRows(tx);

  return {
    folders: folders.count,
    lists: lists.count,
    tasks: tasks.count,
    tags: tags.count,
    templateStyles: templateStyles.count,
    appSettings,
    singletons,
    tagDedupe,
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const ownerEmail = process.env.LEGACY_OWNER_EMAIL?.trim();
  if (!ownerEmail) {
    throw new Error(
      "LEGACY_OWNER_EMAIL is not set. Add it to .env (the email you'll sign " +
        "in with via Google), sign in once, then re-run this script.",
    );
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    throw new Error(
      `No user found with email "${ownerEmail}". Sign in with Google using ` +
        "that exact email first (this creates the User row), then re-run this script.",
    );
  }

  console.log(`${dryRun ? "[DRY RUN] " : ""}Claiming legacy data for ${owner.email} (userId=${owner.id})...`);

  let summary: Awaited<ReturnType<typeof runClaim>> | undefined;

  try {
    await prisma.$transaction(async (tx) => {
      summary = await runClaim(tx as unknown as Tx, owner.id);
      if (dryRun) {
        // Force a rollback so a dry run never persists anything, even
        // though every read above already reflects the would-be result.
        throw new DryRunAbort();
      }
    });
  } catch (error) {
    if (!(error instanceof DryRunAbort)) {
      throw error;
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  console.log(
    dryRun
      ? "\nDry run complete — nothing was changed. Re-run without --dry-run to apply."
      : "\nClaim complete.",
  );
  console.log(
    "\nNote: signing in auto-seeds a starter \"My tasks\" list (with 2 sample " +
      "tasks) and default priority tags for a brand-new account. If you " +
      "claimed data onto an account that had already signed in before this " +
      "script ran, check your sidebar for that extra starter list and " +
      "delete it manually if you don't want it — this script intentionally " +
      "never deletes list/task data, only settings/tag duplicates it itself created.",
  );
}

main()
  .catch((error) => {
    console.error("Claim failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
