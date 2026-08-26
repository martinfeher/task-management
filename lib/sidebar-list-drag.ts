export type SidebarListDragTarget = {
  taskId: string;
  taskName: string;
  listId: string;
};

export function resolveSidebarListFromPoint(
  clientX: number,
  clientY: number,
): string | null {
  const element = document.elementFromPoint(clientX, clientY);
  if (!(element instanceof Element)) return null;

  const listRow = element.closest("[data-list-id]");
  if (!(listRow instanceof HTMLElement)) return null;

  if (!listRow.closest("aside")) return null;

  return listRow.getAttribute("data-list-id");
}

export function getSidebarListDropTargetKey(
  taskId: string,
  listId: string | null,
): string | null {
  if (!listId) return null;

  return `${taskId}:${listId}`;
}
