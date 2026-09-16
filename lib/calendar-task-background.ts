"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  runSettingsLoadEffect,
  shouldIgnoreSettingsLoadError,
} from "@/lib/client-settings-fetch";
import {
  areCalendarTaskBackgroundSettingsEqual,
  CALENDAR_TASK_BACKGROUND_OPTIONS,
  DEFAULT_CALENDAR_TASK_BASE_COLOR,
  DEFAULT_CALENDAR_TASK_BACKGROUND_ID,
  DEFAULT_CALENDAR_TASK_END_COLOR,
  DEFAULT_CALENDAR_TASK_TIME_COLOR,
  DEFAULT_CALENDAR_TASK_TITLE_COLOR,
  getCalendarTaskBackgroundOption,
  getCalendarTaskBackgroundPresentation,
  getDefaultCalendarTaskBackgroundSettings,
  normalizeCalendarTaskBackgroundSettings,
  parseCalendarTaskBackgroundSettings,
  type CalendarTaskBackgroundId,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";
import { normalizeHexColor } from "@/lib/sidebar-background-types";

export {
  CALENDAR_TASK_BACKGROUND_OPTIONS,
  getCalendarTaskBackgroundPresentation,
  type CalendarTaskBackgroundId,
  type CalendarTaskBackgroundSettings,
} from "@/lib/calendar-task-background-types";

const BACKGROUND_STORAGE_KEY = "todolist.calendarTaskBackground";
const BASE_COLOR_STORAGE_KEY = "todolist.calendarTaskBackgroundBaseColor";
const END_COLOR_STORAGE_KEY = "todolist.calendarTaskBackgroundEndColor";
const TITLE_COLOR_STORAGE_KEY = "todolist.calendarTaskTitleColor";
const TIME_COLOR_STORAGE_KEY = "todolist.calendarTaskTimeColor";
const BACKGROUND_CHANGE_EVENT = "todolist:calendar-task-background-change";
const BASE_COLOR_CHANGE_EVENT = "todolist:calendar-task-background-base-color-change";
const END_COLOR_CHANGE_EVENT = "todolist:calendar-task-background-end-color-change";
const TITLE_COLOR_CHANGE_EVENT = "todolist:calendar-task-title-color-change";
const TIME_COLOR_CHANGE_EVENT = "todolist:calendar-task-time-color-change";
export const CALENDAR_TASK_BACKGROUND_CSS_VAR = "--calendar-task-item-background";
export const CALENDAR_TASK_TITLE_COLOR_CSS_VAR = "--calendar-task-title-color";
export const CALENDAR_TASK_TITLE_SOURCE_COLOR_CSS_VAR =
  "--calendar-task-title-source-color";
export const CALENDAR_TASK_TIME_COLOR_CSS_VAR = "--calendar-task-time-color";
export const CALENDAR_TASK_TITLE_BRIGHTNESS_CSS_VAR =
  "--calendar-task-title-brightness";

function applyCalendarTaskTitleSourceColor(baseColor: string) {
  document.documentElement.style.setProperty(
    CALENDAR_TASK_TITLE_SOURCE_COLOR_CSS_VAR,
    baseColor,
  );
}

function applyCalendarTaskTextColors(settings: CalendarTaskBackgroundSettings) {
  if (settings.titleColor === DEFAULT_CALENDAR_TASK_TITLE_COLOR) {
    document.documentElement.style.removeProperty(
      CALENDAR_TASK_TITLE_COLOR_CSS_VAR,
    );
  } else {
    document.documentElement.style.setProperty(
      CALENDAR_TASK_TITLE_COLOR_CSS_VAR,
      settings.titleColor,
    );
  }
  document.documentElement.style.setProperty(
    CALENDAR_TASK_TIME_COLOR_CSS_VAR,
    settings.timeColor,
  );
}

function applyCalendarTaskBackgroundSettings(
  settings: CalendarTaskBackgroundSettings,
) {
  const normalized = normalizeCalendarTaskBackgroundSettings(settings);
  const presentation = getCalendarTaskBackgroundPresentation(
    normalized.backgroundId,
    normalized.baseColor,
    normalized.endColor,
  );

  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, normalized.backgroundId);
  window.localStorage.setItem(BASE_COLOR_STORAGE_KEY, normalized.baseColor);
  window.localStorage.setItem(END_COLOR_STORAGE_KEY, normalized.endColor);
  window.localStorage.setItem(TITLE_COLOR_STORAGE_KEY, normalized.titleColor);
  window.localStorage.setItem(TIME_COLOR_STORAGE_KEY, normalized.timeColor);
  document.documentElement.style.setProperty(
    CALENDAR_TASK_BACKGROUND_CSS_VAR,
    presentation.background,
  );
  applyCalendarTaskTitleSourceColor(normalized.baseColor);
  applyCalendarTaskTextColors(normalized);
  window.dispatchEvent(
    new CustomEvent<CalendarTaskBackgroundId>(BACKGROUND_CHANGE_EVENT, {
      detail: normalized.backgroundId,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(BASE_COLOR_CHANGE_EVENT, {
      detail: normalized.baseColor,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(END_COLOR_CHANGE_EVENT, {
      detail: normalized.endColor,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(TITLE_COLOR_CHANGE_EVENT, {
      detail: normalized.titleColor,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(TIME_COLOR_CHANGE_EVENT, {
      detail: normalized.timeColor,
    }),
  );
}

function readCalendarTaskBackgroundSettingsFromStorage(): CalendarTaskBackgroundSettings {
  if (typeof window === "undefined") {
    return getDefaultCalendarTaskBackgroundSettings();
  }

  const backgroundId = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
  const baseColor = window.localStorage.getItem(BASE_COLOR_STORAGE_KEY);
  const endColor = window.localStorage.getItem(END_COLOR_STORAGE_KEY);
  const titleColor = window.localStorage.getItem(TITLE_COLOR_STORAGE_KEY);
  const timeColor = window.localStorage.getItem(TIME_COLOR_STORAGE_KEY);

  return normalizeCalendarTaskBackgroundSettings({
    backgroundId: backgroundId ?? undefined,
    baseColor: baseColor ?? undefined,
    endColor: endColor ?? undefined,
    titleColor: titleColor ?? undefined,
    timeColor: timeColor ?? undefined,
  });
}

export function setCalendarTaskBackgroundId(id: CalendarTaskBackgroundId) {
  if (typeof window === "undefined") return;

  const current = readCalendarTaskBackgroundSettingsFromStorage();
  applyCalendarTaskBackgroundSettings({ ...current, backgroundId: id });
}

export function setCalendarTaskBaseColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readCalendarTaskBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_BASE_COLOR;
  applyCalendarTaskBackgroundSettings({ ...current, baseColor: normalized });
}

export function setCalendarTaskEndColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readCalendarTaskBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_END_COLOR;
  applyCalendarTaskBackgroundSettings({ ...current, endColor: normalized });
}

export function setCalendarTaskTitleColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readCalendarTaskBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_TITLE_COLOR;
  applyCalendarTaskBackgroundSettings({ ...current, titleColor: normalized });
}

export function setCalendarTaskTimeColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readCalendarTaskBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_TIME_COLOR;
  applyCalendarTaskBackgroundSettings({ ...current, timeColor: normalized });
}

async function fetchCalendarTaskBackgroundSettings() {
  const response = await fetch("/api/calendar-task-background", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load calendar task background settings");
  }

  const payload = await response.json();
  const parsed = parseCalendarTaskBackgroundSettings(payload);
  if (!parsed) {
    throw new Error("Invalid calendar task background settings response");
  }

  return parsed;
}

async function persistCalendarTaskBackgroundSettings(
  settings: CalendarTaskBackgroundSettings,
) {
  const response = await fetch("/api/calendar-task-background", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save calendar task background settings");
  }

  const payload = await response.json();
  const parsed = parseCalendarTaskBackgroundSettings(payload.settings);
  return parsed ?? settings;
}

export function useCalendarTaskBackground() {
  const [backgroundId, setBackgroundIdState] = useState<CalendarTaskBackgroundId>(
    DEFAULT_CALENDAR_TASK_BACKGROUND_ID,
  );
  const [baseColor, setBaseColorState] = useState(DEFAULT_CALENDAR_TASK_BASE_COLOR);
  const [endColor, setEndColorState] = useState(DEFAULT_CALENDAR_TASK_END_COLOR);
  const [titleColor, setTitleColorState] = useState(DEFAULT_CALENDAR_TASK_TITLE_COLOR);
  const [timeColor, setTimeColorState] = useState(DEFAULT_CALENDAR_TASK_TIME_COLOR);
  const [savedSettings, setSavedSettings] = useState<CalendarTaskBackgroundSettings>(
    getDefaultCalendarTaskBackgroundSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentSettings = useMemo(
    () =>
      normalizeCalendarTaskBackgroundSettings({
        backgroundId,
        baseColor,
        endColor,
        titleColor,
        timeColor,
      }),
    [backgroundId, baseColor, endColor, titleColor, timeColor],
  );

  const isDirty = useMemo(
    () => !areCalendarTaskBackgroundSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  useEffect(() => {
    const stored = readCalendarTaskBackgroundSettingsFromStorage();
    setBackgroundIdState(stored.backgroundId);
    setBaseColorState(stored.baseColor);
    setEndColorState(stored.endColor);
    setTitleColorState(stored.titleColor);
    setTimeColorState(stored.timeColor);
    applyCalendarTaskBackgroundSettings(stored);
  }, []);

  useEffect(() => {
    return runSettingsLoadEffect(async (isCancelled) => {
      try {
        const settings = await fetchCalendarTaskBackgroundSettings();
        if (isCancelled()) return;

        applyCalendarTaskBackgroundSettings(settings);
        setBackgroundIdState(settings.backgroundId);
        setBaseColorState(settings.baseColor);
        setEndColorState(settings.endColor);
        setTitleColorState(settings.titleColor);
        setTimeColorState(settings.timeColor);
        setSavedSettings(settings);
      } catch (error) {
        if (shouldIgnoreSettingsLoadError(error, { cancelled: isCancelled() })) {
          return;
        }

        console.warn(
          "Failed to load calendar task background settings from server.",
        );
        if (!isCancelled()) {
          const stored = readCalendarTaskBackgroundSettingsFromStorage();
          setSavedSettings(stored);
        }
      } finally {
        if (!isCancelled()) {
          setIsLoading(false);
        }
      }
    });
  }, []);

  useEffect(() => {
    function handleBackgroundChange(event: Event) {
      const nextId = (event as CustomEvent<CalendarTaskBackgroundId>).detail;
      if (nextId) {
        setBackgroundIdState(nextId);
      }
    }

    function handleBaseColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setBaseColorState(nextColor);
      }
    }

    function handleEndColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setEndColorState(nextColor);
      }
    }

    function handleTitleColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setTitleColorState(nextColor);
      }
    }

    function handleTimeColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setTimeColorState(nextColor);
      }
    }

    window.addEventListener(BACKGROUND_CHANGE_EVENT, handleBackgroundChange);
    window.addEventListener(BASE_COLOR_CHANGE_EVENT, handleBaseColorChange);
    window.addEventListener(END_COLOR_CHANGE_EVENT, handleEndColorChange);
    window.addEventListener(TITLE_COLOR_CHANGE_EVENT, handleTitleColorChange);
    window.addEventListener(TIME_COLOR_CHANGE_EVENT, handleTimeColorChange);
    return () => {
      window.removeEventListener(BACKGROUND_CHANGE_EVENT, handleBackgroundChange);
      window.removeEventListener(BASE_COLOR_CHANGE_EVENT, handleBaseColorChange);
      window.removeEventListener(END_COLOR_CHANGE_EVENT, handleEndColorChange);
      window.removeEventListener(TITLE_COLOR_CHANGE_EVENT, handleTitleColorChange);
      window.removeEventListener(TIME_COLOR_CHANGE_EVENT, handleTimeColorChange);
    };
  }, []);

  useEffect(() => {
    const presentation = getCalendarTaskBackgroundPresentation(
      backgroundId,
      baseColor,
      endColor,
    );
    document.documentElement.style.setProperty(
      CALENDAR_TASK_BACKGROUND_CSS_VAR,
      presentation.background,
    );
    applyCalendarTaskTitleSourceColor(baseColor);
    applyCalendarTaskTextColors(currentSettings);
  }, [backgroundId, baseColor, endColor, currentSettings]);

  useEffect(() => {
    if (!saveSuccess) return;

    const timer = window.setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const setBackgroundId = useCallback((id: CalendarTaskBackgroundId) => {
    setCalendarTaskBackgroundId(id);
    setBackgroundIdState(id);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setBaseColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_BASE_COLOR;
    setCalendarTaskBaseColor(normalized);
    setBaseColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setEndColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_END_COLOR;
    setCalendarTaskEndColor(normalized);
    setEndColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setTitleColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_TITLE_COLOR;
    setCalendarTaskTitleColor(normalized);
    setTitleColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setTimeColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_CALENDAR_TASK_TIME_COLOR;
    setCalendarTaskTimeColor(normalized);
    setTimeColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const saveSettings = useCallback(async (settingsOverride?: CalendarTaskBackgroundSettings) => {
    const settingsToSave =
      settingsOverride ??
      normalizeCalendarTaskBackgroundSettings(currentSettings);

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saved = await persistCalendarTaskBackgroundSettings(settingsToSave);
      applyCalendarTaskBackgroundSettings(saved);
      setBackgroundIdState(saved.backgroundId);
      setBaseColorState(saved.baseColor);
      setEndColorState(saved.endColor);
      setTitleColorState(saved.titleColor);
      setTimeColorState(saved.timeColor);
      setSavedSettings(saved);
      setSaveSuccess(true);
    } catch (error) {
      console.error(error);
      setSaveError("Could not save calendar task background settings.");
    } finally {
      setIsSaving(false);
    }
  }, [currentSettings]);

  const replaceSettings = useCallback(
    (
      settings: CalendarTaskBackgroundSettings,
      options?: {
        markSaved?: boolean;
      },
    ) => {
      const normalized = normalizeCalendarTaskBackgroundSettings(settings);
      applyCalendarTaskBackgroundSettings(normalized);
      setBackgroundIdState(normalized.backgroundId);
      setBaseColorState(normalized.baseColor);
      setEndColorState(normalized.endColor);
      setTitleColorState(normalized.titleColor);
      setTimeColorState(normalized.timeColor);
      if (options?.markSaved) {
        setSavedSettings(normalized);
      }
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  const option = getCalendarTaskBackgroundOption(backgroundId);
  const presentation = getCalendarTaskBackgroundPresentation(
    backgroundId,
    baseColor,
    endColor,
  );

  return {
    backgroundId,
    baseColor,
    endColor,
    titleColor,
    timeColor,
    option,
    presentation,
    currentSettings,
    savedSettings,
    isLoading,
    isSaving,
    isDirty,
    saveError,
    saveSuccess,
    setBackgroundId,
    setBaseColor,
    setEndColor,
    setTitleColor,
    setTimeColor,
    saveSettings,
    replaceSettings,
  };
}
