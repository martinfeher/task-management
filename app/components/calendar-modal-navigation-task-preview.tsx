"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { TaskListItem } from "./todo-app";
import {
  CALENDAR_TASK_HOVER_PREVIEW_WIDTH_PX,
  CalendarTaskHoverPreviewCard,
  resolveCalendarTaskPreviewTask,
} from "./calendar-task-hover-preview";

const PREVIEW_ESTIMATED_HEIGHT = 240;
const PREVIEW_VIEWPORT_PADDING_PX = 8;
const MODAL_NAVIGATION_PREVIEW_OFFSET_X_PX = 20;
const SIDEBAR_TASK_PREVIEW_GAP_PX = 9;
const SIDEBAR_TASK_PREVIEW_OFFSET_Y_PX = 60;

export type CalendarNavigationTaskPreviewPlacement =
  | "modal-navigation"
  | "sidebar-task";

function clampNavigationPreviewPosition(
  anchorRect: DOMRect,
  placement: CalendarNavigationTaskPreviewPlacement,
  sidebarPosition: "left" | "right",
): { left: number; top: number } {
  const width = CALENDAR_TASK_HOVER_PREVIEW_WIDTH_PX;
  let left: number;
  let top: number;

  if (placement === "sidebar-task") {
    left =
      sidebarPosition === "right"
        ? anchorRect.left - width - SIDEBAR_TASK_PREVIEW_GAP_PX
        : anchorRect.right + SIDEBAR_TASK_PREVIEW_GAP_PX;
    top =
      anchorRect.top +
      anchorRect.height / 2 -
      PREVIEW_ESTIMATED_HEIGHT / 2 +
      SIDEBAR_TASK_PREVIEW_OFFSET_Y_PX;
  } else {
    left =
      anchorRect.left +
      anchorRect.width / 2 -
      width / 2 +
      MODAL_NAVIGATION_PREVIEW_OFFSET_X_PX;
    top = anchorRect.bottom + 8;
  }

  if (typeof window !== "undefined") {
    left = Math.max(
      PREVIEW_VIEWPORT_PADDING_PX,
      Math.min(left, window.innerWidth - width - PREVIEW_VIEWPORT_PADDING_PX),
    );
    const maxTop =
      window.innerHeight - PREVIEW_ESTIMATED_HEIGHT - PREVIEW_VIEWPORT_PADDING_PX;
    top = Math.max(PREVIEW_VIEWPORT_PADDING_PX, Math.min(top, maxTop));
  }

  return { left, top };
}

type CalendarModalNavigationTaskPreviewProps = {
  task: TaskListItem;
  anchorRect: DOMRect;
  placement?: CalendarNavigationTaskPreviewPlacement;
  sidebarPosition?: "left" | "right";
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onOpenTask: (taskId: string) => void;
};

export function CalendarModalNavigationTaskPreview({
  task,
  anchorRect,
  placement = "modal-navigation",
  sidebarPosition = "right",
  onPointerEnter,
  onPointerLeave,
  onOpenTask,
}: CalendarModalNavigationTaskPreviewProps) {
  const [previewTask, setPreviewTask] = useState(task);
  const [position, setPosition] = useState(() =>
    clampNavigationPreviewPosition(anchorRect, placement, sidebarPosition),
  );

  useLayoutEffect(() => {
    setPosition(
      clampNavigationPreviewPosition(anchorRect, placement, sidebarPosition),
    );
  }, [anchorRect, placement, sidebarPosition]);

  useEffect(() => {
    let cancelled = false;
    setPreviewTask(task);

    void resolveCalendarTaskPreviewTask(task).then((resolved) => {
      if (!cancelled) setPreviewTask(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [task]);

  useEffect(() => {
    function handleReposition() {
      setPosition(
        clampNavigationPreviewPosition(anchorRect, placement, sidebarPosition),
      );
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [anchorRect, placement, sidebarPosition]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="calendar-task-hover-preview calendar-modal-navigation-task-preview pointer-events-auto fixed z-[10060] cursor-pointer overflow-hidden frosted-popover-surface transition-shadow hover:shadow-[0_12px_26px_rgba(0,0,0,0.12)]"
      style={{
        width: CALENDAR_TASK_HOVER_PREVIEW_WIDTH_PX,
        left: position.left,
        top: position.top,
      }}
      role="button"
      tabIndex={-1}
      aria-label={`Open task: ${previewTask.name}`}
      onMouseEnter={onPointerEnter}
      onMouseLeave={onPointerLeave}
      onClick={() => onOpenTask(previewTask.id)}
    >
      <CalendarTaskHoverPreviewCard task={previewTask} />
    </div>,
    document.body,
  );
}