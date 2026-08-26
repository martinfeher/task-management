"use client";

import { BiSun } from "react-icons/bi";
import {
  getNextWeekendSaturdayDateKey,
  getTodayDateKey,
  getTomorrowDateKey,
} from "@/lib/task-due-date";
import { TodayCalendarIcon } from "./today-calendar-icon";

type TaskContextMenuDateShortcutsProps = {
  onSelectDate: (dateValue: string) => void;
  onOpenCustomDatePicker: () => void;
};

function WeekendSofaIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.5 11.5V9.75C5.5 8.23 6.73 7 8.25 7h7.5c1.52 0 2.75 1.23 2.75 2.75V11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 11.5h14v3.25c0 .97-.78 1.75-1.75 1.75h-1.5M5 11.5v3.25c0 .97.78 1.75 1.75 1.75h1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.25 16.5V18M15.75 16.5V18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CustomDateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="6" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="12" r="1.35" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function TaskContextMenuDateShortcuts({
  onSelectDate,
  onOpenCustomDatePicker,
}: TaskContextMenuDateShortcutsProps) {
  const todayDay = new Date().getDate();

  return (
    <div className="px-3 py-2">
      <div className="mb-2 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        Date
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Set date to today"
          title="Today"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getTodayDateKey());
          }}
        >
          <TodayCalendarIcon
            day={todayDay}
            className="size-[22px] text-emerald-500"
          />
        </button>
        <button
          type="button"
          aria-label="Set date to tomorrow"
          title="Tomorrow"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getTomorrowDateKey());
          }}
        >
          <BiSun className="size-[22px] text-amber-600" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Set date to next weekend"
          title="Next weekend"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getNextWeekendSaturdayDateKey());
          }}
        >
          <WeekendSofaIcon className="size-[22px] text-[#5b8def]" />
        </button>
        <button
          type="button"
          aria-label="Pick a custom date"
          title="Pick date"
          className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCustomDatePicker();
          }}
        >
          <CustomDateIcon className="size-[22px] text-zinc-400" />
        </button>
      </div>
    </div>
  );
}
