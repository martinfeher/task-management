import { useSyncExternalStore } from "react";

export const TASK_RESTORE_FADE_MS = 450;

let restoredTaskIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Flags a task row so it fades in when it is re-created in the list
 * (e.g. after undoing "Task completed"). Call before the task is restored.
 */
export function markTaskRestoredForFade(taskId: string) {
  const existingTimer = timers.get(taskId);
  if (existingTimer) clearTimeout(existingTimer);

  restoredTaskIds = new Set(restoredTaskIds).add(taskId);
  emit();

  timers.set(
    taskId,
    setTimeout(() => {
      timers.delete(taskId);
      if (!restoredTaskIds.has(taskId)) return;
      const next = new Set(restoredTaskIds);
      next.delete(taskId);
      restoredTaskIds = next;
      emit();
    }, TASK_RESTORE_FADE_MS + 50),
  );
}

export function useIsTaskRestoredForFade(taskId: string) {
  return useSyncExternalStore(
    subscribe,
    () => restoredTaskIds.has(taskId),
    () => false,
  );
}
