import {
  canMoveImageWrapperToLineSlot,
  getLineElements,
  getLineIndex,
  moveImageWrapperToLineSlot,
  placeCaretBelowWrapper,
} from "./detail-lines";

const DRAG_THRESHOLD_PX = 5;

/**
 * Picks the line gap the image's top edge was dropped into, ignoring the
 * line the image currently sits in.
 */
function getImageDropSlot(
  dropTop: number,
  lines: HTMLElement[],
  sourceLine: HTMLElement,
) {
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === sourceLine) continue;

    const rect = lines[index].getBoundingClientRect();
    if (dropTop < rect.top + rect.height / 2) {
      return index;
    }
  }

  return lines.length;
}

function applyDropPosition(
  wrapper: HTMLElement,
  dropLeft: number,
  dropTop: number,
) {
  const line = wrapper.closest(".detail-line");
  if (!(line instanceof HTMLElement)) return;

  wrapper.style.marginLeft = "";
  wrapper.style.marginTop = "";

  const naturalRect = wrapper.getBoundingClientRect();
  const maxLeft = Math.max(0, line.clientWidth - naturalRect.width);

  const marginLeft = Math.round(
    Math.max(0, Math.min(maxLeft, dropLeft - naturalRect.left)),
  );
  const marginTop = Math.round(Math.max(0, dropTop - naturalRect.top));

  if (marginLeft > 0) wrapper.style.marginLeft = `${marginLeft}px`;
  if (marginTop > 0) wrapper.style.marginTop = `${marginTop}px`;
}

/**
 * Drags an image freely inside the editor; on drop it is moved to the nearest
 * line gap and offset with margins so it stays exactly where it was released.
 */
export function startImagePointerInteraction(
  event: PointerEvent,
  wrapper: HTMLElement,
  line: HTMLElement,
  editor: HTMLElement,
  onComplete: () => void,
  onTap?: () => void,
) {
  const startX = event.clientX;
  const startY = event.clientY;
  const startRect = wrapper.getBoundingClientRect();
  const canMoveBetweenLines = getLineIndex(editor, line) > 0;
  let dragging = false;
  let lastDeltaX = 0;
  let lastDeltaY = 0;

  function beginDragging() {
    dragging = true;
    wrapper.dataset.dragging = "true";
    wrapper.dataset.dragAxis = "free";
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

    const editorRect = editor.getBoundingClientRect();
    const minDeltaX = editorRect.left - startRect.left;
    const maxDeltaX = editorRect.right - startRect.right;
    const minDeltaY = editorRect.top - startRect.top;

    lastDeltaX = Math.max(minDeltaX, Math.min(maxDeltaX, deltaX));
    lastDeltaY = canMoveBetweenLines ? Math.max(minDeltaY, deltaY) : 0;

    wrapper.style.transform = `translate(${Math.round(lastDeltaX)}px, ${Math.round(lastDeltaY)}px)`;
  }

  function onPointerUp() {
    if (dragging) {
      if (wrapper.hasPointerCapture(event.pointerId)) {
        wrapper.releasePointerCapture(event.pointerId);
      }

      const dropLeft = startRect.left + lastDeltaX;
      const dropTop = startRect.top + lastDeltaY;

      wrapper.style.transform = "";
      delete wrapper.dataset.dragging;
      delete wrapper.dataset.dragAxis;

      if (canMoveBetweenLines) {
        const sourceLine = wrapper.closest(".detail-line");
        if (sourceLine instanceof HTMLElement) {
          const slot = getImageDropSlot(
            dropTop,
            getLineElements(editor),
            sourceLine,
          );
          if (canMoveImageWrapperToLineSlot(editor, wrapper, slot)) {
            moveImageWrapperToLineSlot(editor, wrapper, slot);
          }
        }
      }

      applyDropPosition(wrapper, dropLeft, dropTop);
      onComplete();
    } else if (onTap) {
      onTap();
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
  if (element.closest(".detail-image-crop")) return null;
  if (element.closest("[data-resize]")) return null;

  const wrapper = element.closest(".detail-image-wrapper");
  if (!(wrapper instanceof HTMLElement)) return null;

  const line = wrapper.closest(".detail-line");
  if (!(line instanceof HTMLElement)) return null;

  return { wrapper, line };
}
