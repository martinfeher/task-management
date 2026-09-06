"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "todolist.importantEnabled";
const CHANGE_EVENT = "todolist:important-enabled-change";

export function readImportantEnabledFromStorage() {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;

  return stored === "true";
}

export function setImportantEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }),
  );
}

export function useImportantEnabled() {
  const [importantEnabled, setImportantEnabledState] = useState(true);

  useEffect(() => {
    setImportantEnabledState(readImportantEnabledFromStorage());

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setImportantEnabledState(customEvent.detail);
        return;
      }

      setImportantEnabledState(readImportantEnabledFromStorage());
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const updateImportantEnabled = useCallback((enabled: boolean) => {
    setImportantEnabled(enabled);
    setImportantEnabledState(enabled);
  }, []);

  return {
    importantEnabled,
    setImportantEnabled: updateImportantEnabled,
  };
}
