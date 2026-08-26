"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeHexColor } from "@/lib/sidebar-background-types";
import {
  areTooltipSettingsEqual,
  DEFAULT_TOOLTIP_BACKGROUND_COLOR,
  DEFAULT_TOOLTIP_CORNER_RADIUS_PX,
  DEFAULT_TOOLTIP_TEXT_COLOR,
  getDefaultTooltipSettings,
  normalizeCornerRadiusPx,
  normalizeTooltipSettings,
  parseTooltipSettings,
  type TooltipSettings,
} from "@/lib/tooltip-settings-types";

export {
  DEFAULT_TOOLTIP_BACKGROUND_COLOR,
  DEFAULT_TOOLTIP_CORNER_RADIUS_PX,
  DEFAULT_TOOLTIP_TEXT_COLOR,
  MAX_TOOLTIP_CORNER_RADIUS_PX,
  MIN_TOOLTIP_CORNER_RADIUS_PX,
  type TooltipSettings,
} from "@/lib/tooltip-settings-types";

const BACKGROUND_COLOR_STORAGE_KEY = "todolist.tooltipBackgroundColor";
const TEXT_COLOR_STORAGE_KEY = "todolist.tooltipTextColor";
const CORNER_RADIUS_STORAGE_KEY = "todolist.tooltipCornerRadiusPx";
const BACKGROUND_COLOR_CHANGE_EVENT = "todolist:tooltip-background-color-change";
const TEXT_COLOR_CHANGE_EVENT = "todolist:tooltip-text-color-change";
const CORNER_RADIUS_CHANGE_EVENT = "todolist:tooltip-corner-radius-change";

export const TOOLTIP_BACKGROUND_CSS_VAR = "--app-tooltip-background";
export const TOOLTIP_TEXT_CSS_VAR = "--app-tooltip-text";
export const TOOLTIP_RADIUS_CSS_VAR = "--app-tooltip-radius";
export const TOOLTIP_ARROW_COLOR_CSS_VAR = "--app-tooltip-arrow-color";

function applyTooltipCssVariables(settings: TooltipSettings) {
  document.documentElement.style.setProperty(
    TOOLTIP_BACKGROUND_CSS_VAR,
    settings.backgroundColor,
  );
  document.documentElement.style.setProperty(
    TOOLTIP_TEXT_CSS_VAR,
    settings.textColor,
  );
  document.documentElement.style.setProperty(
    TOOLTIP_RADIUS_CSS_VAR,
    `${settings.cornerRadiusPx}px`,
  );
  document.documentElement.style.setProperty(
    TOOLTIP_ARROW_COLOR_CSS_VAR,
    settings.backgroundColor,
  );
}

