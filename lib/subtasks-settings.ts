"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "todolist.subtasksEnabled";
const CHANGE_EVENT = "todolist:subtasks-enabled-change";

export function readSubtasksEnabledFromStorage() {
  if (typeof window === "undefined") return false;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return false;

  return stored === "true";
}

export function setSubtasksEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }),
  );
}

export function useSubtasksEnabled() {
  const [subtasksEnabled, setSubtasksEnabledState] = useState(false);

  useEffect(() => {
    setSubtasksEnabledState(readSubtasksEnabledFromStorage());

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setSubtasksEnabledState(customEvent.detail);
        return;
      }

      setSubtasksEnabledState(readSubtasksEnabledFromStorage());
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const updateSubtasksEnabled = useCallback((enabled: boolean) => {
    setSubtasksEnabled(enabled);
    setSubtasksEnabledState(enabled);
  }, []);

  return {
    subtasksEnabled,
    setSubtasksEnabled: updateSubtasksEnabled,
  };
}
