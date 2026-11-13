"use client";

const WIDTH_STORAGE_KEY = "todolist.taskListPanelWidth";
const CUSTOMIZED_STORAGE_KEY = "todolist.taskListPanelWidthCustomized";

export function readTaskListPanelWidthFromStorage() {
  if (typeof window === "undefined") return null;

  const stored = window.localStorage.getItem(WIDTH_STORAGE_KEY);
  if (stored === null) return null;

  const parsed = Number(stored);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

export function readTaskListPanelWidthCustomizedFromStorage() {
  if (typeof window === "undefined") return false;

  return window.localStorage.getItem(CUSTOMIZED_STORAGE_KEY) === "true";
}

export function saveTaskListPanelWidth(width: number, customized: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
  window.localStorage.setItem(
    CUSTOMIZED_STORAGE_KEY,
    customized ? "true" : "false",
  );
}