function applyTooltipSettings(settings: TooltipSettings) {
  const normalized = normalizeTooltipSettings(settings);

  window.localStorage.setItem(
    BACKGROUND_COLOR_STORAGE_KEY,
    normalized.backgroundColor,
  );
  window.localStorage.setItem(TEXT_COLOR_STORAGE_KEY, normalized.textColor);
  window.localStorage.setItem(
    CORNER_RADIUS_STORAGE_KEY,
    String(normalized.cornerRadiusPx),
  );
  applyTooltipCssVariables(normalized);
  window.dispatchEvent(
    new CustomEvent<string>(BACKGROUND_COLOR_CHANGE_EVENT, {
      detail: normalized.backgroundColor,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<string>(TEXT_COLOR_CHANGE_EVENT, {
      detail: normalized.textColor,
    }),
  );
  window.dispatchEvent(
    new CustomEvent<number>(CORNER_RADIUS_CHANGE_EVENT, {
      detail: normalized.cornerRadiusPx,
    }),
  );
}

function readTooltipSettingsFromStorage(): TooltipSettings {
  if (typeof window === "undefined") {
    return getDefaultTooltipSettings();
  }

  const backgroundColor = window.localStorage.getItem(BACKGROUND_COLOR_STORAGE_KEY);
  const textColor = window.localStorage.getItem(TEXT_COLOR_STORAGE_KEY);
  const cornerRadiusPx = window.localStorage.getItem(CORNER_RADIUS_STORAGE_KEY);

  return normalizeTooltipSettings({
    backgroundColor: backgroundColor ?? undefined,
    textColor: textColor ?? undefined,
    cornerRadiusPx: cornerRadiusPx ?? undefined,
  });
}

export function setTooltipBackgroundColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readTooltipSettingsFromStorage();
  const normalized =
    normalizeHexColor(color) ?? DEFAULT_TOOLTIP_BACKGROUND_COLOR;
  applyTooltipSettings({ ...current, backgroundColor: normalized });
}

export function setTooltipTextColor(color: string) {
  if (typeof window === "undefined") return;

  const current = readTooltipSettingsFromStorage();
  const normalized = normalizeHexColor(color) ?? DEFAULT_TOOLTIP_TEXT_COLOR;
  applyTooltipSettings({ ...current, textColor: normalized });
}

export function setTooltipCornerRadiusPx(value: number | string) {
  if (typeof window === "undefined") return;

  const current = readTooltipSettingsFromStorage();
  applyTooltipSettings({
    ...current,
    cornerRadiusPx: normalizeCornerRadiusPx(value),
  });
}

async function fetchTooltipSettings(): Promise<TooltipSettings | null> {
  try {
    const response = await fetch("/api/tooltip-settings", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Failed to load tooltip settings from server.");
      return null;
    }

    const payload = await response.json();
    const parsed = parseTooltipSettings(payload);
    if (!parsed) {
      console.warn("Invalid tooltip settings response from server.");
      return null;
    }

    return parsed;
  } catch {
    console.warn("Failed to load tooltip settings from server.");
    return null;
  }
}

async function persistTooltipSettings(settings: TooltipSettings) {
  const response = await fetch("/api/tooltip-settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error("Failed to save tooltip settings");
  }

  const payload = await response.json();
  const parsed = parseTooltipSettings(payload.settings);
  return parsed ?? settings;
}

export function useTooltipSettings() {
  const [backgroundColor, setBackgroundColorState] = useState(
    DEFAULT_TOOLTIP_BACKGROUND_COLOR,
  );
  const [textColor, setTextColorState] = useState(DEFAULT_TOOLTIP_TEXT_COLOR);
  const [cornerRadiusPx, setCornerRadiusPxState] = useState(
    DEFAULT_TOOLTIP_CORNER_RADIUS_PX,
  );
  const [savedSettings, setSavedSettings] = useState<TooltipSettings>(
    getDefaultTooltipSettings(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentSettings = useMemo(
    () =>
      normalizeTooltipSettings({
        backgroundColor,
        textColor,
        cornerRadiusPx,
      }),
    [backgroundColor, textColor, cornerRadiusPx],
  );

  const isDirty = useMemo(
    () => !areTooltipSettingsEqual(currentSettings, savedSettings),
    [currentSettings, savedSettings],
  );

  useEffect(() => {
    const stored = readTooltipSettingsFromStorage();
    setBackgroundColorState(stored.backgroundColor);
    setTextColorState(stored.textColor);
    setCornerRadiusPxState(stored.cornerRadiusPx);
    applyTooltipCssVariables(stored);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const settings = await fetchTooltipSettings();
        if (cancelled || !settings) {
          if (!cancelled) {
            setSavedSettings(readTooltipSettingsFromStorage());
          }
          return;
        }

        applyTooltipSettings(settings);
        setBackgroundColorState(settings.backgroundColor);
        setTextColorState(settings.textColor);
        setCornerRadiusPxState(settings.cornerRadiusPx);
        setSavedSettings(settings);
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
    applyTooltipCssVariables(currentSettings);
  }, [currentSettings]);

  useEffect(() => {
    function handleBackgroundColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setBackgroundColorState(nextColor);
      }
    }

    function handleTextColorChange(event: Event) {
      const nextColor = (event as CustomEvent<string>).detail;
      if (nextColor && normalizeHexColor(nextColor)) {
        setTextColorState(nextColor);
      }
    }

    function handleCornerRadiusChange(event: Event) {
      const nextRadius = (event as CustomEvent<number>).detail;
      if (Number.isFinite(nextRadius)) {
        setCornerRadiusPxState(normalizeCornerRadiusPx(nextRadius));
      }
    }

    window.addEventListener(
      BACKGROUND_COLOR_CHANGE_EVENT,
      handleBackgroundColorChange,
    );
    window.addEventListener(TEXT_COLOR_CHANGE_EVENT, handleTextColorChange);
    window.addEventListener(
      CORNER_RADIUS_CHANGE_EVENT,
      handleCornerRadiusChange,
    );
    return () => {
      window.removeEventListener(
        BACKGROUND_COLOR_CHANGE_EVENT,
        handleBackgroundColorChange,
      );
      window.removeEventListener(TEXT_COLOR_CHANGE_EVENT, handleTextColorChange);
      window.removeEventListener(
        CORNER_RADIUS_CHANGE_EVENT,
        handleCornerRadiusChange,
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

  const setBackgroundColor = useCallback((color: string) => {
    const normalized =
      normalizeHexColor(color) ?? DEFAULT_TOOLTIP_BACKGROUND_COLOR;
    setTooltipBackgroundColor(normalized);
    setBackgroundColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setTextColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color) ?? DEFAULT_TOOLTIP_TEXT_COLOR;
    setTooltipTextColor(normalized);
    setTextColorState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const setCornerRadius = useCallback((value: number | string) => {
    const normalized = normalizeCornerRadiusPx(value);
    setTooltipCornerRadiusPx(normalized);
    setCornerRadiusPxState(normalized);
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  const saveSettings = useCallback(
    async (settingsOverride?: TooltipSettings) => {
      const settingsToSave =
        settingsOverride ?? normalizeTooltipSettings(currentSettings);

      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      try {
        const saved = await persistTooltipSettings(settingsToSave);
        applyTooltipSettings(saved);
        setBackgroundColorState(saved.backgroundColor);
        setTextColorState(saved.textColor);
        setCornerRadiusPxState(saved.cornerRadiusPx);
        setSavedSettings(saved);
        setSaveSuccess(true);
      } catch (error) {
        console.error(error);
        setSaveError("Could not save tooltip settings.");
      } finally {
        setIsSaving(false);
      }
    },
    [currentSettings],
  );

  const replaceSettings = useCallback(
    (
      settings: TooltipSettings,
      options?: {
        markSaved?: boolean;
      },
    ) => {
      const normalized = normalizeTooltipSettings(settings);
      applyTooltipSettings(normalized);
      setBackgroundColorState(normalized.backgroundColor);
      setTextColorState(normalized.textColor);
      setCornerRadiusPxState(normalized.cornerRadiusPx);
      if (options?.markSaved) {
        setSavedSettings(normalized);
      }
      setSaveSuccess(false);
      setSaveError(null);
    },
    [],
  );

  return {
    backgroundColor,
    textColor,
    cornerRadiusPx,
    currentSettings,
    savedSettings,
    isLoading,
    isSaving,
    isDirty,
    saveError,
    saveSuccess,
    setBackgroundColor,
    setTextColor,
    setCornerRadius,
    saveSettings,
    replaceSettings,
  };
}
