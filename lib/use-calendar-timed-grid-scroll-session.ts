"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  patchCalendarViewSession,
  readCalendarViewSession,
  type CalendarViewTab,
} from "@/lib/calendar-view-settings";

const SCROLL_SAVE_DEBOUNCE_MS = 120;

export function readStoredCalendarTimedGridScrollTop(view: CalendarViewTab) {
  const stored = readCalendarViewSession();
  const byView = stored?.timedGridScrollTopByView;
  if (!byView) return null;

  const scrollTop = byView[view];
  if (typeof scrollTop !== "number" || !Number.isFinite(scrollTop) || scrollTop < 0) {
    return null;
  }

  return scrollTop;
}

export function useCalendarTimedGridScrollSession(
  scrollRef: RefObject<HTMLElement | null>,
  view: CalendarViewTab,
  ready: boolean,
) {
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!ready || restoredRef.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const savedScrollTop = readStoredCalendarTimedGridScrollTop(view);
    restoredRef.current = true;
    if (savedScrollTop !== null) {
      el.scrollTop = savedScrollTop;
    }
  }, [ready, scrollRef, view]);

  useEffect(() => {
    if (!ready) return;

    const el = scrollRef.current;
    if (!el) return;

    function persistScrollTop() {
      const stored = readCalendarViewSession();
      patchCalendarViewSession({
        timedGridScrollTopByView: {
          ...(stored?.timedGridScrollTopByView ?? {}),
          [view]: el!.scrollTop,
        },
      });
    }

    const onScroll = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        persistScrollTop();
      }, SCROLL_SAVE_DEBOUNCE_MS);
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        persistScrollTop();
      }
    };
  }, [ready, scrollRef, view]);
}
