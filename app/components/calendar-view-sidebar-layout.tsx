"use client";

import { useMemo } from "react";
import type { TaskListItem } from "./todo-app";
import {
  CalendarMiniMonth,
  buildTasksByDate,
  startOfDay,
} from "./calendar-mini-month";

export type CalendarSidebarSyncProps = {
  sidebarFocusDate?: Date;
  sidebarJumpRequestId?: number;
  onSidebarFocusDateChange?: (date: Date) => void;
};

type CalendarViewSidebarLayoutProps = {
  tasks: TaskListItem[];
  focusDate: Date;
  monthDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
  onSelectDate: (date: Date) => void;
  children: React.ReactNode;
};

export function CalendarViewSidebarLayout({
  tasks,
  focusDate,
  monthDate,
  onPreviousMonth,
  onNextMonth,
  onGoToToday,
  onSelectDate,
  children,
}: CalendarViewSidebarLayoutProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const tasksByDate = useMemo(() => buildTasksByDate(tasks), [tasks]);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <CalendarMiniMonth
          monthDate={monthDate}
          selectedDate={focusDate}
          today={today}
          tasksByDate={tasksByDate}
          onPreviousMonth={onPreviousMonth}
          onNextMonth={onNextMonth}
          onGoToToday={onGoToToday}
          onSelectDate={onSelectDate}
        />
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
