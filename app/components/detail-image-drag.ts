import {
  canMoveImageWrapperToLineSlot,
  getLineElements,
  getLineImageWrappers,
  getLineIndex,
  moveImageWrapperIntoImageRow,
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

type Box = { left: number; top: number; right: number; bottom: number };

type ImageSnapshot = { element: HTMLElement; rect: DOMRect };

type ImageRowTarget = { line: HTMLElement; beforeWrapper: HTMLElement | null };

function getImageWrappers(editor: HTMLElement) {
  return Array.from(
    editor.querySelectorAll(".detail-image-wrapper"),
  ).filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function horizontalOverlap(a: Box, b: Box) {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left);
}

function verticalOverlap(a: Box, b: Box) {
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
}

function rectsOverlap(a: Box, b: Box) {
  return horizontalOverlap(a, b) > 0 && verticalOverlap(a, b) > 0;
}

function getLineContentRight(line: HTMLElement) {
  const rect = line.getBoundingClientRect();
  const paddingRight = parseFloat(getComputedStyle(line).paddingRight) || 0;
  return rect.left + line.clientLeft + line.clientWidth - paddingRight;
}

function getLineContentWidth(line: HTMLElement) {
  const style = getComputedStyle(line);
  return (
    line.clientWidth -
    (parseFloat(style.paddingLeft) || 0) -
    (parseFloat(style.paddingRight) || 0)
  );
}

/**
 * Snapshots every other image that does not overlap the drop area, so it can
 * be pinned back to its on-screen position after the dragged image is moved.
 */
function snapshotUnaffectedImages(
  editor: HTMLElement,
  wrapper: HTMLElement,
  dropRect: Box,
) {
  const snapshots: ImageSnapshot[] = [];

  for (const element of getImageWrappers(editor)) {
    if (element === wrapper) continue;
    const rect = element.getBoundingClientRect();
    if (rectsOverlap(rect, dropRect)) continue;
    snapshots.push({ element, rect });
  }

  return snapshots;
}

/**
 * When the drop area sits beside (same height, no horizontal overlap) other
 * images, returns the line to join so the images end up side by side.
 */
function getImageRowTarget(
  editor: HTMLElement,
  wrapper: HTMLElement,
  dropRect: Box,
): ImageRowTarget | null {
  const lines = getLineElements(editor);
  let anchor: { element: HTMLElement; overlap: number } | null = null;

  for (const element of getImageWrappers(editor)) {
    if (element === wrapper) continue;
    const rect = element.getBoundingClientRect();
    const overlap = verticalOverlap(rect, dropRect);
    if (overlap <= 0) continue;
    if (horizontalOverlap(rect, dropRect) > 0) return null;
    if (!anchor || overlap > anchor.overlap) {
      anchor = { element, overlap };
    }
  }

  if (!anchor) return null;

  const line = anchor.element.closest(".detail-line");
  if (!(line instanceof HTMLElement) || lines.indexOf(line) <= 0) return null;

  const rowWrappers = getLineImageWrappers(line).filter(
    (element) => element !== wrapper,
  );
  const rowWidth = rowWrappers.reduce(
    (total, element) => total + element.getBoundingClientRect().width,
    0,
  );
  if (rowWidth + (dropRect.right - dropRect.left) > getLineContentWidth(line)) {
    return null;
  }

  const dropCenter = (dropRect.left + dropRect.right) / 2;
  const beforeWrapper =
    rowWrappers.find((element) => {
      const rect = element.getBoundingClientRect();
      return dropCenter < rect.left + rect.width / 2;
    }) ?? null;

  return { line, beforeWrapper };
}

/** Adjusts an image's margins so its top-left corner lands on (left, top). */
function pinImageTo(element: HTMLElement, left: number, top: number) {
  const line = element.closest(".detail-line");
  let rect = element.getBoundingClientRect();

  const currentLeft = parseFloat(element.style.marginLeft) || 0;
  let nextLeft = currentLeft + (left - rect.left);
  if (line instanceof HTMLElement) {
    nextLeft = Math.min(
      nextLeft,
      currentLeft + (getLineContentRight(line) - rect.right),
    );
  }
  nextLeft = Math.max(0, Math.round(nextLeft));
  if (Math.abs(nextLeft - currentLeft) >= 1) {
    element.style.marginLeft = nextLeft > 0 ? `${nextLeft}px` : "";
    rect = element.getBoundingClientRect();
  }

  const currentTop = parseFloat(element.style.marginTop) || 0;
  const nextTop = Math.max(0, Math.round(currentTop + (top - rect.top)));
  if (Math.abs(nextTop - currentTop) >= 1) {
    element.style.marginTop = nextTop > 0 ? `${nextTop}px` : "";
  }
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
  window.getSelection()?.removeAllRanges();

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

      const dropRect: Box = {
        left: dropLeft,
        top: dropTop,
        right: dropLeft + startRect.width,
        bottom: dropTop + startRect.height,
      };
      const unaffectedImages = snapshotUnaffectedImages(
        editor,
        wrapper,
        dropRect,
      );

      if (canMoveBetweenLines) {
        const rowTarget = getImageRowTarget(editor, wrapper, dropRect);
        const sourceLine = wrapper.closest(".detail-line");

        if (rowTarget) {
          moveImageWrapperIntoImageRow(
            editor,
            wrapper,
            rowTarget.line,
            rowTarget.beforeWrapper,
          );
        } else if (sourceLine instanceof HTMLElement) {
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

      wrapper.style.marginLeft = "";
      wrapper.style.marginTop = "";

      const snapshotRects = new Map(
        unaffectedImages.map(({ element, rect }) => [element, rect]),
      );
      for (const element of getImageWrappers(editor)) {
        if (element === wrapper) {
          pinImageTo(wrapper, dropLeft, dropTop);
          continue;
        }
        const rect = snapshotRects.get(element);
        if (rect) pinImageTo(element, rect.left, rect.top);
      }

      onComplete();
    } else if (onTap) {
      window.getSelection()?.removeAllRanges();
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
