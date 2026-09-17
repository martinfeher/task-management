import { getDropIndex } from "./detail-lines";

export const KANBAN_DRAG_THRESHOLD_PX = 5;
export const KANBAN_TASK_DRAG_SOURCE_CLASS = "task-row-list-drag-source";
export const KANBAN_TASK_DRAG_GHOST_CLASS = "task-row-drag-ghost";
export const KANBAN_DROP_INDICATOR_COLOR = "#00a239";

export function getKanbanTaskElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-kanban-task-id]"),
  );
}

export function shouldStartKanbanTaskDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem'], label",
  );
}

export function createKanbanTaskDragGhost(sourceRow: HTMLElement) {
  const rect = sourceRow.getBoundingClientRect();
  const ghost = sourceRow.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.classList.add(KANBAN_TASK_DRAG_GHOST_CLASS);
  ghost.style.width = `${rect.width}px`;
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  document.body.appendChild(ghost);
  return ghost;
}

export function updateKanbanTaskDragGhostPosition(
  ghost: HTMLElement,
  clientX: number,
  clientY: number,
  offsetX: number,
  offsetY: number,
) {
  ghost.style.left = `${clientX - offsetX}px`;
  ghost.style.top = `${clientY - offsetY}px`;
}

export type KanbanDropTarget = {
  columnId: string;
  dropIndex: number;
  indicatorTop: number;
};

export function resolveKanbanDropTarget(
  clientX: number,
  clientY: number,
  sourceColumnId: string,
  sourceTaskId: string,
): KanbanDropTarget | null {
  const columns = document.querySelectorAll<HTMLElement>(
    "[data-kanban-column-id]",
  );

  for (const column of columns) {
    const rect = column.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      continue;
    }

    const columnId = column.dataset.kanbanColumnId;
    if (!columnId) continue;

    const body = column.querySelector<HTMLElement>(
      "[data-kanban-column-body]",
    );
    if (!body) continue;

    const rows = getKanbanTaskElements(body);
    const draggingIndex =
      sourceColumnId === columnId
        ? rows.findIndex((row) => row.dataset.kanbanTaskId === sourceTaskId)
        : null;
    const dropIndex = getDropIndex(clientY, rows, draggingIndex);
    const bodyRect = body.getBoundingClientRect();

    let indicatorTop: number;
    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      indicatorTop = lastRow
        ? lastRow.getBoundingClientRect().bottom - bodyRect.top
        : 0;
    } else {
      const targetRow = rows[dropIndex];
      indicatorTop = targetRow.getBoundingClientRect().top - bodyRect.top;
    }

    return {
      columnId,
      dropIndex,
      indicatorTop,
    };
  }

  return null;
}

export function trySetPointerCapture(target: HTMLElement, pointerId: number) {
  if (!target.isConnected) return false;

  try {
    if (!target.hasPointerCapture(pointerId)) {
      target.setPointerCapture(pointerId);
    }
    return true;
  } catch {
    return false;
  }
}

export function tryReleasePointerCapture(target: HTMLElement, pointerId: number) {
  if (!target.isConnected) return;

  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
  } catch {
    // Ignore stale pointer capture errors.
  }
}
