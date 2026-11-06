/**
 * Quick check for legacy (unclaimed) rows vs your signed-in user.
 *
 * `LEGACY_OWNER_EMAIL` in `.env` is only used when you run
 * `npm run claim:legacy-data` — setting it does not move data by itself.
 *
 * Usage: npm run diagnose:legacy-data
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

function redactDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  console.log("DATABASE_URL:", dbUrl ? redactDatabaseUrl(dbUrl) : "(not set)");

  const ownerEmail = process.env.LEGACY_OWNER_EMAIL?.trim();
  console.log(
    "LEGACY_OWNER_EMAIL:",
    ownerEmail ? `"${ownerEmail}"` : "(not set — optional for this script)",
  );

  const [
    users,
    tasksTotal,
    tasksLegacy,
    listsTotal,
    listsLegacy,
    foldersLegacy,
    tagsLegacy,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.count(),
    prisma.task.count({ where: { userId: null } }),
    prisma.todoList.count(),
    prisma.todoList.count({ where: { userId: null } }),
    prisma.listFolder.count({ where: { userId: null } }),
    prisma.tag.count({ where: { userId: null } }),
  ]);

  console.log("\nUsers in DB:", users.length);
  for (const u of users) {
    console.log(`  - ${u.email} (id=${u.id.slice(0, 8)}…)`);
  }

  if (ownerEmail) {
    const match = users.find((u) => u.email === ownerEmail);
    if (match) {
      const [ownedTasks, ownedLists] = await Promise.all([
        prisma.task.count({ where: { userId: match.id } }),
        prisma.todoList.count({ where: { userId: match.id } }),
      ]);
      console.log(
        `\nUser "${ownerEmail}": ${ownedLists} list(s), ${ownedTasks} task(s) with userId set.`,
      );
    } else {
      console.log(
        `\nNo User row with email "${ownerEmail}". Sign in with Google using that email first.`,
      );
    }
  }

  console.log("\n--- Legacy (userId IS NULL) — invisible after login until claimed ---");
  console.log(`  TodoList:     ${listsLegacy} / ${listsTotal} lists total`);
  console.log(`  ListFolder:   ${foldersLegacy}`);
  console.log(`  Task:         ${tasksLegacy} / ${tasksTotal} tasks total`);
  console.log(`  Tag:          ${tagsLegacy}`);

  if (tasksLegacy > 0 || listsLegacy > 0 || foldersLegacy > 0 || tagsLegacy > 0) {
    console.log(
      "\nNext step: set LEGACY_OWNER_EMAIL to the Google account email, then run:",
    );
    console.log("  npm run claim:legacy-data -- --dry-run");
    console.log("  npm run claim:legacy-data");
  } else if (tasksTotal === 0 && listsTotal === 0) {
    console.log(
      "\nDatabase looks empty for app tables. Check DATABASE_URL points at the DB that had your data.",
    );
  } else {
    console.log(
      "\nNo legacy rows left — everything already has a userId. If you still miss data, it may live under another User email or another database.",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
