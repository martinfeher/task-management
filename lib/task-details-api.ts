import { getTaskById, updateTaskDetails } from "@/app/actions/todo";
import { normalizeDueTimeZone } from "@/lib/task-due-time";

export type TaskDetailsRecord = {
  id: string;
  name: string;
  completed: boolean;
  details: string;
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  recurrenceRule: string | null;
  isNote: boolean;
};

const TASK_FETCH_DEDUPE_MS = 2_000;

const inFlightTaskFetches = new Map<string, Promise<TaskDetailsRecord | null>>();
const recentTaskFetchResults = new Map<
  string,
  { result: TaskDetailsRecord | null; fetchedAt: number }
>();

function mapTaskRecord(task: NonNullable<Awaited<ReturnType<typeof getTaskById>>>) {
  return {
    id: task.id,
    name: task.name,
    completed: task.completed,
    details: task.details,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    dueTimeMinutes: task.dueTimeMinutes,
    dueDurationMinutes: task.dueDurationMinutes,
    dueTimeZone: normalizeDueTimeZone(task.dueTimeZone),
    recurrenceRule: task.recurrenceRule ?? null,
    isNote: task.isNote,
  };
}

async function loadTaskById(taskId: string): Promise<TaskDetailsRecord | null> {
  try {
    const task = await getTaskById(taskId);
    if (!task) {
      return null;
    }

    return mapTaskRecord(task);
  } catch {
    return null;
  }
}

export function invalidateTaskDetailsFetchCache(taskId?: string) {
  if (taskId) {
    inFlightTaskFetches.delete(taskId);
    recentTaskFetchResults.delete(taskId);
    return;
  }

  inFlightTaskFetches.clear();
  recentTaskFetchResults.clear();
}

export async function fetchTaskById(
  taskId: string,
  options?: { force?: boolean },
): Promise<TaskDetailsRecord | null> {
  if (!options?.force) {
    const inFlight = inFlightTaskFetches.get(taskId);
    if (inFlight) {
      return inFlight;
    }

    const recent = recentTaskFetchResults.get(taskId);
    if (recent && Date.now() - recent.fetchedAt < TASK_FETCH_DEDUPE_MS) {
      return recent.result;
    }
  } else {
    inFlightTaskFetches.delete(taskId);
    recentTaskFetchResults.delete(taskId);
  }

  const promise = loadTaskById(taskId);
  inFlightTaskFetches.set(taskId, promise);

  try {
    const result = await promise;
    recentTaskFetchResults.set(taskId, {
      result,
      fetchedAt: Date.now(),
    });
    return result;
  } finally {
    if (inFlightTaskFetches.get(taskId) === promise) {
      inFlightTaskFetches.delete(taskId);
    }
  }
}

export async function saveTaskDetails(
  taskId: string,
  details: string,
): Promise<void> {
  try {
    await updateTaskDetails(taskId, details);
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to save task details");
  }
}

export function saveTaskDetailsKeepalive(taskId: string, details: string) {
  void fetch(`/api/tasks/${taskId}/details`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details }),
    keepalive: true,
  });
}

export function saveTaskNameKeepalive(taskId: string, name: string) {
  void fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    keepalive: true,
  });
}
