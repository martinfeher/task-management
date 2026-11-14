import "server-only";
import { prisma } from "@/lib/prisma";

/** Task fields tracked individually for offline sync last-write-wins. */
export type TaskClockField =
  | "name"
  | "details"
  | "completed"
  | "important"
  | "pinned"
  | "priority"
  | "calendarColor"
  | "dueDate"
  | "dueTimeMinutes"
  | "dueDurationMinutes"
  | "listId"
  | "labelIds"
  | "parentId"
  | "isNote"
  | "position"
  | "deletedAt";

export type TaskFieldClock = Partial<Record<TaskClockField, number>>;

export function readTaskFieldClock(value: unknown): TaskFieldClock {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clock: TaskFieldClock = {};
  for (const [key, stamp] of Object.entries(value as Record<string, unknown>)) {
    if (typeof stamp === "number" && Number.isFinite(stamp)) {
      clock[key as TaskClockField] = stamp;
    }
  }
  return clock;
}

/**
 * Records that `fields` changed at `at` (epoch ms, defaults to now) and bumps
 * `updatedAt` so the change is visible to `/api/sync/pull`. Call after every
 * task write, including ones that only touch related rows such as tags.
 */
export async function stampTaskFields(
  taskIds: string | string[],
  fields: TaskClockField[],
  at: number = Date.now(),
) {
  const ids = Array.isArray(taskIds) ? taskIds : [taskIds];
  if (ids.length === 0 || fields.length === 0) return;
  const patch = JSON.stringify(Object.fromEntries(fields.map((field) => [field, at])));
  await prisma.$executeRaw`
    UPDATE "Task"
    SET "fieldUpdatedAt" = COALESCE("fieldUpdatedAt", '{}'::jsonb) || ${patch}::jsonb,
        "updatedAt" = NOW()
    WHERE "id" = ANY(${ids}::text[])
  `;
}
