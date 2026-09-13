"use client";

import { useCallback, useEffect, useState } from "react";

export const INITIAL_TASK_EDITOR_FONT_SIZE_PX = 17;
export const TASK_EDITOR_FONT_SIZE_MIN_PX = 5;
export const TASK_EDITOR_FONT_SIZE_MAX_PX = 70;

export const INITIAL_TASK_EDITOR_LINE_HEIGHT = 1.7;
export const TASK_EDITOR_LINE_HEIGHT_MIN = 1;
export const TASK_EDITOR_LINE_HEIGHT_MAX = 23.5;
export const TASK_EDITOR_LINE_HEIGHT_STEP = 0.1;

export const TASK_EDITOR_DEFAULT_FONT_SIZE_CSS_VAR =
  "--task-editor-default-font-size";
export const TASK_EDITOR_DEFAULT_LINE_HEIGHT_CSS_VAR =
  "--task-editor-default-line-height";

const FONT_SIZE_STORAGE_KEY = "todolist.taskEditorDefaultFontSizePx";
const LINE_HEIGHT_STORAGE_KEY = "todolist.taskEditorDefaultLineHeight";
const CHANGE_EVENT = "todolist:task-editor-defaults-change";

export type TaskEditorDefaults = {
  fontSizePx: number;
  lineHeight: number;
};

function clampFontSizePx(value: number) {
  return Math.min(
    TASK_EDITOR_FONT_SIZE_MAX_PX,
    Math.max(TASK_EDITOR_FONT_SIZE_MIN_PX, Math.round(value)),
  );
}

export function normalizeTaskEditorLineHeight(value: string | number) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed)) {
    return INITIAL_TASK_EDITOR_LINE_HEIGHT;
  }

  const clamped = Math.min(
    TASK_EDITOR_LINE_HEIGHT_MAX,
    Math.max(TASK_EDITOR_LINE_HEIGHT_MIN, parsed),
  );
  const stepped =
    Math.round(clamped / TASK_EDITOR_LINE_HEIGHT_STEP) *
    TASK_EDITOR_LINE_HEIGHT_STEP;

  return Number(stepped.toFixed(1));
}

export function readTaskEditorDefaultsFromStorage(): TaskEditorDefaults {
  if (typeof window === "undefined") {
    return {
      fontSizePx: INITIAL_TASK_EDITOR_FONT_SIZE_PX,
      lineHeight: INITIAL_TASK_EDITOR_LINE_HEIGHT,
    };
  }

  const storedFontSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  const storedLineHeight = window.localStorage.getItem(LINE_HEIGHT_STORAGE_KEY);

  const fontSizePx =
    storedFontSize === null
      ? INITIAL_TASK_EDITOR_FONT_SIZE_PX
      : clampFontSizePx(Number.parseInt(storedFontSize, 10));

  const lineHeight =
    storedLineHeight === null
      ? INITIAL_TASK_EDITOR_LINE_HEIGHT
      : normalizeTaskEditorLineHeight(storedLineHeight);

  return { fontSizePx, lineHeight };
}

export function applyTaskEditorDefaults(defaults: TaskEditorDefaults) {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty(
    TASK_EDITOR_DEFAULT_FONT_SIZE_CSS_VAR,
    `${defaults.fontSizePx}px`,
  );
  document.documentElement.style.setProperty(
    TASK_EDITOR_DEFAULT_LINE_HEIGHT_CSS_VAR,
    String(defaults.lineHeight),
  );
}

export function getDefaultDetailFontSizePx() {
  if (typeof document === "undefined") {
    return INITIAL_TASK_EDITOR_FONT_SIZE_PX;
  }

  const cssValue = document.documentElement.style
    .getPropertyValue(TASK_EDITOR_DEFAULT_FONT_SIZE_CSS_VAR)
    .trim();

  if (cssValue) {
    const parsed = Number.parseInt(cssValue, 10);
    if (Number.isFinite(parsed)) {
      return clampFontSizePx(parsed);
    }
  }

  return readTaskEditorDefaultsFromStorage().fontSizePx;
}

export function getDefaultDetailLineHeight() {
  if (typeof document === "undefined") {
    return INITIAL_TASK_EDITOR_LINE_HEIGHT;
  }

  const cssValue = document.documentElement.style
    .getPropertyValue(TASK_EDITOR_DEFAULT_LINE_HEIGHT_CSS_VAR)
    .trim();

  if (cssValue) {
    return normalizeTaskEditorLineHeight(cssValue);
  }

  return readTaskEditorDefaultsFromStorage().lineHeight;
}

function persistTaskEditorDefaults(defaults: TaskEditorDefaults) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    FONT_SIZE_STORAGE_KEY,
    String(defaults.fontSizePx),
  );
  window.localStorage.setItem(
    LINE_HEIGHT_STORAGE_KEY,
    String(defaults.lineHeight),
  );
  applyTaskEditorDefaults(defaults);
  window.dispatchEvent(
    new CustomEvent<TaskEditorDefaults>(CHANGE_EVENT, { detail: defaults }),
  );
}

export function setTaskEditorDefaults(defaults: TaskEditorDefaults) {
  persistTaskEditorDefaults({
    fontSizePx: clampFontSizePx(defaults.fontSizePx),
    lineHeight: normalizeTaskEditorLineHeight(defaults.lineHeight),
  });
}

export function useTaskEditorDefaults() {
  const [defaults, setDefaultsState] = useState<TaskEditorDefaults>(() =>
    readTaskEditorDefaultsFromStorage(),
  );

  useEffect(() => {
    const stored = readTaskEditorDefaultsFromStorage();
    setDefaultsState(stored);
    applyTaskEditorDefaults(stored);

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<TaskEditorDefaults>;
      if (
        customEvent.detail &&
        typeof customEvent.detail.fontSizePx === "number" &&
        typeof customEvent.detail.lineHeight === "number"
      ) {
        setDefaultsState(customEvent.detail);
        return;
      }

      setDefaultsState(readTaskEditorDefaultsFromStorage());
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const setDefaultFontSizePx = useCallback((fontSizePx: number) => {
    const next = {
      ...readTaskEditorDefaultsFromStorage(),
      fontSizePx: clampFontSizePx(fontSizePx),
    };
    setTaskEditorDefaults(next);
    setDefaultsState(next);
  }, []);

  const setDefaultLineHeight = useCallback((lineHeight: number) => {
    const next = {
      ...readTaskEditorDefaultsFromStorage(),
      lineHeight: normalizeTaskEditorLineHeight(lineHeight),
    };
    setTaskEditorDefaults(next);
    setDefaultsState(next);
  }, []);

  return {
    defaultFontSizePx: defaults.fontSizePx,
    defaultLineHeight: defaults.lineHeight,
    setDefaultFontSizePx,
    setDefaultLineHeight,
  };
}
