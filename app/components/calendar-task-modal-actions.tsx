"use client";

import { createContext, useContext, useMemo } from "react";
import type { Label } from "./task-label-selector";
import type { TaskListItem, TodoList } from "./todo-app";

export type CalendarTaskModalActions = {
  tasks: TaskListItem[];
  lists: TodoList[];
  labels: Label[];
  onSetTaskPriority?: (taskId: string, priority: number | null) => void;
  onToggleTaskLabel?: (
    taskId: string,
    labelId: string,
    assigned: boolean,
  ) => Promise<{ id: string; label: string }[]>;
  onLabelsChanged?: () => void;
  onMoveTaskToList?: (
    taskId: string,
    sourceListId: string,
    targetListId: string,
  ) => void;
  onDeleteTask?: (taskId: string) => void | Promise<void>;
};

const CalendarTaskModalActionsContext =
  createContext<CalendarTaskModalActions | null>(null);

export function CalendarTaskModalActionsProvider({
  value,
  children,
}: {
  value: CalendarTaskModalActions | null;
  children: React.ReactNode;
}) {
  return (
    <CalendarTaskModalActionsContext.Provider value={value}>
      {children}
    </CalendarTaskModalActionsContext.Provider>
  );
}

export function useCalendarTaskModalActions() {
  return useContext(CalendarTaskModalActionsContext);
}

export function useCalendarTaskModalTask(taskId: string) {
  const actions = useCalendarTaskModalActions();

  return useMemo(
    () => actions?.tasks.find((task) => task.id === taskId) ?? null,
    [actions?.tasks, taskId],
  );
}
