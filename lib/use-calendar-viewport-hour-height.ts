"use client";

import { useLayoutEffect, useState, type RefObject } from "react";
import {
  CALENDAR_COLLAPSE_EARLY_END_HOUR,
  CALENDAR_HOUR_END,
  getCalendarDisplayHours,
} from "@/lib/calendar-time-grid";

export const CALENDAR_DESKTOP_VISIBLE_HOUR_START = CALENDAR_COLLAPSE_EARLY_END_HOUR;
export const CALENDAR_DESKTOP_VISIBLE_HOUR_END = CALENDAR_HOUR_END;
export const CALENDAR_DESKTOP_VISIBLE_HOUR_COUNT =
  CALENDAR_DESKTOP_VISIBLE_HOUR_END - CALENDAR_DESKTOP_VISIBLE_HOUR_START + 1;

export const CALENDAR_FALLBACK_HOUR_HEIGHT_PX = 52;
export const CALENDAR_MIN_HOUR_HEIGHT_PX = 28;
export const CALENDAR_MAX_HOUR_HEIGHT_PX = 120;
const CALENDAR_DESKTOP_MIN_WIDTH_PX = 1024;

export function getCalendarDesktopDisplayHours() {
  return getCalendarDisplayHours(true);
}

export function useCalendarViewportHourHeight(
  scrollRef: RefObject<HTMLElement | null>,
  hourColumnRef: RefObject<HTMLElement | null>,
  ready = true,
) {
  const [hourHeightPx, setHourHeightPx] = useState(CALENDAR_FALLBACK_HOUR_HEIGHT_PX);

  useLayoutEffect(() => {
    if (!ready) return;

    const scrollEl = scrollRef.current;
    const hourColumn = hourColumnRef.current;
    if (!scrollEl || !hourColumn) return;

    const mediaQuery = window.matchMedia(
      `(min-width: ${CALENDAR_DESKTOP_MIN_WIDTH_PX}px)`,
    );

    const measure = () => {
      if (!mediaQuery.matches) {
        setHourHeightPx(CALENDAR_FALLBACK_HOUR_HEIGHT_PX);
        return;
      }

      const firstHourCell = hourColumn.firstElementChild;
      if (!(firstHourCell instanceof HTMLElement)) return;

      scrollEl.scrollTop = 0;

      const scrollRect = scrollEl.getBoundingClientRect();
      const firstHourRect = firstHourCell.getBoundingClientRect();
      const timedGridViewportTop = firstHourRect.top - scrollRect.top;
      const availableHeight = scrollEl.clientHeight - timedGridViewportTop;

      if (availableHeight <= 0) return;

      const nextHourHeight =
        availableHeight / CALENDAR_DESKTOP_VISIBLE_HOUR_COUNT;
      const clamped = Math.max(
        CALENDAR_MIN_HOUR_HEIGHT_PX,
        Math.min(CALENDAR_MAX_HOUR_HEIGHT_PX, nextHourHeight),
      );

      setHourHeightPx((current) => (current === clamped ? current : clamped));
    };

    measure();

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(scrollEl);

    const handleMediaQueryChange = () => {
      measure();
    };
    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, [hourColumnRef, ready, scrollRef]);

  return hourHeightPx;
}
