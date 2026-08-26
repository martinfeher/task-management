"use client";

import type { RefObject } from "react";
import { CALENDAR_TASK_BACKGROUND_CLASS, CALENDAR_TASK_FONT_CLASS, CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS, CALENDAR_TASK_TITLE_TEXT_CLASS } from "@/lib/calendar-layout";
import { bindCalendarNewTaskSlotDrag } from "@/lib/calendar-new-task-slot-drag";
import {
  CALENDAR_NEW_TASK_MARKER_DOT_CLASS,
  formatCalendarSlotTimeLabel,
  getCalendarNewTaskPreviewHeight,
  getCalendarNewTaskPreviewTop,
} from "@/lib/calendar-time-grid";

type CalendarNewTaskSlotPreviewProps = {
  slotTop: number;
  timeMinutes: number;
  hourHeightPx: number;
  hourStart: number;
  gridTopOffsetPx?: number;
  gridRef: RefObject<HTMLElement | null>;
  minMinutes: number;
  maxMinutes: number;
  label?: string;
  previewRef?: RefObject<HTMLDivElement | null>;
  onTimeChange: (minutes: number) => void;
};

export function CalendarNewTaskSlotPreview({
  slotTop,
  timeMinutes,
  hourHeightPx,
  hourStart,
  gridTopOffsetPx,
  gridRef,
  minMinutes,
  maxMinutes,
  label,
  previewRef,
  onTimeChange,
}: CalendarNewTaskSlotPreviewProps) {
  const top = getCalendarNewTaskPreviewTop(slotTop);
  const height = getCalendarNewTaskPreviewHeight(hourHeightPx);
  const displayLabel =
    label?.trim() || formatCalendarSlotTimeLabel(timeMinutes);

  return (
    <div
      ref={previewRef}
      aria-hidden="true"
      style={{ top, height }}
      className={`absolute ${CALENDAR_TASK_TIMED_COLUMN_INSET_CLASS} z-20 flex cursor-move touch-none items-center overflow-hidden rounded-[5px] px-[5px] text-left leading-none ${CALENDAR_TASK_BACKGROUND_CLASS} ${CALENDAR_TASK_TITLE_TEXT_CLASS} ${CALENDAR_TASK_FONT_CLASS}`}
      onPointerDown={(event) => {
        const grid = gridRef.current;
        if (!grid) return;

        bindCalendarNewTaskSlotDrag(event, {
          grid,
          hourStart,
          hourHeightPx,
          gridTopOffsetPx,
          minMinutes,
          maxMinutes,
          onTimeChange,
        });
      }}
    >
      <span className="min-w-0 truncate">{displayLabel}</span>
      <span
        className={`${CALENDAR_NEW_TASK_MARKER_DOT_CLASS} top-1/2 -translate-y-1/2`}
      />
    </div>
  );
}
