import "server-only";
import {
  mergeReorderedPinnedTasks,
  mergeReorderedUnpinnedTasks,
} from "@/app/components/task-reorder";
import {
  convertNoteToTask,
  convertTaskToNote,
  createSubtask,
  createTask,
  deleteTask,
  moveTaskToList,
  toggleTask,
  updateTaskCalendarColor,
  updateTaskDueDate,
  updateTaskDueTime,
  updateTaskPriority,
} from "@/app/actions/todo";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  readTaskFieldClock,
  stampTaskFields,
  type TaskClockField,
} from "@/lib/task-field-clock";
import { normalizeDueTimeZone } from "@/lib/task-due-time";
import { getPriorityFromTaskTags, LABEL_CATEGORY } from "@/lib/task-tags";
import {
  persistTaskDetailsUpdate,
  persistTaskRename,
} from "@/lib/task-version-persistence";

/** Client clocks may run ahead; never let a stamp claim to be far in the future. */
const MAX_CLOCK_SKEW_MS = 60_000;
const LOCAL_ID_PREFIX = "local_";

export type SyncFieldChange = { value: unknown; at: number };

export type SyncMutationInput = {
  mutationId: string;
  kind: "create" | "update" | "delete" | "reorder";
  entityId: string;
  at: number;
  fields?: Record<string, SyncFieldChange>;
  reorder?: { listId: string; section: "pinned" | "tasks"; taskIds: string[] };
};

export type SyncTaskPayload = {
  id: string;
  name: string;
  isNote: boolean;
  completed: boolean;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  calendarColor: string | null;
  pinned: boolean;
  important: boolean;
  priority: number | null;
  parentId: string | null;
  depth: number;
  labels: { id: string; label: string; color: string | null }[];
  listId: string;
  listName: string;
  details: string;
  detailsDoc: unknown;
  schemaVersion: number;
  deletedAt: string | null;
  updatedAt: string;
};

export type SyncMutationResult = {
  mutationId: string;
  status: "applied" | "ignored" | "rejected";
  tempId?: string;
  id?: string;
  error?: string;
  task?: SyncTaskPayload | null;
};

type StoredResult = Omit<SyncMutationResult, "task">;

class SyncRejection extends Error {}

const syncTaskSelect = {
  id: true,
  name: true,
  isNote: true,
  completed: true,
  dueDate: true,
  dueTimeMinutes: true,
  dueDurationMinutes: true,
  dueTimeZone: true,
  calendarColor: true,
  pinned: true,
  important: true,
  parentId: true,
  listId: true,
  details: true,
  detailsDoc: true,
  schemaVersion: true,
  deletedAt: true,
  updatedAt: true,
  list: { select: { name: true } },
  tags: {
    include: {
      tag: { select: { id: true, label: true, color: true, category: true, level: true } },
    },
    orderBy: { tag: { label: "asc" } },
  },
} satisfies Prisma.TaskSelect;

type SyncTaskRecord = Prisma.TaskGetPayload<{ select: typeof syncTaskSelect }>;

function toSyncTask(task: SyncTaskRecord): SyncTaskPayload {
  return {
    id: task.id,
    name: task.name,
    isNote: task.isNote,
    completed: task.completed,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    calendarColor: task.calendarColor,
    pinned: task.pinned,
    important: task.important,
    priority: getPriorityFromTaskTags(task.tags),
    parentId: task.parentId,
    depth: task.parentId ? 1 : 0,
    labels: task.tags
      .filter((entry) => entry.tag.category === LABEL_CATEGORY)
      .map((entry) => ({ id: entry.tag.id, label: entry.tag.label, color: entry.tag.color })),
    listId: task.listId,
    listName: task.list.name,
    details: task.details,
    detailsDoc: task.detailsDoc ?? null,
    schemaVersion: task.schemaVersion,
    deletedAt: task.deletedAt ? task.deletedAt.toISOString() : null,
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function loadSyncTasks(where: Prisma.TaskWhereInput) {
  const tasks = await prisma.task.findMany({
    where,
    select: syncTaskSelect,
    orderBy: { updatedAt: "asc" },
  });
  return tasks.map(toSyncTask);
}

async function loadSyncTask(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: syncTaskSelect,
  });
  return task ? toSyncTask(task) : null;
}

function normalizeDateValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : undefined;
}

function isMinutesValue(value: unknown, min: number, max: number) {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max);
}

/** Field application order matters: a new due date clears the time, so time comes after date. */
const FIELD_ORDER: TaskClockField[] = [
  "listId",
  "name",
  "details",
  "isNote",
  "completed",
  "important",
  "pinned",
  "priority",
  "calendarColor",
  "dueDate",
  "dueTimeMinutes",
  "dueDurationMinutes",
  "labelIds",
];

