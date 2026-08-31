"use client";

import { useMemo, useRef, useState } from "react";
import { CALENDAR_TODAY_DATE_CIRCLE_CLASS } from "@/lib/calendar-layout";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import type { TaskListItem } from "./todo-app";
import {
  buildTasksByDateForRange,
  type CalendarDateRange,
  type CalendarTaskOccurrence,
} from "@/lib/calendar-recurring-tasks";
import { CalendarMiniMonthDayPreview } from "./calendar-mini-month-day-preview";

const MINI_WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function getMondayFirstWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

export function getFullMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1, 12, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const padding = (firstDay.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from({ length: padding }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day, 12, 0, 0, 0));
  }

  return cells;
}

const MINI_CALENDAR_LOCALE = "en-US";

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(MINI_CALENDAR_LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatSelectedDay(date: Date) {
  return new Intl.DateTimeFormat(MINI_CALENDAR_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function buildTasksByDate(
  tasks: TaskListItem[],
  range?: CalendarDateRange,
) {
  if (!range) {
    const map = new Map<string, CalendarTaskOccurrence[]>();

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const date = fromDateKey(task.dueDate.slice(0, 10));
      if (!date) continue;

      const key = toDateKey(date);
      const existing = map.get(key) ?? [];
      existing.push({
        ...task,
        calendarOccurrenceDateKey: key,
      });
      map.set(key, existing);
    }

    return map;
  }

  return buildTasksByDateForRange(tasks, range);
}

export function getMonthCalendarRange(monthDate: Date): CalendarDateRange {
  const days = getFullMonthDays(
    monthDate.getFullYear(),
    monthDate.getMonth(),
  ).filter((day): day is Date => day !== null);

  if (days.length === 0) {
    const fallback = startOfDay(
      new Date(monthDate.getFullYear(), monthDate.getMonth(), 1),
    );
    return { start: fallback, end: fallback };
  }

  return {
    start: days[0],
    end: days[days.length - 1],
  };
}

export function CalendarMiniMonth({
  monthDate,
  selectedDate,
  today,
  tasksByDate,
  onPreviousMonth,
  onNextMonth,
  onGoToToday,
  onSelectDate,
}: {
  monthDate: Date;
  selectedDate: Date;
  today: Date;
  tasksByDate: Map<string, TaskListItem[]>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onSelectDate: (day: Date) => void;
}) {
  const [hoverPreview, setHoverPreview] = useState<{
    dateKey: string;
    day: Date;
    anchorRect: DOMRect;
  } | null>(null);
  const hidePreviewTimeoutRef = useRef<number | null>(null);

  function clearHidePreviewTimeout() {
    if (hidePreviewTimeoutRef.current !== null) {
      window.clearTimeout(hidePreviewTimeoutRef.current);
      hidePreviewTimeoutRef.current = null;
    }
  }

  function openDayPreview(day: Date, dateKey: string, anchor: HTMLElement) {
    clearHidePreviewTimeout();
    setHoverPreview({
      dateKey,
      day,
      anchorRect: anchor.getBoundingClientRect(),
    });
  }

  function scheduleCloseDayPreview() {
    clearHidePreviewTimeout();
    hidePreviewTimeoutRef.current = window.setTimeout(() => {
      setHoverPreview(null);
    }, 120);
  }

  const miniMonthDays = useMemo(
    () => getFullMonthDays(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate],
  );
  const todayWeekdayIndex = getMondayFirstWeekdayIndex(today);

  return (
    <div className="border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <h4 className="min-w-0 truncate text-[17.5px] font-semibold text-[#5f5f5f] dark:text-zinc-50">
          {formatMonthYear(monthDate)}
        </h4>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPreviousMonth}
            className="flex size-5 items-center justify-center rounded-full text-zinc-450 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <BiChevronLeft className="size-4" />
          </button>
     
          <button
            type="button"
            aria-label="Next month"
            onClick={onNextMonth}
            className="flex size-5 items-center justify-center rounded-full text-zinc-450 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <BiChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-visible">
        {MINI_WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className={`flex h-[21px] items-center justify-center text-[12px] ${
              index === todayWeekdayIndex
                ? "text-[#618fea] font-500 dark:text-[#7da2ff]"
                : "text-zinc-500"
            }`}
          >
            {label}
          </div>
        ))}

        {miniMonthDays.map((day, index) => {
          if (!day) {
            return <div key={`mini-empty-${index}`} className="h-7" />;
          }

          const dateKey = toDateKey(day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const hasTasks = dayTasks.length > 0;
          const showCircle = isToday || isSelected;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(day)}
              onMouseEnter={(event) => {
                if (hasTasks) {
                  openDayPreview(day, dateKey, event.currentTarget);
                }
              }}
              onMouseLeave={() => {
                if (hasTasks) {
                  scheduleCloseDayPreview();
                }
              }}
              aria-label={formatSelectedDay(day)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className="group relative flex h-7 flex-col items-center justify-end overflow-visible pb-0.5"
            >
              <span className="relative flex size-[25px] shrink-0 items-center justify-center cursor-pointer">
                {showCircle ? (
                  <span
                    className={`absolute inset-0 rounded-full transition-[box-shadow,transform] group-hover:scale-105 ${
                      isToday
                        ? CALENDAR_TODAY_DATE_CIRCLE_CLASS
                        : "bg-[#d6cece]"
                    }`}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="absolute inset-0 rounded-full bg-zinc-150 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-700/90"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`relative z-10 text-[12.5px] leading-none ${
                    showCircle
                      ? "font-semibold text-white"
                      : "text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {day.getDate()}
                </span>
              </span>
              {hasTasks ? (
                <span
                  className={`relative z-10 mt-0.5 size-[3px] shrink-0 -translate-y-[6px] rounded-full transition-opacity group-hover:opacity-0 ${
                    showCircle ? "" : "bg-[#d7dde9]"
                  }`}
                />
              ) : (
                <span
                  className="mt-0.5 size-[3px] shrink-0"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
      {hoverPreview && (tasksByDate.get(hoverPreview.dateKey)?.length ?? 0) > 0 ? (
        <CalendarMiniMonthDayPreview
          day={hoverPreview.day}
          tasks={tasksByDate.get(hoverPreview.dateKey) ?? []}
          anchorRect={hoverPreview.anchorRect}
          onMouseEnter={clearHidePreviewTimeout}
          onMouseLeave={scheduleCloseDayPreview}
        />
      ) : null}
    </div>
  );
}
