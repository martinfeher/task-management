"use client";

import { useId, type MouseEvent, type ReactNode } from "react";
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

function DateShortcutButton({
  label,
  tooltipId,
  tooltipAlign = "center",
  onClick,
  children,
}: {
  label: string;
  tooltipId: string;
  tooltipAlign?: "start" | "center" | "end";
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const tooltipPositionClass =
    tooltipAlign === "start"
      ? "left-0 task-context-menu-tooltip-start"
      : tooltipAlign === "end"
        ? "right-0 left-auto task-context-menu-tooltip-end"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="group/date-option relative cursor-pointer">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={onClick}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+6px)] z-50 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/date-option:opacity-100 ${tooltipPositionClass}`}
      >
        {label}
      </span>
    </div>
  );
}

export function TaskContextMenuDateShortcuts({
  onSelectDate,
  onOpenCustomDatePicker,
}: TaskContextMenuDateShortcutsProps) {
  const todayDay = new Date().getDate();
  const tooltipBaseId = useId();

  return (
    <div className="overflow-visible px-3 pt-[6px]">
      <div className="mb-[1px] text-[11px] font-medium text-zinc-350 dark:text-zinc-500">
        Date
      </div>
      <div className="flex items-center justify-between overflow-visible">
        <DateShortcutButton
          label="Today"
          tooltipId={`${tooltipBaseId}-today`}
          tooltipAlign="start"
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getTodayDateKey());
          }}
        >
          <TodayCalendarIcon
            day={todayDay}
            className="size-[22px] text-emerald-500"
          />
        </DateShortcutButton>
        <DateShortcutButton
          label="Tomorrow"
          tooltipId={`${tooltipBaseId}-tomorrow`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getTomorrowDateKey());
          }}
        >
          <BiSun className="size-[22px] text-amber-600" aria-hidden="true" />
        </DateShortcutButton>
        <DateShortcutButton
          label="Next weekend"
          tooltipId={`${tooltipBaseId}-next-weekend`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getNextWeekendSaturdayDateKey());
          }}
        >
          <WeekendSofaIcon className="size-[22px] text-[#5b8def]" />
        </DateShortcutButton>
        <DateShortcutButton
          label="Custom date"
          tooltipId={`${tooltipBaseId}-custom-date`}
          tooltipAlign="end"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCustomDatePicker();
          }}
        >
          <CustomDateIcon className="size-[22px] text-zinc-400" />
        </DateShortcutButton>
      </div>
    </div>
  );
}
