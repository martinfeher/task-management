"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "todolist.addTaskNoteSwitchEnabled";
const CHANGE_EVENT = "todolist:add-task-note-switch-enabled-change";

export function readAddTaskNoteSwitchEnabledFromStorage() {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;

  return stored === "true";
}

export function setAddTaskNoteSwitchEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }),
  );
}

export function useAddTaskNoteSwitchEnabled() {
  const [addTaskNoteSwitchEnabled, setAddTaskNoteSwitchEnabledState] =
    useState(true);

  useEffect(() => {
    setAddTaskNoteSwitchEnabledState(readAddTaskNoteSwitchEnabledFromStorage());

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setAddTaskNoteSwitchEnabledState(customEvent.detail);
        return;
      }

      setAddTaskNoteSwitchEnabledState(
        readAddTaskNoteSwitchEnabledFromStorage(),
      );
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const updateAddTaskNoteSwitchEnabled = useCallback((enabled: boolean) => {
    setAddTaskNoteSwitchEnabled(enabled);
    setAddTaskNoteSwitchEnabledState(enabled);
  }, []);

  return {
    addTaskNoteSwitchEnabled,
    setAddTaskNoteSwitchEnabled: updateAddTaskNoteSwitchEnabled,
  };
}
