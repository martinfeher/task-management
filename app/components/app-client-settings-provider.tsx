"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color";
import {
  readAppClientSettings,
  type AppClientSettings,
} from "@/lib/read-app-client-settings";
import { applyTaskEditorDefaults } from "@/lib/task-editor-defaults-settings";

const AppClientSettingsContext = createContext<AppClientSettings | null>(null);

export function AppClientSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppClientSettings | null>(null);

  useLayoutEffect(() => {
    const loaded = readAppClientSettings();
    applyTaskEditorDefaults(loaded.taskEditorDefaults);
    applyCalendarTaskDefaultColor(loaded.calendarTaskDefaultColor);
    setSettings(loaded);
  }, []);

  const value = useMemo(() => settings, [settings]);

  if (!settings) {
    return (
      <div
        className="min-h-full flex-1 bg-white dark:bg-zinc-950"
        aria-busy="true"
        aria-label="Loading app settings"
      />
    );
  }

  return (
    <AppClientSettingsContext.Provider value={value}>
      {children}
    </AppClientSettingsContext.Provider>
  );
}

export function useAppClientSettings() {
  const settings = useContext(AppClientSettingsContext);
  if (!settings) {
    throw new Error("useAppClientSettings requires AppClientSettingsProvider");
  }
  return settings;
}

export function useAppClientSettingsOptional() {
  return useContext(AppClientSettingsContext);
}
