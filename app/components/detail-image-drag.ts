import {
  canMoveImageWrapperToLineSlot,
  getLineElements,
  getLineIndex,
  moveImageWrapperToLineSlot,
  placeCaretBelowWrapper,
} from "./detail-lines";

const DRAG_THRESHOLD_PX = 5;

/**
 * Lets a vertical image drag move the image between detail lines,
 * showing a drop indicator at the target gap.
 */
export type ImageVerticalReorderController = {
  /** The scroll container `.detail-line` rects are measured against. */
  editorViewport: HTMLElement;
  onDropIndicatorChange: (indicator: { top: number } | null) => void;
};

function parseMarginLeft(element: HTMLElement) {
  const parsed = parseFloat(element.style.marginLeft);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMaxHorizontalOffset(line: HTMLElement, wrapper: HTMLElement) {
  const lineWidth = line.clientWidth;
  const wrapperWidth = wrapper.getBoundingClientRect().width;
  return Math.max(0, lineWidth - wrapperWidth);
}

function applyHorizontalOffset(
  line: HTMLElement,
  wrapper: HTMLElement,
  offset: number,
) {
  const clamped = Math.max(
    0,
    Math.min(getMaxHorizontalOffset(line, wrapper), Math.round(offset)),
  );

  if (clamped === 0) {
    wrapper.style.marginLeft = "";
  } else {
    wrapper.style.marginLeft = `${clamped}px`;
  }
}

function getVerticalDropIndicatorTop(
  editorViewport: HTMLElement,
  lines: HTMLElement[],
  dropIndex: number,
) {
  const viewportRect = editorViewport.getBoundingClientRect();

  if (dropIndex >= lines.length) {
    const lastLine = lines[lines.length - 1];
    return lastLine
      ? lastLine.getBoundingClientRect().bottom - viewportRect.top
      : 0;
  }

  const targetLine = lines[dropIndex];
  return targetLine.getBoundingClientRect().top - viewportRect.top;
}

function getImageDropSlot(clientY: number, lines: HTMLElement[]) {
  for (let index = 1; index < lines.length; index += 1) {
    const rect = lines[index].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      return index;
    }
  }

  return lines.length;
}

export function startImagePointerInteraction(
  event: PointerEvent,
  wrapper: HTMLElement,
  line: HTMLElement,
  editor: HTMLElement,
  onComplete: () => void,
  verticalReorder?: ImageVerticalReorderController,
) {
  const startX = event.clientX;
  const startY = event.clientY;
  const startMarginLeft = parseMarginLeft(wrapper);
  const canMoveBetweenLines =
    Boolean(verticalReorder) && getLineIndex(editor, line) > 0;
  let dragging = false;
  let pendingSlot: number | null = null;

  function clearVerticalPreview() {
    pendingSlot = null;
    delete wrapper.dataset.dragAxis;
    verticalReorder?.onDropIndicatorChange(null);
  }

  function beginDragging() {
    dragging = true;
    wrapper.dataset.dragging = "true";
    wrapper.setPointerCapture(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function onPointerMove(moveEvent: PointerEvent) {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;

    if (!dragging && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
      return;
    }

    if (!dragging) {
      beginDragging();
    }

    const verticalDominant =
      canMoveBetweenLines && Math.abs(deltaY) > Math.abs(deltaX);

    if (!verticalDominant || !verticalReorder) {
      if (wrapper.dataset.dragAxis) {
        clearVerticalPreview();
      }

      applyHorizontalOffset(line, wrapper, startMarginLeft + deltaX);
      return;
    }

    wrapper.dataset.dragAxis = "vertical";

    const lines = getLineElements(editor);
    const slot = getImageDropSlot(moveEvent.clientY, lines);

    if (!canMoveImageWrapperToLineSlot(editor, wrapper, slot)) {
      pendingSlot = null;
      verticalReorder.onDropIndicatorChange(null);
      return;
    }

    pendingSlot = slot;
    verticalReorder.onDropIndicatorChange({
      top: getVerticalDropIndicatorTop(
        verticalReorder.editorViewport,
        lines,
        slot,
      ),
    });
  }

  function onPointerUp() {
    if (dragging) {
      if (wrapper.hasPointerCapture(event.pointerId)) {
        wrapper.releasePointerCapture(event.pointerId);
      }
      delete wrapper.dataset.dragging;

      const slot = pendingSlot;
      clearVerticalPreview();

      if (slot !== null) {
        moveImageWrapperToLineSlot(editor, wrapper, slot);
      }

      onComplete();
    } else {
      placeCaretBelowWrapper(wrapper);
      editor.focus();
    }

    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }

  document.addEventListener("pointermove", onPointerMove);
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

export function getImageDragTarget(element: EventTarget | null) {
  if (!(element instanceof HTMLElement)) return null;
  if (element.closest(".detail-image-delete")) return null;
  if (element.closest("[data-resize]")) return null;

  const wrapper = element.closest(".detail-image-wrapper");
  if (!(wrapper instanceof HTMLElement)) return null;

  const line = wrapper.closest(".detail-line");
  if (!(line instanceof HTMLElement)) return null;

  return { wrapper, line };
}
