"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  applyCalendarTaskMovePlacement,
  shouldIgnoreCalendarMoveUndoShortcut,
  type CalendarTaskMoveHandlers,
  type CalendarTaskMoveSnapshot,
} from "@/lib/calendar-task-move-undo";

const MAX_CALENDAR_MOVE_UNDO_HISTORY = 50;

type CalendarTaskMoveUndoContextValue = {
  recordCalendarTaskMove: (snapshot: CalendarTaskMoveSnapshot) => void;
};

const CalendarTaskMoveUndoContext =
  createContext<CalendarTaskMoveUndoContextValue | null>(null);

export function useRecordCalendarTaskMove() {
  return useContext(CalendarTaskMoveUndoContext)?.recordCalendarTaskMove ?? null;
}

type CalendarTaskMoveUndoProviderProps = CalendarTaskMoveHandlers & {
  children: ReactNode;
};

export function CalendarTaskMoveUndoProvider({
  children,
  onSetTaskDueDate,
  onSetTaskDueTime,
  onSetTaskDueDateAndTime,
}: CalendarTaskMoveUndoProviderProps) {
  const undoStackRef = useRef<CalendarTaskMoveSnapshot[]>([]);
  const redoStackRef = useRef<CalendarTaskMoveSnapshot[]>([]);

  const handlersRef = useRef<CalendarTaskMoveHandlers>({
    onSetTaskDueDate,
    onSetTaskDueTime,
    onSetTaskDueDateAndTime,
  });
  handlersRef.current = {
    onSetTaskDueDate,
    onSetTaskDueTime,
    onSetTaskDueDateAndTime,
  };

  const applySnapshot = useCallback(
  (snapshot: CalendarTaskMoveSnapshot, mode: "before" | "after") => {
    const placement = mode === "before" ? snapshot.before : snapshot.after;
    applyCalendarTaskMovePlacement(
      snapshot.taskId,
      placement,
      handlersRef.current,
    );
  },
  [],
);

  const recordCalendarTaskMove = useCallback(
    (snapshot: CalendarTaskMoveSnapshot) => {
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > MAX_CALENDAR_MOVE_UNDO_HISTORY) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
    },
    [],
  );

  const undoCalendarTaskMove = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;

    applySnapshot(snapshot, "before");
    redoStackRef.current.push(snapshot);
    if (redoStackRef.current.length > MAX_CALENDAR_MOVE_UNDO_HISTORY) {
      redoStackRef.current.shift();
    }
  }, [applySnapshot]);

  const redoCalendarTaskMove = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) return;

    applySnapshot(snapshot, "after");
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_CALENDAR_MOVE_UNDO_HISTORY) {
      undoStackRef.current.shift();
    }
  }, [applySnapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (shouldIgnoreCalendarMoveUndoShortcut(event.target)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo =
        (key === "z" && event.shiftKey) ||
        (key === "y" && event.ctrlKey && !event.metaKey);

      if (!isUndo && !isRedo) return;

      if (isUndo) {
        if (undoStackRef.current.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        undoCalendarTaskMove();
        return;
      }

      if (redoStackRef.current.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      redoCalendarTaskMove();
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [redoCalendarTaskMove, undoCalendarTaskMove]);

  const contextValue = useMemo(
    () => ({ recordCalendarTaskMove }),
    [recordCalendarTaskMove],
  );

  return (
    <CalendarTaskMoveUndoContext.Provider value={contextValue}>
      {children}
    </CalendarTaskMoveUndoContext.Provider>
  );
}