/**
 * Applies the fields whose client timestamp is at least as new as the
 * server's per-field stamp, then stamps them with the client time.
 */
async function applyTaskFields(
  taskId: string,
  userId: string,
  fields: Record<string, SyncFieldChange>,
  clampAt: (at: number) => number,
  options?: { force?: boolean },
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: {
      id: true,
      completed: true,
      isNote: true,
      listId: true,
      deletedAt: true,
      fieldUpdatedAt: true,
      dueTimeMinutes: true,
      dueDurationMinutes: true,
      dueTimeZone: true,
    },
  });
  if (!task) throw new SyncRejection("Task not found");
  if (task.deletedAt) return { applied: false };

  const clock = readTaskFieldClock(task.fieldUpdatedAt);
  const winners = new Map<TaskClockField, SyncFieldChange>();
  for (const field of FIELD_ORDER) {
    const change = fields[field];
    if (!change || typeof change.at !== "number") continue;
    const at = clampAt(change.at);
    if (options?.force || at >= (clock[field] ?? 0)) {
      winners.set(field, { value: change.value, at });
    }
  }

  const appliedStamps = new Map<number, TaskClockField[]>();
  const markApplied = (field: TaskClockField, at: number) => {
    appliedStamps.set(at, [...(appliedStamps.get(at) ?? []), field]);
  };

  for (const [field, { value, at }] of winners) {
    switch (field) {
      case "listId": {
        if (typeof value !== "string" || !value) break;
        if (value !== task.listId) {
          const list = await prisma.todoList.findFirst({ where: { id: value, userId }, select: { id: true } });
          if (!list) break;
          await moveTaskToList(taskId, value);
        }
        markApplied(field, at);
        break;
      }
      case "name": {
        if (typeof value !== "string" || !value.trim()) break;
        await persistTaskRename(taskId, value, userId);
        markApplied(field, at);
        break;
      }
      case "details": {
        if (typeof value !== "string") break;
        await persistTaskDetailsUpdate(taskId, value, userId);
        markApplied(field, at);
        break;
      }
      case "isNote": {
        if (typeof value !== "boolean") break;
        if (value !== task.isNote) {
          await (value ? convertTaskToNote(taskId) : convertNoteToTask(taskId));
        }
        markApplied(field, at);
        break;
      }
      case "completed": {
        if (typeof value !== "boolean") break;
        // toggleTask spawns the next occurrence of a recurring task, so only call it on a real change.
        if (value !== task.completed) await toggleTask(taskId, value);
        markApplied(field, at);
        break;
      }
      case "important":
      case "pinned": {
        if (typeof value !== "boolean") break;
        await prisma.task.update({ where: { id: taskId }, data: { [field]: value } });
        markApplied(field, at);
        break;
      }
      case "priority": {
        if (value !== null && !(typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3)) break;
        await updateTaskPriority(taskId, value as number | null);
        markApplied(field, at);
        break;
      }
      case "calendarColor": {
        if (value !== null && typeof value !== "string") break;
        await updateTaskCalendarColor(taskId, value as string | null);
        markApplied(field, at);
        break;
      }
      case "dueDate": {
        const dueDate = normalizeDateValue(value);
        if (dueDate === undefined) break;
        await updateTaskDueDate(taskId, dueDate);
        markApplied(field, at);
        break;
      }
      case "dueTimeMinutes":
      case "dueDurationMinutes":
        // Applied together below.
        break;
      case "labelIds": {
        if (!Array.isArray(value)) break;
        const requested = value.filter((id): id is string => typeof id === "string");
        const owned = await prisma.tag.findMany({
          where: { id: { in: requested }, userId, category: LABEL_CATEGORY },
          select: { id: true },
        });
        const ownedIds = owned.map((label) => label.id);
        await prisma.$transaction([
          prisma.taskTag.deleteMany({
            where: { taskId, tag: { category: LABEL_CATEGORY }, tagId: { notIn: ownedIds } },
          }),
          prisma.taskTag.createMany({
            data: ownedIds.map((tagId) => ({ taskId, tagId })),
            skipDuplicates: true,
          }),
        ]);
        markApplied(field, at);
        break;
      }
    }
  }

  const timeChange = winners.get("dueTimeMinutes");
  const durationChange = winners.get("dueDurationMinutes");
  const timeValid = timeChange && isMinutesValue(timeChange.value, 0, 1439);
  const durationValid = durationChange && isMinutesValue(durationChange.value, 1, 60 * 24 * 365);
  if (timeValid || durationValid) {
    const current = await prisma.task.findUnique({
      where: { id: taskId },
      select: { dueTimeMinutes: true, dueDurationMinutes: true, dueTimeZone: true },
    });
    await updateTaskDueTime(taskId, {
      dueTimeMinutes: timeValid ? (timeChange.value as number | null) : (current?.dueTimeMinutes ?? null),
      dueDurationMinutes: durationValid
        ? (durationChange.value as number | null)
        : (current?.dueDurationMinutes ?? null),
      dueTimeZone: normalizeDueTimeZone(current?.dueTimeZone ?? task.dueTimeZone),
    });
    if (timeValid) markApplied("dueTimeMinutes", timeChange.at);
    if (durationValid) markApplied("dueDurationMinutes", durationChange.at);
  }

  for (const [at, stampedFields] of appliedStamps) {
    await stampTaskFields(taskId, stampedFields, at);
  }

  return { applied: appliedStamps.size > 0 };
}

