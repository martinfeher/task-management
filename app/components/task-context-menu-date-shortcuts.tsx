"use client";

import { useId, type MouseEvent, type ReactNode } from "react";
import { BsCalendarPlus } from "react-icons/bs";
import { CgCalendarNext } from "react-icons/cg";
import { LuCalendarX2 } from "react-icons/lu";
import {
  getNextWeekendSaturdayDate,
  getNextWeekendSaturdayDateKey,
  getTodayDateKey,
  getTomorrowDateKey,
} from "@/lib/task-due-date";
import { TodayCalendarIcon } from "./today-calendar-icon";

type TaskContextMenuDateShortcutsProps = {
  hasDueDate?: boolean;
  onSelectDate: (dateValue: string) => void;
  onOpenCustomDatePicker: () => void;
  onClearDate?: () => void;
};

const DATE_SHORTCUT_ICON_SLOT_CLASS =
  "flex size-[22px] shrink-0 items-center justify-center [&_svg]:block [&_svg]:size-full";

const DATE_SHORTCUT_STACKED_SLOT_CLASS =
  "flex w-[22px] shrink-0 flex-col items-center justify-center gap-0 [&_svg]:block [&_svg]:size-[22px]";

function DateShortcutButton({
  label,
  tooltipId,
  tooltipAlign = "center",
  stacked = false,
  onClick,
  children,
}: {
  label: string;
  tooltipId: string;
  tooltipAlign?: "start" | "center" | "end";
  stacked?: boolean;
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
    <div className="group/date-option relative cursor-pointer mx-1">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        className="flex cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        onClick={onClick}
      >
        <span
          className={
            stacked
              ? DATE_SHORTCUT_STACKED_SLOT_CLASS
              : DATE_SHORTCUT_ICON_SLOT_CLASS
          }
        >
          {children}
        </span>
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
  hasDueDate = false,
  onSelectDate,
  onOpenCustomDatePicker,
  onClearDate,
}: TaskContextMenuDateShortcutsProps) {
  const todayDay = new Date().getDate();
  const nextWeekendDay = getNextWeekendSaturdayDate().getDate();
  const tooltipBaseId = useId();

  return (
    <div className="overflow-visible px-3 pt-[6px]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium text-zinc-350 dark:text-zinc-500">
          Date
        </div>
        {hasDueDate ? (
          <div className="group relative cursor-pointer">
            <button
              type="button"
              aria-label="Clear date"
              aria-describedby={`${tooltipBaseId}-clear-date`}
              className="flex gap-1 pr-[6px] cursor-pointer text-[11px] font-medium text-[#c8c1b6] transition-colors group-hover:text-zinc-500 dark:hover:text-zinc-300"
              onClick={(event) => {
                event.stopPropagation();
                onClearDate?.();
              }}
            >
              Clear{" "}
              <LuCalendarX2 className="mt-[3px] size-[10px] text-[#c8c1b6] group-hover:text-zinc-500" />
            </button>
            <span
              id={`${tooltipBaseId}-clear-date`}
              role="tooltip"
              className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+6px)] right-0 left-auto z-50 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/clear-date:opacity-100 task-context-menu-tooltip-end"
            >
              Clear date
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex min-h-8 items-center justify-between overflow-visible">
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
            strokeWidth={0.8}
            className="text-[#8b8d92]"
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
          <CgCalendarNext 
            className="text-[#adaeb2]! size-[24px]! mt-px"
            strokeWidth={0.05}
          />
        </DateShortcutButton>
        <DateShortcutButton
          label="Next weekend"
          tooltipId={`${tooltipBaseId}-next-weekend`}
          stacked
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(getNextWeekendSaturdayDateKey());
          }}
        >
          <TodayCalendarIcon
            day={nextWeekendDay}
            strokeWidth={0.8}
            className="text-[#8b8d92]"
          />
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
          <BsCalendarPlus
            className="text-[#acafb4] size-[17px]! mt-[1px]!"
            strokeWidth={0.5}
          />
        </DateShortcutButton>
      </div>
    </div>
  );
}
