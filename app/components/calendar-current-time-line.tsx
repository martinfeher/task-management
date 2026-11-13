import type { CSSProperties } from "react";
import { CALENDAR_HOUR_COLUMN_WIDTH_PX } from "@/lib/calendar-layout";
import {
  CALENDAR_NOW_LINE_OPACITY,
  CALENDAR_NOW_LINE_OVER_TASK_OPACITY,
} from "@/lib/calendar-now-line-overlap";

export const CALENDAR_NOW_LINE_COLOR = "#3FAF79";
const CALENDAR_NOW_LABEL_BG = "#3FAF79";

export function formatCalendarCurrentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function calendarNowLineStyle(opacity: number): CSSProperties {
  return {
    backgroundColor: CALENDAR_NOW_LINE_COLOR,
    opacity,
  };
}

type CalendarCurrentTimeLineProps = {
  now: Date;
  top: number;
  labelColumnWidth?: number;
  className?: string;
  style?: CSSProperties;
  showLabel?: boolean;
  variant?: "default" | "accent";
  todayColumnIndex?: number;
  columnCount?: number;
  /** When true, task-column segments use reduced opacity (single-column day view). */
  dimTaskColumn?: boolean;
  /** Per-column dimming for week / multi-day grids (same length as `columnCount`). */
  dimmedColumns?: boolean[];
  lineOpacity?: number;
  overTaskLineOpacity?: number;
};

export function CalendarCurrentTimeLine({
  now,
  top,
  labelColumnWidth = CALENDAR_HOUR_COLUMN_WIDTH_PX,
  className = "absolute inset-x-0 z-20",
  style,
  showLabel = true,
  variant = "default",
  todayColumnIndex,
  columnCount = 1,
  dimTaskColumn = false,
  dimmedColumns,
  lineOpacity = CALENDAR_NOW_LINE_OPACITY,
  overTaskLineOpacity = CALENDAR_NOW_LINE_OVER_TASK_OPACITY,
}: CalendarCurrentTimeLineProps) {
  const showAccentColumns =
    variant === "accent" &&
    todayColumnIndex !== undefined &&
    todayColumnIndex >= 0 &&
    columnCount > 0;

  const taskColumnOpacity = dimTaskColumn ? overTaskLineOpacity : lineOpacity;

  return (
    <div
      className={`pointer-events-none flex items-center ${className}`}
      style={{ top, ...style }}
    >
      <div
        className="flex shrink-0 justify-center px-1"
        style={{ width: labelColumnWidth }}
      >
        {showLabel ? (
          <span
            className={
              showAccentColumns
                ? "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-white"
                : "rounded-[6px] px-[7px] py-1 text-[11px] font-semibold tabular-nums leading-none text-white"
            }
            style={{ backgroundColor: CALENDAR_NOW_LABEL_BG }}
          >
            {formatCalendarCurrentTimeLabel(now)}
          </span>
        ) : null}
      </div>

      {showAccentColumns ? (
        <div
          className="grid min-w-0 flex-1"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columnCount }, (_, index) => {
            const isToday = index === todayColumnIndex;
            const columnDimmed = dimmedColumns?.[index] ?? false;
            const columnLineOpacity = columnDimmed
              ? overTaskLineOpacity
              : lineOpacity;

            return (
              <div key={index} className="relative flex min-w-0 items-center">
                {isToday ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute left-0 size-2 -translate-x-1/2 rounded-full"
                      style={calendarNowLineStyle(columnLineOpacity)}
                    />
                    <div
                      className="h-px min-w-0 flex-1"
                      style={calendarNowLineStyle(columnLineOpacity)}
                    />
                  </>
                ) : (
                  <div
                    className="h-px w-full"
                    style={calendarNowLineStyle(columnLineOpacity)}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="h-px min-w-0 flex-1"
          style={calendarNowLineStyle(taskColumnOpacity)}
        />
      )}
    </div>
  );
}

type CalendarMonthCellCurrentTimeLineProps = {
  top: number;
  left: number;
  width: number;
  lineOpacity?: number;
};

/** Now indicator confined to a single day cell (month grid). */
export function CalendarMonthCellCurrentTimeLine({
  top,
  left,
  width,
  lineOpacity = CALENDAR_NOW_LINE_OPACITY,
}: CalendarMonthCellCurrentTimeLineProps) {
  const lineStyle = calendarNowLineStyle(lineOpacity);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 flex items-center"
      style={{ top, left, width }}
    >
      <span
        className="absolute left-0 size-2 -translate-x-1/2 rounded-full"
        style={lineStyle}
      />
      <div className="h-px min-w-0 w-full" style={lineStyle} />
    </div>
  );
}
