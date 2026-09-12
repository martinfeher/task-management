"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "todolist.listPreviewEnabled";
const CHANGE_EVENT = "todolist:list-preview-enabled-change";

export function readListPreviewEnabledFromStorage() {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;

  return stored === "true";
}

export function setListPreviewEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  window.dispatchEvent(
    new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }),
  );
}

export function useListPreviewEnabled() {
  const [listPreviewEnabled, setListPreviewEnabledState] = useState(true);

  useEffect(() => {
    setListPreviewEnabledState(readListPreviewEnabledFromStorage());

    function handleChange(event: Event) {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setListPreviewEnabledState(customEvent.detail);
        return;
      }

      setListPreviewEnabledState(readListPreviewEnabledFromStorage());
    }

    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const updateListPreviewEnabled = useCallback((enabled: boolean) => {
    setListPreviewEnabled(enabled);
    setListPreviewEnabledState(enabled);
  }, []);

  return {
    listPreviewEnabled,
    setListPreviewEnabled: updateListPreviewEnabled,
  };
}