async function applyCreate(
  mutation: SyncMutationInput,
  userId: string,
  tempIds: Map<string, string>,
  clampAt: (at: number) => number,
): Promise<StoredResult> {
  const fields = mutation.fields ?? {};
  const name = typeof fields.name?.value === "string" ? fields.name.value.trim() : "";
  if (!name) throw new SyncRejection("name is required");

  const rawParentId = typeof fields.parentId?.value === "string" ? fields.parentId.value : null;
  const parentId = rawParentId ? (tempIds.get(rawParentId) ?? rawParentId) : null;
  if (parentId?.startsWith(LOCAL_ID_PREFIX)) {
    throw new SyncRejection("Parent task was never created on the server");
  }

  let id: string;
  if (parentId) {
    const parent = await prisma.task.findFirst({ where: { id: parentId, userId, deletedAt: null }, select: { id: true } });
    if (!parent) throw new SyncRejection("Parent task not found");
    id = (await createSubtask(parentId, name)).id;
  } else {
    const listId = typeof fields.listId?.value === "string" ? fields.listId.value : "";
    const list = listId
      ? await prisma.todoList.findFirst({ where: { id: listId, userId }, select: { id: true } })
      : null;
    if (!list) throw new SyncRejection("List not found");
    const dueDate = normalizeDateValue(fields.dueDate?.value) ?? null;
    const isNote = fields.isNote?.value === true;
    id = (await createTask(list.id, name, dueDate, { isNote })).id;
  }

  const { name: _name, listId: _listId, parentId: _parentId, ...rest } = fields;
  await applyTaskFields(id, userId, rest, clampAt, { force: true });
  const stampAt = clampAt(mutation.at);
  await stampTaskFields(id, ["name", "listId", ...(parentId ? (["parentId"] as const) : [])], stampAt);

  tempIds.set(mutation.entityId, id);
  return { mutationId: mutation.mutationId, status: "applied", tempId: mutation.entityId, id };
}

async function applyDelete(
  mutation: SyncMutationInput,
  userId: string,
  taskId: string,
  clampAt: (at: number) => number,
): Promise<StoredResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true, deletedAt: true, fieldUpdatedAt: true },
  });
  if (!task || task.deletedAt) {
    return { mutationId: mutation.mutationId, status: "ignored" };
  }

  const at = clampAt(mutation.at);
  const newestEdit = Math.max(0, ...Object.values(readTaskFieldClock(task.fieldUpdatedAt)));
  // A delete only beats edits made before it; a newer edit elsewhere keeps the task alive.
  if (at < newestEdit) {
    return { mutationId: mutation.mutationId, status: "ignored", error: "Task was edited after it was deleted" };
  }

  await deleteTask(taskId);
  await stampTaskFields(taskId, ["deletedAt"], at);
  return { mutationId: mutation.mutationId, status: "applied", id: taskId };
}

