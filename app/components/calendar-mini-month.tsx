"use client";

import { useMemo } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import type { TaskListItem } from "./todo-app";

const MINI_WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

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

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatSelectedDay(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function buildTasksByDate(tasks: TaskListItem[]) {
  const map = new Map<string, TaskListItem[]>();

  for (const task of tasks) {
    if (!task.dueDate) continue;

    const date = fromDateKey(task.dueDate.slice(0, 10));
    if (!date) continue;

    const key = toDateKey(date);
    const existing = map.get(key) ?? [];
    existing.push(task);
    map.set(key, existing);
  }

  return map;
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
  const miniMonthDays = useMemo(
    () => getFullMonthDays(monthDate.getFullYear(), monthDate.getMonth()),
    [monthDate],
  );

  return (
    <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {formatMonthYear(monthDate)}
        </h4>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={onPreviousMonth}
            className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <BiChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Go to today"
            onClick={onGoToToday}
            className="flex size-7 items-center justify-center rounded-md text-[11px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <span className="size-2 rounded-full border border-current" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={onNextMonth}
            className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <BiChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {MINI_WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex h-7 items-center justify-center text-[10px] font-medium text-zinc-400"
          >
            {label}
          </div>
        ))}

        {miniMonthDays.map((day, index) => {
          if (!day) {
            return <div key={`mini-empty-${index}`} className="h-8" />;
          }

          const dateKey = toDateKey(day);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const hasTasks = (tasksByDate.get(dateKey)?.length ?? 0) > 0;

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(day)}
              aria-label={formatSelectedDay(day)}
              aria-pressed={isSelected}
              className="flex h-8 flex-col items-center justify-center rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-[11px] ${
                  isSelected
                    ? "bg-[#4873c7] font-semibold text-white"
                    : isToday
                      ? "font-semibold text-[#4873c7]"
                      : "text-zinc-700 dark:text-zinc-200"
                }`}
              >
                {day.getDate()}
              </span>
              {hasTasks ? (
                <span
                  className={`mt-0.5 size-1 rounded-full ${
                    isSelected ? "bg-white/90" : "bg-[#4873c7]"
                  }`}
                />
              ) : (
                <span className="mt-0.5 size-1" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
