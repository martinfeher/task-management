import { useSyncExternalStore } from "react";

import type { TaskRowContextMenuView } from "@/app/components/task-row-context-menu";
import type { TaskListItem } from "@/app/components/todo-app";

export type TaskListPointerContextMenuState = {
  taskId: string;
  task: TaskListItem;
  x: number;
  y: number;
  view: TaskRowContextMenuView;
};

export type TaskListTitleEditSession = {
  taskId: string;
  name: string;
};

type Listener = () => void;

let pointerMenuSnapshot: TaskListPointerContextMenuState | null = null;
let pointerMenuSuppressCloseUntil = 0;
const pointerMenuListeners = new Set<Listener>();

let titleEditSnapshot: TaskListTitleEditSession | null = null;
const titleEditListeners = new Set<Listener>();

function emitPointerMenuListeners() {
  pointerMenuListeners.forEach((listener) => listener());
}

function emitTitleEditListeners() {
  titleEditListeners.forEach((listener) => listener());
}

function subscribePointerMenu(listener: Listener) {
  pointerMenuListeners.add(listener);
  return () => {
    pointerMenuListeners.delete(listener);
  };
}

function subscribeTitleEdit(listener: Listener) {
  titleEditListeners.add(listener);
  return () => {
    titleEditListeners.delete(listener);
  };
}

export function getTaskListPointerMenuSnapshot() {
  return pointerMenuSnapshot;
}

export function getTaskListTitleEditSnapshot() {
  return titleEditSnapshot;
}

export function useTaskListPointerMenu() {
  return useSyncExternalStore(
    subscribePointerMenu,
    getTaskListPointerMenuSnapshot,
    getTaskListPointerMenuSnapshot,
  );
}

export function useTaskListTitleEditSession() {
  return useSyncExternalStore(
    subscribeTitleEdit,
    getTaskListTitleEditSnapshot,
    getTaskListTitleEditSnapshot,
  );
}

export function shouldSuppressTaskListPointerMenuClose() {
  return (
    pointerMenuSnapshot !== null && Date.now() < pointerMenuSuppressCloseUntil
  );
}

export function openTaskListPointerMenu(
  menu: TaskListPointerContextMenuState,
  suppressCloseMs = 900,
) {
  pointerMenuSnapshot = menu;
  pointerMenuSuppressCloseUntil = Date.now() + suppressCloseMs;
  emitPointerMenuListeners();
}

export function updateTaskListPointerMenu(
  updater: (
    current: TaskListPointerContextMenuState | null,
  ) => TaskListPointerContextMenuState | null,
) {
  pointerMenuSnapshot = updater(pointerMenuSnapshot);
  emitPointerMenuListeners();
}

export function closeTaskListPointerMenu() {
  pointerMenuSnapshot = null;
  pointerMenuSuppressCloseUntil = 0;
  emitPointerMenuListeners();
}

export function stashTaskListTitleEdit(taskId: string, name: string) {
  titleEditSnapshot = { taskId, name };
  emitTitleEditListeners();
}

export function clearTaskListTitleEdit() {
  if (titleEditSnapshot === null) return;
  titleEditSnapshot = null;
  emitTitleEditListeners();
}
