"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  areSidebarBackgroundSettingsEqual,
  DEFAULT_SIDEBAR_BASE_COLOR,
  DEFAULT_SIDEBAR_BACKGROUND_ID,
  getDefaultSidebarBackgroundSettings,
  getSidebarBackgroundOption,
  getSidebarBackgroundPresentation,
  normalizeHexColor,
  normalizeSidebarBackgroundSettings,
  parseSidebarBackgroundSettings,
  SIDEBAR_BACKGROUND_OPTIONS,
  type SidebarBackgroundId,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";

export {
  DEFAULT_SIDEBAR_BASE_COLOR,
  getSidebarBackgroundPresentation,
  mixHexWithWhite,
  SIDEBAR_BACKGROUND_OPTIONS,
  type SidebarBackgroundId,
  type SidebarBackgroundSettings,
} from "@/lib/sidebar-background-types";

const BACKGROUND_STORAGE_KEY = "todolist.sidebarBackground";
const BASE_COLOR_STORAGE_KEY = "todolist.sidebarBackgroundBaseColor";
const BACKGROUND_CHANGE_EVENT = "todolist:sidebar-background-change";
const BASE_COLOR_CHANGE_EVENT = "todolist:sidebar-background-base-color-change";

function applySidebarBackgroundSettings(settings: SidebarBackgroundSettings) {
  window.localStorage.setItem(BACKGROUND_STORAGE_KEY, settings.backgroundId);
  window.localStorage.setItem(BASE_COLOR_STORAGE_KEY, settings.baseColor);
  window.dispatchEvent(
    new CustomEvent<SidebarBackgroundId>(BACKGROUND_CHANGE_EVENT, {
      detail: settings.backgroundId,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(BASE_COLOR_CHANGE_EVENT, {
      detail: settings.baseColor,
    }),
  );
}

function readSidebarBackgroundSettingsFromStorage(): SidebarBackgroundSettings {
  if (typeof window === "undefined") {
    return getDefaultSidebarBackgroundSettings();
  }

  const backgroundId = window.localStorage.getItem(BACKGROUND_STORAGE_KEY);
  const baseColor = window.localStorage.getItem(BASE_COLOR_STORAGE_KEY);

  return normalizeSidebarBackgroundSettings({
    backgroundId: backgroundId ?? undefined,
    baseColor: baseColor ?? undefined,
  });
}

export function setSidebarBackgroundId(id: SidebarBackgroundId) {
  if (typeof window === "undefined") return;

  const current = readSidebarBackgroundSettingsFromStorage();
  applySidebarBackgroundSettings({ ...current, backgroundId: id });
}

export function setSidebarBaseColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readSidebarBackgroundSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_SIDEBAR_BASE_COLOR;
  applySidebarBackgroundSettings({ ...current, baseColor: normalized });
}

async function fetchSidebarBackgroundSettings() {
  const response = await fetch("/api/sidebar-background", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load sidebar background settings");
  }

  const payload = await response.json();
  const parsed = parseSidebarBackgroundSettings(payload);
  if (!parsed) {
    throw new Error("Invalid sidebar background settings response");
  }

  return parsed;
}

async function persistSidebarBackgroundSettings(
  settings: SidebarBackgroundSettings,
) {
  const response = await fetch("/api/sidebar-background", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save sidebar background settings");
  }

  const payload = await response.json();
  const parsed = parseSidebarBackgroundSettings(payload.settings);
  return parsed ?? settings;
}

export function useSidebarBackground() {
  const [backgroundId, setBackgroundIdState] = useState<SidebarBackgroundId>(
    DEFAULT_SIDEBAR_BACKGROUND_ID,
  );
  const [baseColor, setBaseColorState] = useState(DEFAULT_SIDEBAR_BASE_COLOR);
  const [savedSettings, setSavedSettings] = useState<SidebarBackgroundSettings>(
    getDefaultSidebarBackgroundSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentSettings = useMemo(
    () => normalizeSidebarBackgroundSettings({ backgroundId, baseColor }),
    [backgroundId, baseColor],
  );

  const isDirty = useMemo(
    () => !areSidebarBackgroundSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  useEffect(() => {
    const stored = readSidebarBackgroundSettingsFromStorage();
    setBackgroundIdState(stored.backgroundId);
    setBaseColorState(stored.baseColor);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const settings = await fetchSidebarBackgroundSettings();
        if (cancelled) return;

        applySidebarBackgroundSettings(settings);
        setBackgroundIdState(settings.backgroundId);
        setBaseColorState(settings.baseColor);
        setSavedSettings(settings);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          const stored = readSidebarBackgroundSettingsFromStorage();
          setSavedSettings(stored);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleBackgroundChange(event: Event) {
      const nextId = (event as CustomEvent<SidebarBackgroundId>).detail;
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

  const setBackgroundId = useCallback((id: SidebarBackgroundId) => {
    setSidebarBackgroundId(id);
    setBackgroundIdState(id);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setBaseColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_SIDEBAR_BASE_COLOR;
    setSidebarBaseColor(normalized);
    setBaseColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const saveSettings = useCallback(async (settingsOverride?: SidebarBackgroundSettings) => {
    const settingsToSave =
      settingsOverride ?? normalizeSidebarBackgroundSettings(currentSettings);

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const saved = await persistSidebarBackgroundSettings(settingsToSave);
      applySidebarBackgroundSettings(saved);
      setBackgroundIdState(saved.backgroundId);
      setBaseColorState(saved.baseColor);
      setSavedSettings(saved);
      setSaveSuccess(true);
    } catch (error) {
      console.error(error);
      setSaveError("Could not save sidebar background settings.");
    } finally {
      setIsSaving(false);
    }
  }, [currentSettings]);

  const replaceSettings = useCallback(
    (
      settings: SidebarBackgroundSettings,
      options?: {
        markSaved?: boolean;
      },
    ) => {
      const normalized = normalizeSidebarBackgroundSettings(settings);
      applySidebarBackgroundSettings(normalized);
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

  const option = getSidebarBackgroundOption(backgroundId);
  const presentation = getSidebarBackgroundPresentation(
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
