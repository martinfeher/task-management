import type { ListFolder, TodoList } from "@/app/components/todo-app";

export type SidebarTopLevelEntry =
  | { kind: "folder"; folder: ListFolder }
  | { kind: "list"; list: TodoList };

export function buildSidebarTopLevelEntries(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
): SidebarTopLevelEntry[] {
  const ungroupedLists = lists.filter(
    (list) => list.id !== inboxListId && !list.folderId,
  );

  const entries: Array<SidebarTopLevelEntry & { sortKey: number }> = [
    ...folders.map((folder) => ({
      kind: "folder" as const,
      folder,
      sortKey: folder.position,
    })),
    ...ungroupedLists.map((list) => ({
      kind: "list" as const,
      list,
      sortKey: list.position ?? 0,
    })),
  ];

  return entries
    .sort((left, right) => left.sortKey - right.sortKey)
    .map(({ sortKey: _sortKey, ...entry }) => entry);
}

export function getListsForFolder(lists: TodoList[], folderId: string) {
  return lists
    .filter((list) => list.folderId === folderId)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
}

export function getUngroupedSidebarListIds(
  lists: TodoList[],
  inboxListId: string | null,
) {
  return lists
    .filter((list) => list.id !== inboxListId && !list.folderId)
    .map((list) => list.id);
}
