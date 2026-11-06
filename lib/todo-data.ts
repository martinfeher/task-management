import { prisma } from "@/lib/prisma";
import {
  getLabelsFromTaskTags,
  getPriorityFromTaskTags,
  LABEL_CATEGORY,
  PRIORITY_TAG_CATEGORY,
  PRIORITY_TAGS,
} from "@/lib/task-tags";
import { normalizeDueTimeZone } from "@/lib/task-due-time";

/**
 * Creates this user's priority tags (high/medium/low, etc.) if they don't
 * already have them. Runs per-user (not globally) since `Tag.slug` is no
 * longer unique across users — each user gets their own set of rows.
 */
async function ensurePriorityTags(userId: string) {
  await prisma.$transaction(async (tx) => {
    for (const tag of PRIORITY_TAGS) {
      const existing = await tx.tag.findFirst({
        where: { userId, slug: tag.slug, category: PRIORITY_TAG_CATEGORY },
        select: { id: true },
      });

      if (existing) {
        await tx.tag.update({
          where: { id: existing.id },
          data: { label: tag.label, level: tag.level },
        });
      } else {
        await tx.tag.create({
          data: {
            slug: tag.slug,
            label: tag.label,
            category: PRIORITY_TAG_CATEGORY,
            level: tag.level,
            userId,
          },
        });
      }
    }
  });
}

/**
 * Creates a starter list and a couple of sample tasks for a brand-new user.
 * Runs once per user (when they have zero lists), not globally.
 */
async function seedDefaultListsForUser(userId: string) {
  const existingCount = await prisma.todoList.count({ where: { userId } });
  if (existingCount > 0) return;

  const list = await prisma.todoList.create({
    data: {
      name: "My tasks",
      userId,
      tasks: {
        create: [
          {
            name: "Welcome to your new list!",
            completed: false,
            details: "",
            position: 0,
            userId,
          },
          {
            name: "Click a task to add details, a due date, or a label",
            completed: false,
            details: "",
            position: 1,
            userId,
          },
        ],
      },
    },
  });

  return list;
}

export async function getTodoData(userId: string) {
  await seedDefaultListsForUser(userId);
  await ensurePriorityTags(userId);

  const detailFlags = await prisma.$queryRaw<Array<{ id: string; hasDetails: number }>>`
    SELECT
      id,
      CASE
        WHEN trim(details) = '' THEN 0
        WHEN trim(details) IN ('<br>', '<div><br></div>', '<p><br></p>') THEN 0
        ELSE 1
      END AS "hasDetails"
    FROM "Task"
    WHERE "userId" = ${userId}
  `;
  const hasDetailsByTaskId = Object.fromEntries(
    detailFlags.map((row) => [row.id, Boolean(row.hasDetails)]),
  );

  const [lists, folders] = await Promise.all([
    prisma.todoList.findMany({
      where: { userId },
      include: {
        kanbanColumns: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            listId: true,
            name: true,
            position: true,
          },
        },
        tasks: {
          where: { deletedAt: null, userId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            name: true,
            completed: true,
            dueDate: true,
            dueTimeMinutes: true,
            dueDurationMinutes: true,
            dueTimeZone: true,
            calendarColor: true,
            recurrenceRule: true,
            pinned: true,
            important: true,
            isNote: true,
            parentId: true,
            kanbanColumnId: true,
            tags: {
              include: { tag: true },
            },
          },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.listFolder.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, position: true },
    }),
  ]);

  return {
    folders,
    lists: lists.map(({ id, name, color, folderId, position, viewMode }) => ({
      id,
      name,
      color,
      folderId,
      position,
      viewMode: (viewMode === "kanban" ? "kanban" : "stack") as
        | "stack"
        | "kanban",
    })),
    kanbanColumnsByList: Object.fromEntries(
      lists.map((list) => [list.id, list.kanbanColumns]),
    ),
    labels: await prisma.tag.findMany({
      where: { category: LABEL_CATEGORY, userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, color: true },
    }),
    tasksByList: Object.fromEntries(
      lists.map((list) => [
        list.id,
        list.tasks.map(
          ({
            id,
            name,
            completed,
            dueDate,
            dueTimeMinutes,
            dueDurationMinutes,
            dueTimeZone,
            calendarColor,
            recurrenceRule,
            tags,
            pinned,
            important,
            isNote,
            parentId,
            kanbanColumnId,
          }) => ({
            id,
            name,
            completed,
            details: "",
            hasDetails: hasDetailsByTaskId[id] ?? false,
            dueDate: dueDate ? dueDate.toISOString() : null,
            dueTimeMinutes,
            dueDurationMinutes,
            dueTimeZone: normalizeDueTimeZone(dueTimeZone),
            calendarColor: calendarColor ?? null,
            recurrenceRule: recurrenceRule ?? null,
            priority: getPriorityFromTaskTags(tags),
            labels: getLabelsFromTaskTags(tags),
            pinned: Boolean(pinned),
            important: Boolean(important),
            isNote: Boolean(isNote),
            parentId: parentId ?? null,
            kanbanColumnId: kanbanColumnId ?? null,
          }),
        ),
      ]),
    ),
  };
}
