"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { runSettingsLoadEffect } from "@/lib/client-settings-fetch";
import {
  arePanelTextColorsSettingsEqual,
  getDefaultPanelTextColorsSettings,
  normalizePanelTextColorsSettings,
  PANEL_TEXT_ELEMENT_CSS_VARS,
  PANEL_TEXT_ELEMENT_KEYS,
  parsePanelTextColorsSettings,
  type PanelTextColorValue,
  type PanelTextColorsSettings,
  type PanelTextElementKey,
} from "@/lib/panel-text-shade-types";
import { getShadeHex } from "@/lib/panel-text-shade-colors";

export {
  PANEL_TEXT_ELEMENT_GROUPS,
  PANEL_TEXT_ELEMENT_KEYS,
  PANEL_TEXT_ELEMENT_LABELS,
  type PanelTextColorValue,
  type PanelTextColorsSettings,
  type PanelTextElementKey,
} from "@/lib/panel-text-shade-types";

export {
  PANEL_TEXT_SHADE_DROPDOWN_OPTIONS,
  type PanelTextShadeToken,
} from "@/lib/panel-text-shade-colors";

const STORAGE_KEY = "todolist.panelTextColors";
const CHANGE_EVENT = "todolist:panel-text-colors-change";

export function applyPanelTextColorsCssVariables(
  settings: PanelTextColorsSettings,
) {
  if (typeof document === "undefined") return;

  for (const key of PANEL_TEXT_ELEMENT_KEYS) {
    document.documentElement.style.setProperty(
      PANEL_TEXT_ELEMENT_CSS_VARS[key],
      settings[key].color,
    );
  }
}

function applyPanelTextColorsSettings(settings: PanelTextColorsSettings) {
  const normalized = normalizePanelTextColorsSettings(settings);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  applyPanelTextColorsCssVariables(normalized);
  window.dispatchEvent(
    new CustomEvent<PanelTextColorsSettings>(CHANGE_EVENT, {
      detail: normalized,
    }),
  );
}

function readPanelTextColorsSettingsFromStorage(): PanelTextColorsSettings {
  if (typeof window === "undefined") {
    return getDefaultPanelTextColorsSettings();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPanelTextColorsSettings();
    const parsed = parsePanelTextColorsSettings(JSON.parse(raw));
    return parsed ?? getDefaultPanelTextColorsSettings();
  } catch {
    return getDefaultPanelTextColorsSettings();
  }
}

async function fetchPanelTextColorsSettings(): Promise<PanelTextColorsSettings | null> {
  try {
    const response = await fetch("/api/panel-text-shade", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Failed to load panel text color settings from server.");
      return null;
    }

    const payload = await response.json();
    const parsed = parsePanelTextColorsSettings(payload);
    if (!parsed) {
      console.warn("Invalid panel text color settings response from server.");
      return null;
    }

    return parsed;
  } catch {
    console.warn("Failed to load panel text color settings from server.");
    return null;
  }
}

async function persistPanelTextColorsSettings(
  settings: PanelTextColorsSettings,
) {
  const response = await fetch("/api/panel-text-shade", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save panel text color settings");
  }

  const payload = await response.json();
  const parsed = parsePanelTextColorsSettings(payload.settings);
  return parsed ?? settings;
}

export function usePanelTextColors() {
  const [settings, setSettingsState] = useState<PanelTextColorsSettings>(
    getDefaultPanelTextColorsSettings(),
  );
  const [savedSettings, setSavedSettings] = useState<PanelTextColorsSettings>(
    getDefaultPanelTextColorsSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentSettings = useMemo(
    () => normalizePanelTextColorsSettings(settings),
    [settings],
  );

  const isDirty = useMemo(
    () => !arePanelTextColorsSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  useEffect(() => {
    const stored = readPanelTextColorsSettingsFromStorage();
    setSettingsState(stored);
    applyPanelTextColorsCssVariables(stored);
  }, []);

  useEffect(() => {
    return runSettingsLoadEffect(async (isCancelled) => {
      try {
        const loaded = await fetchPanelTextColorsSettings();
        if (isCancelled() || !loaded) {
          if (!isCancelled()) {
            setSavedSettings(readPanelTextColorsSettingsFromStorage());
          }
          return;
        }

        applyPanelTextColorsSettings(loaded);
        setSettingsState(loaded);
        setSavedSettings(loaded);
      } finally {
        if (!isCancelled()) {
          setIsLoading(false);
        }
      }
    });
  }, []);

  useEffect(() => {
    applyPanelTextColorsCssVariables(currentSettings);
  }, [currentSettings]);

  useEffect(() => {
    function handleSettingsChange(event: Event) {
      const nextSettings = (event as CustomEvent<PanelTextColorsSettings>).detail;
      if (nextSettings) {
        setSettingsState(nextSettings);
      }
    }

    window.addEventListener(CHANGE_EVENT, handleSettingsChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleSettingsChange);
  }, []);

  useEffect(() => {
    if (!saveSuccess) return;

    const timer = window.setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const setElementShade = useCallback(
    (key: PanelTextElementKey, shade: PanelTextColorValue["shade"]) => {
      setSettingsState((current) => {
        const next = normalizePanelTextColorsSettings({
          ...current,
          [key]: {
            shade,
            color: getShadeHex(shade),
          },
        });
        applyPanelTextColorsSettings(next);
        return next;
      });
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  const setElementColor = useCallback(
    (key: PanelTextElementKey, color: string) => {
      setSettingsState((current) => {
        const next = normalizePanelTextColorsSettings({
          ...current,
          [key]: {
            ...current[key],
            color,
          },
        });
        applyPanelTextColorsSettings(next);
        return next;
      });
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  const saveSettings = useCallback(
    async (settingsOverride?: PanelTextColorsSettings) => {
      const settingsToSave =
        settingsOverride ?? normalizePanelTextColorsSettings(currentSettings);

      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      try {
        const saved = await persistPanelTextColorsSettings(settingsToSave);
        applyPanelTextColorsSettings(saved);
        setSettingsState(saved);
        setSavedSettings(saved);
        setSaveSuccess(true);
      } catch (error) {
        console.error(error);
        setSaveError("Could not save panel text color settings.");
      } finally {
        setIsSaving(false);
      }
    },
    [currentSettings],
  );

  const replaceSettings = useCallback(
    (
      nextSettings: PanelTextColorsSettings,
      options?: {
        markSaved?: boolean;
      },
    ) => {
      const normalized = normalizePanelTextColorsSettings(nextSettings);
      applyPanelTextColorsSettings(normalized);
      setSettingsState(normalized);
      if (options?.markSaved) {
        setSavedSettings(normalized);
      }
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  return {
    settings: currentSettings,
    savedSettings,
    isLoading,
    isSaving,
    isDirty,
    saveError,
    saveSuccess,
    setElementShade,
    setElementColor,
    saveSettings,
    replaceSettings,
  };
}

/** @deprecated Use usePanelTextColors */
export const usePanelTextShade = usePanelTextColors;
