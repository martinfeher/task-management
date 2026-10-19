"use client";

import { useCallback, useSyncExternalStore } from "react";

export const COMPACT_LAYOUT_MEDIA_QUERY = "(max-width: 1023px)";
export const NARROW_DESKTOP_TASK_LIST_MEDIA_QUERY = "(max-width: 1699px)";

function subscribeToMediaQuery(query: string, onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getMediaQuerySnapshot(query: string) {
  return window.matchMedia(query).matches;
}

function getMediaQueryServerSnapshot() {
  return false;
}

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      subscribeToMediaQuery(query, onStoreChange),
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => getMediaQuerySnapshot(query),
    getMediaQueryServerSnapshot,
  );
}
