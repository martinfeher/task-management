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
};

export async function fetchTaskById(
  taskId: string,
): Promise<TaskDetailsRecord | null> {
  try {
    const task = await getTaskById(taskId);
    if (!task) {
      return null;
    }

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
    };
  } catch {
    return null;
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
