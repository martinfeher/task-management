import { getTopForCalendarMinutes } from "@/lib/calendar-time-grid";

export const CALENDAR_NOW_LINE_OPACITY = 0.5;
export const CALENDAR_NOW_LINE_OVER_TASK_OPACITY = 0.3;

export type CalendarTimedBlockBounds = {
  top: number;
  height: number;
};

export function getCalendarTimedBlockBounds(
  dueTimeMinutes: number,
  dueDurationMinutes: number,
  hourStart: number,
  hourHeightPx: number,
  gridTopOffsetPx: number,
): CalendarTimedBlockBounds {
  const top = getTopForCalendarMinutes(
    dueTimeMinutes,
    hourStart,
    hourHeightPx,
    gridTopOffsetPx,
  );
  const height = Math.max(24, (dueDurationMinutes / 60) * hourHeightPx);

  return { top, height };
}

export function calendarNowLineIntersectsBlock(
  nowLineTopPx: number,
  block: CalendarTimedBlockBounds,
): boolean {
  return (
    nowLineTopPx >= block.top && nowLineTopPx <= block.top + block.height
  );
}

export function calendarNowLineIntersectsAnyBlock(
  nowLineTopPx: number,
  blocks: CalendarTimedBlockBounds[],
): boolean {
  return blocks.some((block) =>
    calendarNowLineIntersectsBlock(nowLineTopPx, block),
  );
}

export function buildCalendarNowLineDimmedColumns(
  nowLineTopPx: number | null,
  blocksPerColumn: CalendarTimedBlockBounds[][],
): boolean[] | undefined {
  if (nowLineTopPx === null) return undefined;

  return blocksPerColumn.map((blocks) =>
    calendarNowLineIntersectsAnyBlock(nowLineTopPx, blocks),
  );
}