async function applyReorder(
  mutation: SyncMutationInput,
  userId: string,
  tempIds: Map<string, string>,
  clampAt: (at: number) => number,
): Promise<StoredResult> {
  const reorder = mutation.reorder;
  if (!reorder || typeof reorder.listId !== "string" || !Array.isArray(reorder.taskIds)) {
    throw new SyncRejection("Invalid reorder payload");
  }
  if (reorder.section !== "pinned" && reorder.section !== "tasks") {
    throw new SyncRejection("section must be 'pinned' or 'tasks'");
  }

  const list = await prisma.todoList.findFirst({ where: { id: reorder.listId, userId }, select: { id: true } });
  if (!list) throw new SyncRejection("List not found");

  const tasks = await prisma.task.findMany({
    where: { listId: list.id, userId, deletedAt: null },
    select: { id: true, completed: true, pinned: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  const wantPinned = reorder.section === "pinned";
  const sectionIds = tasks
    .filter((task) => !task.completed && task.pinned === wantPinned)
    .map((task) => task.id);
  const sectionSet = new Set(sectionIds);
  const requested = reorder.taskIds
    .filter((id): id is string => typeof id === "string")
    .map((id) => tempIds.get(id) ?? id)
    .filter((id, index, all) => sectionSet.has(id) && all.indexOf(id) === index);
  // Tasks added on another device since the client's snapshot keep their place at the end.
  const ordered = [...requested, ...sectionIds.filter((id) => !requested.includes(id))];

  const merged = wantPinned
    ? mergeReorderedPinnedTasks(tasks, ordered)
    : mergeReorderedUnpinnedTasks(tasks, ordered);

  await prisma.$transaction(
    merged.map((task, position) =>
      prisma.task.update({ where: { id: task.id }, data: { position } }),
    ),
  );
  await stampTaskFields(ordered, ["position"], clampAt(mutation.at));
  return { mutationId: mutation.mutationId, status: "applied" };
}

function isValidMutation(value: unknown): value is SyncMutationInput {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Partial<SyncMutationInput>;
  return (
    typeof mutation.mutationId === "string" &&
    mutation.mutationId.length > 0 &&
    mutation.mutationId.length <= 100 &&
    typeof mutation.entityId === "string" &&
    typeof mutation.at === "number" &&
    Number.isFinite(mutation.at) &&
    (mutation.kind === "create" ||
      mutation.kind === "update" ||
      mutation.kind === "delete" ||
      mutation.kind === "reorder")
  );
}

/**
 * Applies a batch of offline mutations in order. Each mutation is recorded
 * by id so a retried push returns the original outcome instead of re-applying.
 * An unexpected error stops the batch; unanswered mutations are retried by the client.
 */
export async function applySyncMutations(userId: string, input: unknown[]) {
  const serverNow = Date.now();
  const clampAt = (at: number) => Math.min(at, serverNow + MAX_CLOCK_SKEW_MS);
  const tempIds = new Map<string, string>();
  const results: SyncMutationResult[] = [];

  for (const raw of input) {
    if (!isValidMutation(raw)) {
      const mutationId =
        raw && typeof raw === "object" && typeof (raw as { mutationId?: unknown }).mutationId === "string"
          ? (raw as { mutationId: string }).mutationId
          : "";
      if (mutationId) results.push({ mutationId, status: "rejected", error: "Invalid mutation" });
      continue;
    }
    const mutation = raw;

    const previous = await prisma.syncMutation.findUnique({
      where: { userId_id: { userId, id: mutation.mutationId } },
      select: { result: true },
    });

    let stored: StoredResult;
    if (previous) {
      stored = previous.result as StoredResult;
      if (stored.tempId && stored.id) tempIds.set(stored.tempId, stored.id);
    } else {
      const taskId = tempIds.get(mutation.entityId) ?? mutation.entityId;
      try {
        if (mutation.kind === "create") {
          stored = await applyCreate(mutation, userId, tempIds, clampAt);
        } else if (mutation.kind === "delete") {
          stored = await applyDelete(mutation, userId, taskId, clampAt);
        } else if (mutation.kind === "reorder") {
          stored = await applyReorder(mutation, userId, tempIds, clampAt);
        } else {
          if (taskId.startsWith(LOCAL_ID_PREFIX)) {
            throw new SyncRejection("Task was never created on the server");
          }
          const { applied } = await applyTaskFields(taskId, userId, mutation.fields ?? {}, clampAt);
          stored = { mutationId: mutation.mutationId, status: applied ? "applied" : "ignored", id: taskId };
        }
      } catch (error) {
        if (!(error instanceof SyncRejection)) {
          console.error("Sync mutation failed:", error);
          break;
        }
        stored = { mutationId: mutation.mutationId, status: "rejected", error: error.message };
      }

      await prisma.syncMutation
        .create({
          data: { id: mutation.mutationId, userId, result: stored as Prisma.InputJsonValue },
        })
        .catch((error: unknown) => {
          // A concurrent retry already recorded this mutation.
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
            throw error;
          }
        });
    }

    const taskId =
      mutation.kind === "reorder" ? null : (stored.id ?? tempIds.get(mutation.entityId) ?? mutation.entityId);
    const task =
      taskId && !taskId.startsWith(LOCAL_ID_PREFIX) ? await loadSyncTask(taskId, userId) : null;
    results.push({ ...stored, task });
  }

  return results;
}
