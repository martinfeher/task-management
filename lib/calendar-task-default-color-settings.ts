"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarTaskColor } from "@/lib/calendar-task-colors";
import {
  applyCalendarTaskDefaultColor,
  CALENDAR_TASK_COLOR_OPTIONS,
  CALENDAR_TASK_DEFAULT_COLOR_CHANGE_EVENT,
  readCalendarTaskDefaultColorFromStorage,
  setCalendarTaskDefaultColor,
} from "@/lib/calendar-task-default-color";

export {
  applyCalendarTaskDefaultColor,
  DEFAULT_CALENDAR_TASK_DEFAULT_COLOR,
  getCalendarTaskDefaultColor,
  readCalendarTaskDefaultColorFromStorage,
  setCalendarTaskDefaultColor,
} from "@/lib/calendar-task-default-color";

export function useCalendarTaskDefaultColor() {
  const [defaultColor, setDefaultColorState] = useState<CalendarTaskColor>(
    () => readCalendarTaskDefaultColorFromStorage(),
  );

  useEffect(() => {
    const stored = readCalendarTaskDefaultColorFromStorage();
    setDefaultColorState(stored);
    applyCalendarTaskDefaultColor(stored);

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<CalendarTaskColor>;
      if (typeof customEvent.detail === "string") {
        setDefaultColorState(customEvent.detail);
        return;
      }

      setDefaultColorState(readCalendarTaskDefaultColorFromStorage());
    }

    window.addEventListener(
      CALENDAR_TASK_DEFAULT_COLOR_CHANGE_EVENT,
      handleChange,
    );
    return () =>
      window.removeEventListener(
        CALENDAR_TASK_DEFAULT_COLOR_CHANGE_EVENT,
        handleChange,
      );
  }, []);

  const setDefaultColor = useCallback((color: string) => {
    setCalendarTaskDefaultColor(color);
    setDefaultColorState(readCalendarTaskDefaultColorFromStorage());
  }, []);

  return {
    defaultColor,
    setDefaultColor,
    colorOptions: CALENDAR_TASK_COLOR_OPTIONS,
  };
}
