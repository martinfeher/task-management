import type { ArchivedTaskItem } from "@/app/actions/todo";

export const ARCHIVED_TASKS_ADDED_EVENT = "todolist:archived-tasks-added";

export type ArchivedTasksAddedEventDetail = ArchivedTaskItem[];

export function dispatchArchivedTasksAdded(items: ArchivedTaskItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;

  window.dispatchEvent(
    new CustomEvent<ArchivedTasksAddedEventDetail>(ARCHIVED_TASKS_ADDED_EVENT, {
      detail: items,
    }),
  );
}