import type { TodoList } from "@/app/components/todo-app";

export function isInboxListName(name: string) {
  return name.trim().toLowerCase() === "inbox";
}

export function isInboxList(list: Pick<TodoList, "name">) {
  return isInboxListName(list.name);
}

export function getInboxListId(lists: TodoList[]) {
  return (
    lists.find((list) => isInboxList(list))?.id ?? lists[0]?.id ?? null
  );
}
