import type { ListFolder, TodoList } from "@/app/components/todo-app";
import { reorderListIds } from "@/app/components/list-reorder";

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

export function getSidebarUngroupedListIdsInVisualOrder(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
) {
  return buildSidebarTopLevelEntries(folders, lists, inboxListId)
    .filter((entry): entry is { kind: "list"; list: TodoList } => entry.kind === "list")
    .map((entry) => entry.list.id);
}

type SidebarTopLevelRowKey = `list:${string}` | `folder:${string}`;

function getSidebarTopLevelRowKeys(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
): SidebarTopLevelRowKey[] {
  return buildSidebarTopLevelEntries(folders, lists, inboxListId).map((entry) =>
    entry.kind === "list"
      ? (`list:${entry.list.id}` as const)
      : (`folder:${entry.folder.id}` as const),
  );
}

export function computeNestedListMoveToTopLevel(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
  listId: string,
  dropIndex: number,
): { lists: TodoList[]; folders: ListFolder[]; changed: boolean } {
  const rowKeys = getSidebarTopLevelRowKeys(folders, lists, inboxListId);
  const insertKey = `list:${listId}` as const;
  const clampedIndex = Math.max(0, Math.min(dropIndex, rowKeys.length));
  const reorderedKeys = [
    ...rowKeys.slice(0, clampedIndex),
    insertKey,
    ...rowKeys.slice(clampedIndex),
  ];

  const listById = new Map(
    lists.map((list) => [
      list.id,
      {
        ...list,
        folderId: list.id === listId ? null : list.folderId,
      },
    ]),
  );
  const folderById = new Map(
    folders.map((folder) => [folder.id, { ...folder }]),
  );

  reorderedKeys.forEach((key, position) => {
    if (key.startsWith("list:")) {
      const nextListId = key.slice("list:".length);
      const current = listById.get(nextListId);
      if (current) {
        listById.set(nextListId, { ...current, position });
      }
      return;
    }

    const folderId = key.slice("folder:".length);
    const current = folderById.get(folderId);
    if (current) {
      folderById.set(folderId, { ...current, position });
    }
  });

  return {
    lists: lists.map((list) => listById.get(list.id) ?? list),
    folders: folders.map((folder) => folderById.get(folder.id) ?? folder),
    changed: true,
  };
}

export function computeSidebarTopLevelAfterReorder(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
  sourceIndex: number,
  dropIndex: number,
): { lists: TodoList[]; folders: ListFolder[]; changed: boolean } {
  const rowKeys = getSidebarTopLevelRowKeys(folders, lists, inboxListId);
  const reorderedKeys = reorderListIds(rowKeys, sourceIndex, dropIndex);

  if (reorderedKeys.join(",") === rowKeys.join(",")) {
    return { lists, folders, changed: false };
  }

  const listById = new Map(lists.map((list) => [list.id, { ...list }]));
  const folderById = new Map(
    folders.map((folder) => [folder.id, { ...folder }]),
  );

  reorderedKeys.forEach((key, position) => {
    if (key.startsWith("list:")) {
      const listId = key.slice("list:".length);
      const current = listById.get(listId);
      if (current) {
        listById.set(listId, { ...current, position });
      }
      return;
    }

    const folderId = key.slice("folder:".length);
    const current = folderById.get(folderId);
    if (current) {
      folderById.set(folderId, { ...current, position });
    }
  });

  return {
    lists: lists.map((list) => listById.get(list.id) ?? list),
    folders: folders.map((folder) => folderById.get(folder.id) ?? folder),
    changed: true,
  };
}

/** @deprecated Use computeSidebarTopLevelAfterReorder */
export function computeSidebarTopLevelAfterListReorder(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
  sourceIndex: number,
  dropIndex: number,
) {
  return computeSidebarTopLevelAfterReorder(
    folders,
    lists,
    inboxListId,
    sourceIndex,
    dropIndex,
  );
}

export function getSidebarTopLevelPositionUpdates(
  folders: ListFolder[],
  lists: TodoList[],
  inboxListId: string | null,
) {
  const topLevelListIds = new Set(
    buildSidebarTopLevelEntries(folders, lists, inboxListId)
      .filter((entry) => entry.kind === "list")
      .map((entry) => entry.list.id),
  );

  return {
    listPositions: lists
      .filter((list) => topLevelListIds.has(list.id))
      .map((list) => ({ id: list.id, position: list.position ?? 0 })),
    folderPositions: folders.map((folder) => ({
      id: folder.id,
      position: folder.position,
    })),
  };
}
