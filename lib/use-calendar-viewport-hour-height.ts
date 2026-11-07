"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
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

/** Below this viewport height, Days view shows 30-minute grid lines only. */
export const CALENDAR_DAYS_QUARTER_HOUR_LINES_MIN_HEIGHT_PX = 1200;

export function useCalendarDaysQuarterHourGridLines() {
  const [showQuarterHourLines, setShowQuarterHourLines] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(min-height: ${CALENDAR_DAYS_QUARTER_HOUR_LINES_MIN_HEIGHT_PX}px)`,
    );

    const update = () => {
      setShowQuarterHourLines(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return showQuarterHourLines;
}

export function getCalendarDesktopDisplayHours() {
  return getCalendarDisplayHours(true);
}

export function useCalendarViewportHourHeight(
  scrollRef: RefObject<HTMLElement | null>,
  hourColumnRef: RefObject<HTMLElement | null>,
  ready = true,
) {
  const [hourHeightPx, setHourHeightPx] = useState(CALENDAR_FALLBACK_HOUR_HEIGHT_PX);
  const hourHeightRef = useRef(hourHeightPx);
  hourHeightRef.current = hourHeightPx;

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

      const savedScrollTop = scrollEl.scrollTop;
      scrollEl.scrollTop = 0;

      const scrollRect = scrollEl.getBoundingClientRect();
      const firstHourRect = firstHourCell.getBoundingClientRect();
      const timedGridViewportTop = firstHourRect.top - scrollRect.top;
      const availableHeight = scrollEl.clientHeight - timedGridViewportTop;

      if (availableHeight <= 0) {
        scrollEl.scrollTop = savedScrollTop;
        return;
      }

      const nextHourHeight =
        availableHeight / CALENDAR_DESKTOP_VISIBLE_HOUR_COUNT;
      const clamped = Math.max(
        CALENDAR_MIN_HOUR_HEIGHT_PX,
        Math.min(CALENDAR_MAX_HOUR_HEIGHT_PX, nextHourHeight),
      );

      const previousHourHeight = hourHeightRef.current;
      setHourHeightPx((current) => (current === clamped ? current : clamped));

      let appliedScrollTop = savedScrollTop;
      if (
        previousHourHeight > 0 &&
        previousHourHeight !== clamped &&
        savedScrollTop > 0
      ) {
        appliedScrollTop = savedScrollTop * (clamped / previousHourHeight);
      }
      scrollEl.scrollTop = appliedScrollTop;
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
