import type { CSSProperties } from "react";

export const CALENDAR_TASK_MODAL_GAP_PX = 8;
export const CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX = 24;
export const CALENDAR_TASK_MODAL_WIDTH_PX = 750;
export const CALENDAR_TASK_MODAL_MIN_HEIGHT_PX = 590;
/** Extra editor height so the note area fills the modal body (calendar view). */
export const CALENDAR_TASK_MODAL_EDITOR_MIN_HEIGHT_EXTRA_PX = 47;
/** Bottom action row height in the calendar task modal (icons vertically centered). */
export const CALENDAR_TASK_MODAL_FOOTER_MIN_HEIGHT_PX = 44;
/** Fade/blur out and in when navigating between tasks in the modal (each phase). */
export const CALENDAR_TASK_MODAL_CONTENT_SWITCH_MS = 125;
export const CALENDAR_TASK_MODAL_CONTENT_SWITCH_TOTAL_MS = 250;
export const CALENDAR_TASK_MODAL_MIN_WIDTH_PX = CALENDAR_TASK_MODAL_WIDTH_PX;
export const CALENDAR_TASK_MODAL_MAX_WIDTH_PX = CALENDAR_TASK_MODAL_WIDTH_PX;

/** Calendar task item -> task modal "resize" transition. */
export const CALENDAR_TASK_MODAL_OPEN_TRANSITION_MS = 100;
export const CALENDAR_TASK_MODAL_OPEN_TRANSITION_EASING =
  "cubic-bezier(0.22, 1, 0.36, 1)";
/** A remembered click origin is only valid for the modal that opens right after it. */
const CALENDAR_TASK_OPEN_ORIGIN_MAX_AGE_MS = 1000;

export type CalendarTaskModalAnchorRect = Pick<
  DOMRect,
  "top" | "left" | "right" | "bottom" | "width" | "height"
>;

export type CalendarTaskOpenOrigin = {
  rect: CalendarTaskModalAnchorRect;
  backgroundColor: string;
  borderRadius: string;
  capturedAt: number;
};

let lastCalendarTaskOpenOrigin: CalendarTaskOpenOrigin | null = null;

/**
 * Records the geometry/color of the calendar task item that was just activated
 * so the task modal can grow out of it. Call from a capture-phase listener so it
 * runs before the click handler opens the modal.
 */
export function rememberCalendarTaskOpenOrigin(target: EventTarget | null) {
  if (typeof window === "undefined" || !(target instanceof Element)) return;
  if (target.closest(".calendar-task-checkbox")) return;

  const item = target.closest<HTMLElement>(".calendar-task-item");
  if (!item) return;

  const rect = item.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const style = window.getComputedStyle(item);
  lastCalendarTaskOpenOrigin = {
    rect: {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    },
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderTopLeftRadius,
    capturedAt: performance.now(),
  };
}

/**
 * Returns the most recent click origin if it is fresh. Intentionally not
 * cleared on read so React Strict Mode's double effect run still animates.
 */
export function peekCalendarTaskOpenOrigin(): CalendarTaskOpenOrigin | null {
  if (!lastCalendarTaskOpenOrigin) return null;
  if (
    performance.now() - lastCalendarTaskOpenOrigin.capturedAt >
    CALENDAR_TASK_OPEN_ORIGIN_MAX_AGE_MS
  ) {
    lastCalendarTaskOpenOrigin = null;
    return null;
  }
  return lastCalendarTaskOpenOrigin;
}

/** Modal -> calendar task item "shrink" transition (mirror of the open transition). */
export const CALENDAR_TASK_MODAL_CLOSE_TRANSITION_MS = 160;
export const CALENDAR_TASK_MODAL_CLOSE_TRANSITION_EASING =
  "cubic-bezier(0.22, 1, 0.36, 1)";

/** Matches `CALENDAR_TASK_ID_DATA_ATTR` in `calendar-task-color-menu.tsx`. */
const CALENDAR_TASK_ID_ATTR = "data-calendar-task-id";

export type CalendarTaskCloseTarget = {
  rect: CalendarTaskModalAnchorRect;
  backgroundColor: string;
  borderRadius: string;
};

/**
 * Finds the on-screen calendar item for a task so the closing modal can shrink
 * back into it. Returns null when the item isn't rendered or is out of view.
 */
export function findCalendarTaskCloseTarget(
  taskId: string,
): CalendarTaskCloseTarget | null {
  if (typeof document === "undefined") return null;

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      `[${CALENDAR_TASK_ID_ATTR}="${CSS.escape(taskId)}"]`,
    ),
  );

  for (const candidate of candidates) {
    const item = candidate.matches(".calendar-task-item")
      ? candidate
      : candidate.closest<HTMLElement>(".calendar-task-item");
    if (!item) continue;

    const rect = item.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const isInViewport =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    if (!isInViewport) continue;

    const style = window.getComputedStyle(item);
    return {
      rect: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderTopLeftRadius,
    };
  }

  return null;
}

export function getCalendarTaskClickAnchorRect(
  element: HTMLElement,
): CalendarTaskModalAnchorRect {
  const anchor =
    element.closest<HTMLElement>("[data-calendar-timed-task-block]") ?? element;
  const rect = anchor.getBoundingClientRect();

  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function getCalendarTaskModalWidth(_viewportWidth = window.innerWidth) {
  return CALENDAR_TASK_MODAL_WIDTH_PX;
}

export function computeCalendarTaskModalStyle(
  anchorRect: CalendarTaskModalAnchorRect,
  modalWidth: number,
): CSSProperties {
  const gap = CALENDAR_TASK_MODAL_GAP_PX;
  const padding = CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;
  const placeAbove = anchorCenterY > viewportHeight / 2;

  let left = anchorRect.left + anchorRect.width / 2 - modalWidth / 2;
  left = Math.max(
    padding,
    Math.min(left, viewportWidth - modalWidth - padding),
  );

  if (placeAbove) {
    return {
      position: "fixed",
      left,
      bottom: viewportHeight - anchorRect.top + gap,
      width: modalWidth,
      maxHeight: Math.max(200, anchorRect.top - gap - padding),
    };
  }

  return {
    position: "fixed",
    left,
    top: anchorRect.bottom + gap,
    width: modalWidth,
    maxHeight: Math.max(
      200,
      viewportHeight - anchorRect.bottom - gap - padding,
    ),
  };
}
