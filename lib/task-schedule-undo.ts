import type { TaskReminderOptionId } from "@/lib/task-reminder";

export const TASK_SCHEDULE_UNDO_LABEL = "Date and time";

export type TaskScheduleSnapshot = {
  dueDate: string | null;
  dueTimeMinutes: number | null;
  dueDurationMinutes: number | null;
  dueTimeZone: string;
  recurrenceRule: string | null;
  reminderOptionId: TaskReminderOptionId | null;
};

export function taskScheduleSnapshotsEqual(
  a: TaskScheduleSnapshot,
  b: TaskScheduleSnapshot,
) {
  return (
    a.dueDate === b.dueDate &&
    a.dueTimeMinutes === b.dueTimeMinutes &&
    a.dueDurationMinutes === b.dueDurationMinutes &&
    a.dueTimeZone === b.dueTimeZone &&
    a.recurrenceRule === b.recurrenceRule &&
    a.reminderOptionId === b.reminderOptionId
  );
}