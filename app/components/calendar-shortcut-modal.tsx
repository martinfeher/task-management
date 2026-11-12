"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";
import {
  readCalendarViewSession,
  resolveCalendarViewSession,
  patchCalendarViewSession,
  type CalendarViewSession,
  type CalendarViewTab,
} from "@/lib/calendar-view-settings";
import { readCalendarDefaultViewPreferenceFromStorage } from "@/lib/calendar-default-view-settings";
import { resolveCalendarEntryActiveView } from "@/lib/resolve-calendar-entry-view";
import type { TaskListItem } from "./todo-app";
import { CalendarPanel } from "./calendar-panel";
import { CalendarExpandIcon } from "./calendar-expand-icon";
import type { ComponentProps } from "react";

type CalendarPanelProps = ComponentProps<typeof CalendarPanel>;

type CalendarShortcutModalProps = {
  open: boolean;
  onClose: () => void;
  onExpandToFullPage?: (session: CalendarViewSession) => void;
  calendarEntryTasks?: TaskListItem[];
} & Omit<
  CalendarPanelProps,
  | "view"
  | "onViewChange"
  | "multiDayCount"
  | "multiWeekCount"
  | "onMultiDayCountChange"
  | "onMultiWeekCountChange"
  | "persistViewSession"
  | "defaultView"
>;

export function CalendarShortcutModal({
  open,
  onClose,
  onExpandToFullPage,
  calendarEntryTasks = [],
  ...calendarPanelProps
}: CalendarShortcutModalProps) {
  const [view, setView] = useState<CalendarViewTab>("week");
  const [multiDayCount, setMultiDayCount] = useState(3);
  const [multiWeekCount, setMultiWeekCount] = useState(2);

  useEffect(() => {
    if (!open) return;

    const session = resolveCalendarViewSession(readCalendarViewSession());
    const activeView = resolveCalendarEntryActiveView(
      readCalendarDefaultViewPreferenceFromStorage(),
      calendarEntryTasks,
      session,
    );
    setView(activeView);
    setMultiDayCount(session.multiDayCount);
    setMultiWeekCount(session.multiWeekCount);
  }, [calendarEntryTasks, open]);

  const handleClose = useCallback(() => {
    patchCalendarViewSession({
      activeView: view,
      multiDayCount,
      multiWeekCount,
    });
    onClose();
  }, [multiDayCount, multiWeekCount, onClose, view]);

  const handleExpandToFullPage = useCallback(() => {
    const session: CalendarViewSession = {
      activeView: view,
      multiDayCount,
      multiWeekCount,
    };
    patchCalendarViewSession(session);
    onExpandToFullPage?.(
      resolveCalendarViewSession(readCalendarViewSession()),
    );
    onClose();
  }, [multiDayCount, multiWeekCount, onClose, onExpandToFullPage, view]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector(".calendar-task-modal")) return;

      handleClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Close calendar"
        className="absolute inset-0 bg-zinc-900/30 backdrop-brightness-[0.98]"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Calendar"
        className="absolute inset-10 z-10 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-[#fbfbfc] shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close calendar"
          onClick={handleClose}
          className="absolute top-[3px] right-[3px] z-[2100] flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-[#e8e8e8] hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <LuX className="size-4" />
        </button>
        <div className="flex min-h-0 px-2 pb-2 pt-1 flex-1 flex-col overflow-hidden">
          <CalendarPanel
            {...calendarPanelProps}
            embeddedInCalendarModal
            periodLabelAction={
              onExpandToFullPage ? (
                <button
                  type="button"
                  aria-label="Open calendar full page"
                  title="Open calendar full page"
                  onClick={handleExpandToFullPage}
                  className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <CalendarExpandIcon className="size-[18px]" />
                </button>
              ) : undefined
            }
            view={view}
            onViewChange={setView}
            multiDayCount={multiDayCount}
            multiWeekCount={multiWeekCount}
            onMultiDayCountChange={setMultiDayCount}
            onMultiWeekCountChange={setMultiWeekCount}
            persistViewSession={false}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
