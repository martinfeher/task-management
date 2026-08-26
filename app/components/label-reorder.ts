import { getDropIndex } from "./detail-lines";
import { reorderTaskIds } from "./task-reorder";

export function getLabelRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-label-id]"),
  );
}

export function reorderLabelIds(
  labelIds: string[],
  sourceIndex: number,
  dropIndex: number,
) {
  return reorderTaskIds(labelIds, sourceIndex, dropIndex);
}

export function getLabelDropIndex(
  clientY: number,
  rows: HTMLElement[],
  draggingIndex: number | null = null,
) {
  return getDropIndex(clientY, rows, draggingIndex);
}

export function applyLabelRowShifts(
  rows: HTMLElement[],
  sourceRow: HTMLElement,
  sourceIndex: number,
  targetIndex: number,
  rowHeight: number,
) {
  rows.forEach((row, index) => {
    if (row === sourceRow) return;

    let shift = 0;
    if (
      targetIndex > sourceIndex &&
      index > sourceIndex &&
      index <= targetIndex
    ) {
      shift = -rowHeight;
    } else if (
      targetIndex < sourceIndex &&
      index >= targetIndex &&
      index < sourceIndex
    ) {
      shift = rowHeight;
    }

    row.style.transform = shift ? `translateY(${shift}px)` : "";
  });
}

export function resetLabelRowShifts(rows: HTMLElement[], sourceRow: HTMLElement) {
  rows.forEach((row) => {
    if (row === sourceRow) return;
    row.style.transform = "";
  });
}
