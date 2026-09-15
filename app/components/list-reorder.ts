import { getDropIndex } from "./detail-lines";
import { reorderTaskIds } from "./task-reorder";

export function getListRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-list-id]"),
  );
}

export function getSidebarTopLevelRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-sidebar-reorder-row]"),
  );
}

export function reorderListIds(
  listIds: string[],
  sourceIndex: number,
  dropIndex: number,
) {
  return reorderTaskIds(listIds, sourceIndex, dropIndex);
}

export function getSidebarListIds(
  listIds: string[],
  inboxListId: string | null,
) {
  if (!inboxListId) return listIds;
  return listIds.filter((id) => id !== inboxListId);
}

export function mergeReorderedSidebarListIds(
  fullListIds: string[],
  inboxListId: string | null,
  reorderedSidebarIds: string[],
  listIdsInFolders: ReadonlySet<string> = new Set(),
) {
  if (!inboxListId && listIdsInFolders.size === 0) {
    return reorderedSidebarIds;
  }

  const next: string[] = [];
  let sidebarIndex = 0;

  for (const id of fullListIds) {
    if (id === inboxListId || listIdsInFolders.has(id)) {
      next.push(id);
      continue;
    }

    const sidebarId = reorderedSidebarIds[sidebarIndex];
    if (sidebarId) {
      next.push(sidebarId);
    }
    sidebarIndex += 1;
  }

  return next;
}

export function getListDropIndex(
  clientY: number,
  rows: HTMLElement[],
  draggingIndex: number | null = null,
) {
  return getDropIndex(clientY, rows, draggingIndex);
}

export function getFolderDropTargetFromPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
) {
  const folderRows = Array.from(
    container.querySelectorAll<HTMLElement>("[data-folder-id]"),
  );

  for (const row of folderRows) {
    const rect = row.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      return row.dataset.folderId ?? null;
    }
  }

  return null;
}
