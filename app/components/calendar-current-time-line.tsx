import type { CSSProperties } from "react";
import { CALENDAR_HOUR_COLUMN_WIDTH_PX } from "@/lib/calendar-layout";

const CALENDAR_NOW_LINE_COLOR = "#9d9d9d";
const CALENDAR_NOW_LINE_STYLE: CSSProperties = {
  backgroundColor: CALENDAR_NOW_LINE_COLOR,
  opacity: 0.5,
};
const CALENDAR_NOW_LABEL_BG = "#BBBBBB";

export function formatCalendarCurrentTimeLabel(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
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
}: CalendarCurrentTimeLineProps) {
  const showAccentColumns =
    variant === "accent" &&
    todayColumnIndex !== undefined &&
    todayColumnIndex >= 0 &&
    columnCount > 0;

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

            return (
              <div key={index} className="relative flex min-w-0 items-center">
                {isToday ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="absolute left-0 size-2 -translate-x-1/2 rounded-full"
                      style={CALENDAR_NOW_LINE_STYLE}
                    />
                    <div className="h-px min-w-0 flex-1" style={CALENDAR_NOW_LINE_STYLE} />
                  </>
                ) : (
                  <div className="h-px w-full" style={CALENDAR_NOW_LINE_STYLE} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-px min-w-0 flex-1" style={CALENDAR_NOW_LINE_STYLE} />
      )}
    </div>
  );
}
