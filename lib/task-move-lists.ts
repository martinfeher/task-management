import type { TodoList } from "@/app/components/todo-app";
import { getInboxListId } from "@/lib/inbox-list";

/** Lists available as move targets, with the Inbox list pinned first when present. */
export function buildTaskMoveTargetLists(lists: TodoList[]): TodoList[] {
  const inboxListId = getInboxListId(lists);
  if (!inboxListId) return lists;

  const inboxList = lists.find((list) => list.id === inboxListId);
  if (!inboxList) return lists;

  return [
    inboxList,
    ...lists.filter((list) => list.id !== inboxListId),
  ];
}

export function resolveTaskSourceListId(
  taskId: string,
  tasksByList: Record<string, { id: string }[]>,
  fallbackListId?: string | null,
): string | null {
  for (const [listId, listTasks] of Object.entries(tasksByList)) {
    if (listTasks.some((task) => task.id === taskId)) {
      return listId;
    }
  }

  return fallbackListId ?? null;
}
