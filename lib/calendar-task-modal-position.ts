import type { CSSProperties } from "react";

export const CALENDAR_TASK_MODAL_GAP_PX = 8;
export const CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX = 24;
export const CALENDAR_TASK_MODAL_MIN_WIDTH_PX = 600;
export const CALENDAR_TASK_MODAL_MAX_WIDTH_PX = 896;

export type CalendarTaskModalAnchorRect = Pick<
  DOMRect,
  "top" | "left" | "right" | "bottom" | "width" | "height"
>;

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

export function getCalendarTaskModalWidth(viewportWidth = window.innerWidth) {
  const padding = CALENDAR_TASK_MODAL_VIEWPORT_PADDING_PX * 2;
  return Math.min(
    CALENDAR_TASK_MODAL_MAX_WIDTH_PX,
    Math.max(
      CALENDAR_TASK_MODAL_MIN_WIDTH_PX,
      viewportWidth - padding,
    ),
  );
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
