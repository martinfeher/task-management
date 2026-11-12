"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarViewTab } from "@/lib/calendar-view-settings";

export type CalendarDefaultViewPreference = "adaptive" | CalendarViewTab;

const STORAGE_KEY = "todolist:calendar-default-view-preference";
const CHANGE_EVENT = "todolist:calendar-default-view-preference-change";

export const DEFAULT_CALENDAR_DEFAULT_VIEW_PREFERENCE: CalendarDefaultViewPreference =
  "adaptive";

const VALID_FIXED_VIEWS = new Set<CalendarViewTab>([
  "day",
  "week",
  "month",
  "days",
  "weeks",
]);

export const CALENDAR_DEFAULT_VIEW_PREFERENCE_OPTIONS: {
  value: CalendarDefaultViewPreference;
  label: string;
  description?: string;
}[] = [
  {
    value: "adaptive",
    label: "Adaptive",
    description: "Days when scheduled tasks are in range, otherwise Month",
  },
  { value: "day", label: "Day" },
  { value: "days", label: "Days" },
  { value: "week", label: "Week" },
  { value: "weeks", label: "Weeks" },
  { value: "month", label: "Month" },
];

function parsePreference(raw: string | null): CalendarDefaultViewPreference {
  if (raw === "adaptive") return "adaptive";
  if (raw && VALID_FIXED_VIEWS.has(raw as CalendarViewTab)) {
    return raw as CalendarViewTab;
  }
  return DEFAULT_CALENDAR_DEFAULT_VIEW_PREFERENCE;
}

export function readCalendarDefaultViewPreferenceFromStorage(): CalendarDefaultViewPreference {
  if (typeof window === "undefined") {
    return DEFAULT_CALENDAR_DEFAULT_VIEW_PREFERENCE;
  }
  return parsePreference(window.localStorage.getItem(STORAGE_KEY));
}

export function setCalendarDefaultViewPreference(
  preference: CalendarDefaultViewPreference,
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, preference);
  window.dispatchEvent(
    new CustomEvent<CalendarDefaultViewPreference>(CHANGE_EVENT, {
      detail: preference,
    }),
  );
}

export function useCalendarDefaultViewPreference() {
  const [preference, setPreferenceState] = useState(
    readCalendarDefaultViewPreferenceFromStorage,
  );

  useEffect(() => {
    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<CalendarDefaultViewPreference>;
      if (customEvent.detail) {
        setPreferenceState(customEvent.detail);
        return;
      }
      setPreferenceState(readCalendarDefaultViewPreferenceFromStorage());
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const setPreference = useCallback((next: CalendarDefaultViewPreference) => {
    setCalendarDefaultViewPreference(next);
    setPreferenceState(next);
  }, []);

  return {
    calendarDefaultViewPreference: preference,
    setCalendarDefaultViewPreference: setPreference,
  };
}
