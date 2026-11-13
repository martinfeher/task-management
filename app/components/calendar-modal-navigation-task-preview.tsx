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

function clampNavigationPreviewPosition(
  anchorRect: DOMRect,
): { left: number; top: number } {
  const width = CALENDAR_TASK_HOVER_PREVIEW_WIDTH_PX;
  let left = anchorRect.left + anchorRect.width / 2 - width / 2;
  let top = anchorRect.bottom + 8;

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
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onOpenTask: (taskId: string) => void;
};

export function CalendarModalNavigationTaskPreview({
  task,
  anchorRect,
  onPointerEnter,
  onPointerLeave,
  onOpenTask,
}: CalendarModalNavigationTaskPreviewProps) {
  const [previewTask, setPreviewTask] = useState(task);
  const [position, setPosition] = useState(() =>
    clampNavigationPreviewPosition(anchorRect),
  );

  useLayoutEffect(() => {
    setPosition(clampNavigationPreviewPosition(anchorRect));
  }, [anchorRect]);

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
      setPosition(clampNavigationPreviewPosition(anchorRect));
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [anchorRect]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="calendar-task-hover-preview calendar-modal-navigation-task-preview pointer-events-auto fixed z-[10060] cursor-pointer overflow-hidden bg-white/[0.6] shadow-[0_10px_23px_rgba(0,0,0,0.09)] ring-1 ring-zinc-200/80 backdrop-blur-[4px] transition-shadow hover:shadow-[0_12px_26px_rgba(0,0,0,0.12)] dark:bg-zinc-950/[0.6] dark:ring-zinc-800"
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
