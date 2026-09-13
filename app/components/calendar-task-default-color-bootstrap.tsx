"use client";

import { useEffect } from "react";
import {
  applyCalendarTaskDefaultColor,
  readCalendarTaskDefaultColorFromStorage,
} from "@/lib/calendar-task-default-color";

export function CalendarTaskDefaultColorBootstrap() {
  useEffect(() => {
    applyCalendarTaskDefaultColor(readCalendarTaskDefaultColorFromStorage());
  }, []);

  return null;
}
