"use client";

import { createPortal } from "react-dom";
import { LuList } from "react-icons/lu";
import { FROSTED_POPOVER_SURFACE_CLASS } from "@/lib/frosted-popover-surface";
import { getListColor } from "@/lib/list-colors";
import type { TaskListItem, TodoList } from "./todo-app";
import type { SidebarListPreviewRect } from "./sidebar-list-task-preview";

const MAX_LISTS = 8;
const MAX_TASKS_PER_LIST = 6;

type SidebarFolderListsPreviewProps = {
  folderName: string;
  listsInFolder: TodoList[];
  tasksByList: Record<string, TaskListItem[]>;
  panelRect: SidebarListPreviewRect;
};

export function SidebarFolderListsPreview({
  folderName,
  listsInFolder,
  tasksByList,
  panelRect,
}: SidebarFolderListsPreviewProps) {
  if (typeof document === "undefined") return null;

  const lists = listsInFolder.slice(0, MAX_LISTS);

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[120]"
      style={{
        top: panelRect.top,
        left: panelRect.left,
        width: panelRect.width,
        maxHeight: "min(70vh, 420px)",
      }}
    >
      <div
        className={`flex max-h-[min(70vh,420px)] flex-col overflow-hidden rounded-[14px] ${FROSTED_POPOVER_SURFACE_CLASS}`}
      >
        <div className="shrink-0 border-b border-zinc-200/80 px-3 py-2 dark:border-zinc-700/80">
          <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {folderName}
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {listsInFolder.length === 1
              ? "1 list"
              : `${listsInFolder.length} lists`}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {lists.length === 0 ? (
            <p className="px-1 py-2 text-xs text-zinc-500 dark:text-zinc-400">
              No lists in this folder
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lists.map((list) => {
                const tasks = (tasksByList[list.id] ?? [])
                  .filter((task) => !task.completed && !task.parentId)
                  .slice(0, MAX_TASKS_PER_LIST);

                return (
                  <li key={list.id}>
                    <div className="mb-1 flex items-center gap-1.5 px-1">
                      <LuList
                        className="size-3 shrink-0"
                        style={{ color: getListColor(list) }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                        {list.name}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">
                        {tasksByList[list.id]?.filter(
                          (t) => !t.completed && !t.parentId,
                        ).length ?? 0}
                      </span>
                    </div>
                    {tasks.length === 0 ? (
                      <p className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
                        No active tasks
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {tasks.map((task) => (
                          <li
                            key={task.id}
                            className="truncate px-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-300"
                            title={task.name}
                          >
                            {task.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {listsInFolder.length > MAX_LISTS ? (
            <p className="mt-2 px-1 text-[10px] text-zinc-400">
              +{listsInFolder.length - MAX_LISTS} more lists
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}