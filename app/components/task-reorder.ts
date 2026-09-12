import { getDropIndex } from "./detail-lines";

export function getTaskRowElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-task-id]"),
  );
}

export function getSectionActiveTaskIds<
  T extends { id: string; completed: boolean; pinned: boolean },
>(allTasks: T[], section: "pinned" | "unpinned") {
  return allTasks
    .filter((task) => {
      if (task.completed) return false;
      return section === "pinned" ? task.pinned : !task.pinned;
    })
    .map((task) => task.id);
}

export function expandSectionReorderIds(
  nextVisibleIds: string[],
  allTasks: Array<{
    id: string;
    completed: boolean;
    pinned: boolean;
  }>,
  section: "pinned" | "unpinned",
) {
  const sectionIds = getSectionActiveTaskIds(allTasks, section);

  if (nextVisibleIds.length === sectionIds.length) {
    return nextVisibleIds;
  }

  const missingIds = new Set(
    sectionIds.filter((id) => !nextVisibleIds.includes(id)),
  );
  if (missingIds.size === 0) {
    return nextVisibleIds;
  }

  const result: string[] = [];
  const visibleQueue = [...nextVisibleIds];

  for (const id of sectionIds) {
    if (missingIds.has(id)) {
      result.push(id);
      continue;
    }

    const nextVisibleId = visibleQueue.shift();
    if (nextVisibleId) {
      result.push(nextVisibleId);
    }
  }

  return result;
}

export function mergeReorderedPinnedTasks<
  T extends { id: string; completed: boolean; pinned: boolean },
>(allTasks: T[], reorderedPinnedActiveIds: string[]) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const reorderedPinned = reorderedPinnedActiveIds
    .map((id) => taskMap.get(id))
    .filter((task): task is T => task !== undefined);

  let pinnedActiveIndex = 0;

  return allTasks.map((task) => {
    if (task.completed || !task.pinned) return task;

    const next = reorderedPinned[pinnedActiveIndex];
    pinnedActiveIndex += 1;
    return next ?? task;
  });
}

export function mergeReorderedUnpinnedTasks<
  T extends { id: string; completed: boolean; pinned: boolean },
>(allTasks: T[], reorderedUnpinnedActiveIds: string[]) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const reorderedUnpinned = reorderedUnpinnedActiveIds
    .map((id) => taskMap.get(id))
    .filter((task): task is T => task !== undefined);

  let unpinnedActiveIndex = 0;

  return allTasks.map((task) => {
    if (task.completed || task.pinned) return task;

    const next = reorderedUnpinned[unpinnedActiveIndex];
    unpinnedActiveIndex += 1;
    return next ?? task;
  });
}

export function mergeReorderedActiveTasks<T extends { id: string; completed: boolean }>(
  allTasks: T[],
  reorderedActiveIds: string[],
) {
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const reorderedActive = reorderedActiveIds
    .map((id) => taskMap.get(id))
    .filter((task): task is T => task !== undefined);

  let activeIndex = 0;

  return allTasks.map((task) => {
    if (task.completed) return task;

    const next = reorderedActive[activeIndex];
    activeIndex += 1;
    return next ?? task;
  });
}

export function getReorderTargetIndex(sourceIndex: number, dropIndex: number) {
  let targetIndex = dropIndex;
  if (sourceIndex < dropIndex) {
    targetIndex -= 1;
  }
  return targetIndex;
}

export function reorderTaskIds(
  taskIds: string[],
  sourceIndex: number,
  dropIndex: number,
) {
  if (sourceIndex < 0 || sourceIndex >= taskIds.length) return taskIds;

  const targetIndex = getReorderTargetIndex(sourceIndex, dropIndex);
  if (targetIndex === sourceIndex) return taskIds;

  const next = [...taskIds];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function getTaskDropIndex(
  clientY: number,
  rows: HTMLElement[],
  draggingIndex: number | null = null,
) {
  return getDropIndex(clientY, rows, draggingIndex);
}
