"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  buildCalendarDateNavigationSnapshot,
  calendarDateNavigationSnapshotsEqual,
  type CalendarDateNavigationPanelState,
  type CalendarDateNavigationSnapshot,
} from "@/lib/calendar-date-navigation-undo";
import { shouldIgnoreCalendarMoveUndoShortcut } from "@/lib/calendar-task-move-undo";
import {
  fromDateKey,
  startOfDay,
  toDateKey,
} from "@/app/components/calendar-mini-month";

const MAX_CALENDAR_DATE_NAVIGATION_UNDO_HISTORY = 50;

type CalendarDateNavigationUndoContextValue = {
  recordCalendarDateNavigation: () => void;
  registerActiveViewAnchorDateKey: (anchorDateKey: string | null) => void;
};

const CalendarDateNavigationUndoContext =
  createContext<CalendarDateNavigationUndoContextValue | null>(null);

export function useRecordCalendarDateNavigation() {
  return (
    useContext(CalendarDateNavigationUndoContext)?.recordCalendarDateNavigation ??
    null
  );
}

export function useRegisterCalendarDateNavigationAnchor() {
  return (
    useContext(CalendarDateNavigationUndoContext)
      ?.registerActiveViewAnchorDateKey ?? null
  );
}

type CalendarDateNavigationUndoProviderProps = {
  children: ReactNode;
  getPanelNavigationState: () => CalendarDateNavigationPanelState;
  onRestore: (snapshot: CalendarDateNavigationSnapshot) => void;
  recordRef?: MutableRefObject<(() => void) | null>;
};

export function CalendarDateNavigationUndoProvider({
  children,
  getPanelNavigationState,
  onRestore,
  recordRef,
}: CalendarDateNavigationUndoProviderProps) {
  const undoStackRef = useRef<CalendarDateNavigationSnapshot[]>([]);
  const activeAnchorDateKeyRef = useRef<string | null>(null);
  const getPanelNavigationStateRef = useRef(getPanelNavigationState);
  const onRestoreRef = useRef(onRestore);

  getPanelNavigationStateRef.current = getPanelNavigationState;
  onRestoreRef.current = onRestore;

  const registerActiveViewAnchorDateKey = useCallback(
    (anchorDateKey: string | null) => {
      activeAnchorDateKeyRef.current = anchorDateKey;
    },
    [],
  );

  const recordCalendarDateNavigation = useCallback(() => {
    const anchorDateKey = activeAnchorDateKeyRef.current;
    if (!anchorDateKey) return;

    const snapshot = buildCalendarDateNavigationSnapshot(
      anchorDateKey,
      getPanelNavigationStateRef.current(),
    );

    const stack = undoStackRef.current;
    const top = stack[stack.length - 1];
    if (top && calendarDateNavigationSnapshotsEqual(top, snapshot)) {
      return;
    }

    stack.push(snapshot);
    if (stack.length > MAX_CALENDAR_DATE_NAVIGATION_UNDO_HISTORY) {
      stack.shift();
    }
  }, []);

  useEffect(() => {
    if (!recordRef) return;
    recordRef.current = recordCalendarDateNavigation;
    return () => {
      recordRef.current = null;
    };
  }, [recordCalendarDateNavigation, recordRef]);

  const undoCalendarDateNavigation = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    onRestoreRef.current(snapshot);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (shouldIgnoreCalendarMoveUndoShortcut(event.target)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      if (!isUndo) return;
      if (undoStackRef.current.length === 0) return;

      event.preventDefault();
      event.stopPropagation();
      undoCalendarDateNavigation();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [undoCalendarDateNavigation]);

  const contextValue = useMemo(
    () => ({
      recordCalendarDateNavigation,
      registerActiveViewAnchorDateKey,
    }),
    [recordCalendarDateNavigation, registerActiveViewAnchorDateKey],
  );

  return (
    <CalendarDateNavigationUndoContext.Provider value={contextValue}>
      {children}
    </CalendarDateNavigationUndoContext.Provider>
  );
}

export function useSyncCalendarDateNavigationAnchor(anchorDate: Date | null) {
  const registerActiveViewAnchorDateKey = useRegisterCalendarDateNavigationAnchor();

  useEffect(() => {
    if (!registerActiveViewAnchorDateKey) return;
    registerActiveViewAnchorDateKey(
      anchorDate ? toDateKey(anchorDate) : null,
    );
    return () => registerActiveViewAnchorDateKey(null);
  }, [anchorDate, registerActiveViewAnchorDateKey]);
}

export function useApplyCalendarDateNavigationRestore(
  snapshot: CalendarDateNavigationSnapshot | null | undefined,
  requestId: number | undefined,
  apply: (snapshot: CalendarDateNavigationSnapshot) => void,
) {
  const lastRequestIdRef = useRef(0);

  useEffect(() => {
    if (
      requestId === undefined ||
      requestId === 0 ||
      requestId === lastRequestIdRef.current ||
      !snapshot
    ) {
      return;
    }

    lastRequestIdRef.current = requestId;
    apply(snapshot);
  }, [apply, requestId, snapshot]);
}

export function parseCalendarDateNavigationAnchor(
  snapshot: CalendarDateNavigationSnapshot,
) {
  const parsed = fromDateKey(snapshot.anchorDateKey);
  return parsed ? startOfDay(parsed) : null;
}
