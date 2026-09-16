"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  runSettingsLoadEffect,
  shouldIgnoreSettingsLoadError,
} from "@/lib/client-settings-fetch";
import { normalizeHexColor } from "@/lib/sidebar-background-types";
import {
  areTaskListBackgroundSettingsEqual,
  DEFAULT_TASK_LIST_BASE_COLOR,
  DEFAULT_TASK_LIST_BACKGROUND_ID,
  getDefaultTaskListBackgroundSettings,
  getTaskListBackgroundOption,
  getTaskListBackgroundPresentation,
  normalizeTaskListBackgroundSettings,
  parseTaskListBackgroundSettings,
  TASK_LIST_BACKGROUND_OPTIONS,
  type TaskListBackgroundId,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";

export {
  DEFAULT_TASK_LIST_BASE_COLOR,
  getTaskListBackgroundPresentation,
  TASK_LIST_BACKGROUND_OPTIONS,
  type TaskListBackgroundId,
  type TaskListBackgroundSettings,
} from "@/lib/task-list-background-types";

const BACKGROUND_STORAGE_KEY = "todolist.taskListBackground";
const BASE_COLOR_STORAGE_KEY = "todolist.taskListBackgroundBaseColor";
const BACKGROUND_CHANGE_EVENT = "todolist:task-list-background-change";
const BASE_COLOR_CHANGE_EVENT = "todolist:task-list-background-base-color-change";

function applyTaskListBackgroundSettings(settings: TaskListBackgroundSettings) {
  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, settings.backgroundId);
  window.localStorage.setItem(BASE_COLOR_STORAGE_KEY, settings.baseColor);
  window.dispatchEvent(
    new CustomEvent<TaskListBackgroundId>(BACKGROUND_CHANGE_EVENT, {
      detail: settings.backgroundId,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(BASE_COLOR_CHANGE_EVENT, {
      detail: settings.baseColor,
    }),
  );
}

function readTaskListBackgroundSettingsFromStorage(): TaskListBackgroundSettings {
  if (typeof window === "undefined") {
    return getDefaultTaskListBackgroundSettings();
  }

  const backgroundId = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
  const baseColor = window.localStorage.getItem(BASE_COLOR_STORAGE_KEY);

  return normalizeTaskListBackgroundSettings({
    backgroundId: backgroundId ?? undefined,
    baseColor: baseColor ?? undefined,
  });
}

export function setTaskListBackgroundId(id: TaskListBackgroundId) {
  if (typeof window === "undefined") return;

  const current = readTaskListBackgroundSettingsFromStorage();
  applyTaskListBackgroundSettings({ ...current, backgroundId: id });
}

export function setTaskListBaseColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readTaskListBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_TASK_LIST_BASE_COLOR;
  applyTaskListBackgroundSettings({ ...current, baseColor: normalized });
}

async function fetchTaskListBackgroundSettings() {
  const response = await fetch("/api/task-list-background", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load task list background settings");
  }

  const payload = await response.json();
  const parsed = parseTaskListBackgroundSettings(payload);
  if (!parsed) {
    throw new Error("Invalid task list background settings response");
  }

  return parsed;
}

async function persistTaskListBackgroundSettings(
  settings: TaskListBackgroundSettings,
) {
  const response = await fetch("/api/task-list-background", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save task list background settings");
  }

  const payload = await response.json();
  const parsed = parseTaskListBackgroundSettings(payload.settings);
  return parsed ?? settings;
}

export function useTaskListBackground() {
  const [backgroundId, setBackgroundIdState] = useState<TaskListBackgroundId>(
    DEFAULT_TASK_LIST_BACKGROUND_ID,
  );
  const [baseColor, setBaseColorState] = useState(DEFAULT_TASK_LIST_BASE_COLOR);
  const [savedSettings, setSavedSettings] = useState<TaskListBackgroundSettings>(
    getDefaultTaskListBackgroundSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentSettings = useMemo(
    () => normalizeTaskListBackgroundSettings({ backgroundId, baseColor }),
    [backgroundId, baseColor],
  );

  const isDirty = useMemo(
    () => !areTaskListBackgroundSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  useEffect(() => {
    const stored = readTaskListBackgroundSettingsFromStorage();
    setBackgroundIdState(stored.backgroundId);
    setBaseColorState(stored.baseColor);
  }, []);

  useEffect(() => {
    return runSettingsLoadEffect(async (isCancelled) => {
      try {
        const settings = await fetchTaskListBackgroundSettings();
        if (isCancelled()) return;

        applyTaskListBackgroundSettings(settings);
        setBackgroundIdState(settings.backgroundId);
        setBaseColorState(settings.baseColor);
        setSavedSettings(settings);
      } catch (error) {
        if (shouldIgnoreSettingsLoadError(error, { cancelled: isCancelled() })) {
          return;
        }

        console.warn("Failed to load task list background settings from server.");
        if (!isCancelled()) {
          const stored = readTaskListBackgroundSettingsFromStorage();
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
      const nextId = (event as CustomEvent<TaskListBackgroundId>).detail;
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

    window.addEventListener(BACKGROUND_CHANGE_EVENT, handleBackgroundChange);
    window.addEventListener(BASE_COLOR_CHANGE_EVENT, handleBaseColorChange);
    return () => {
      window.removeEventListener(BACKGROUND_CHANGE_EVENT, handleBackgroundChange);
      window.removeEventListener(
        BASE_COLOR_CHANGE_EVENT,
        handleBaseColorChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!saveSuccess) return;

    const timer = window.setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const setBackgroundId = useCallback((id: TaskListBackgroundId) => {
    setTaskListBackgroundId(id);
    setBackgroundIdState(id);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setBaseColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_TASK_LIST_BASE_COLOR;
    setTaskListBaseColor(normalized);
    setBaseColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const saveSettings = useCallback(async (settingsOverride?: TaskListBackgroundSettings) => {
    const settingsToSave =
      settingsOverride ?? normalizeTaskListBackgroundSettings(currentSettings);

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saved = await persistTaskListBackgroundSettings(settingsToSave);
      applyTaskListBackgroundSettings(saved);
      setBackgroundIdState(saved.backgroundId);
      setBaseColorState(saved.baseColor);
      setSavedSettings(saved);
      setSaveSuccess(true);
    } catch (error) {
      console.error(error);
      setSaveError("Could not save task list background settings.");
    } finally {
      setIsSaving(false);
    }
  }, [currentSettings]);

  const replaceSettings = useCallback(
    (
      settings: TaskListBackgroundSettings,
      options?: {
        markSaved?: boolean;
      },
    ) => {
      const normalized = normalizeTaskListBackgroundSettings(settings);
      applyTaskListBackgroundSettings(normalized);
      setBackgroundIdState(normalized.backgroundId);
      setBaseColorState(normalized.baseColor);
      if (options?.markSaved) {
        setSavedSettings(normalized);
      }
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  const option = getTaskListBackgroundOption(backgroundId);
  const presentation = getTaskListBackgroundPresentation(
    backgroundId,
    baseColor,
  );

  return {
    backgroundId,
    baseColor,
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
    saveSettings,
    replaceSettings,
  };
}
