"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  formatDueTimeLabel,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";
import { getCalendarTaskKey } from "@/lib/calendar-recurring-tasks";
import type { TaskListItem } from "./todo-app";

const PREVIEW_LOCALE = "en-US";

function formatPreviewWeekday(date: Date) {
  return new Intl.DateTimeFormat(PREVIEW_LOCALE, {
    weekday: "long",
  })
    .format(date)
    .toUpperCase();
}

function formatPreviewDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function compareTasksByTime(a: TaskListItem, b: TaskListItem) {
  const aMinutes = normalizeDueTimeMinutes(a.dueTimeMinutes);
  const bMinutes = normalizeDueTimeMinutes(b.dueTimeMinutes);

  if (aMinutes === null && bMinutes === null) {
    return a.name.localeCompare(b.name);
  }
  if (aMinutes === null) return 1;
  if (bMinutes === null) return -1;
  if (aMinutes !== bMinutes) return aMinutes - bMinutes;

  return a.name.localeCompare(b.name);
}

type CalendarMiniMonthDayPreviewProps = {
  day: Date;
  tasks: TaskListItem[];
  anchorRect: DOMRect;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export function CalendarMiniMonthDayPreview({
  day,
  tasks,
  anchorRect,
  onMouseEnter,
  onMouseLeave,
}: CalendarMiniMonthDayPreviewProps) {
  const [position, setPosition] = useState<{ top: number; left: number }>(() => ({
    top: anchorRect.bottom + 8,
    left: anchorRect.left + anchorRect.width / 2,
  }));

  useEffect(() => {
    function updatePosition() {
      const previewWidth = 240;
      const margin = 8;
      let left = anchorRect.left + anchorRect.width / 2;
      const top = anchorRect.bottom + 8;

      const minLeft = previewWidth / 2 + margin;
      const maxLeft = window.innerWidth - previewWidth / 2 - margin;
      left = Math.min(Math.max(left, minLeft), maxLeft);

      setPosition({ top, left });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRect]);

  const sortedTasks = [...tasks].sort(compareTasksByTime);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed z-[200] -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="calendar-task-hover-preview pointer-events-auto w-[240px] max-w-[calc(100vw-16px)] overflow-hidden bg-white dark:bg-zinc-950"
        role="tooltip"
      >
        <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
          <span className="text-[11px] font-bold tracking-[0.02em] text-zinc-900 dark:text-zinc-50">
            {formatPreviewWeekday(day)}
          </span>
          <span className="ml-2 text-[11px] font-normal text-zinc-400 dark:text-zinc-500">
            {formatPreviewDate(day)}
          </span>
        </div>
        <ul className="max-h-[220px] overflow-y-auto px-4 py-2">
          {sortedTasks.map((task) => {
            const timeLabel = formatDueTimeLabel(task.dueTimeMinutes);

            return (
              <li key={getCalendarTaskKey(task)} className="py-1.5">
                <p className="truncate text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                  {task.name}
                </p>
                {timeLabel ? (
                  <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">
                    {timeLabel}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
