"use client";

import {
  calendarAllDayTaskClassName,
  getCalendarTaskItemStyle,
} from "@/lib/calendar-layout";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import { CalendarTaskTitle } from "./calendar-task-title";

export function CalendarAllDayTaskPreview({
  taskName,
  priority,
  calendarColor,
  recurrenceRule,
  variant = "drop",
}: {
  taskName: string;
  priority?: number | null;
  calendarColor?: string | null;
  recurrenceRule?: string | null;
  variant?: "drop" | "source";
}) {
  const { defaultColor: calendarTaskDefaultColor } =
    useCalendarTaskDefaultColor();
  const previewClassName =
    variant === "source"
      ? "calendar-task-drag-source-placeholder"
      : "calendar-task-drop-preview";

  return (
    <div
      aria-hidden="true"
      className={`${calendarAllDayTaskClassName(
        false,
        false,
      )} calendar-task-row--single-line pointer-events-none select-none gap-1 overflow-hidden ${previewClassName}`}
      style={{
        ...getCalendarTaskItemStyle(
          priority,
          calendarColor,
          calendarTaskDefaultColor,
        ),
        ...(variant === "source" ? { backgroundColor: "transparent" } : null),
      }}
    >
      <CalendarTaskTitle
        name={taskName}
        recurrenceRule={recurrenceRule}
        priority={priority}
      />
    </div>
  );
}
