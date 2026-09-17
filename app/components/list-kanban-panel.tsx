"use client";

import {
  FormEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LuList, LuPlus, LuX } from "react-icons/lu";
import type { KanbanColumnRecord } from "@/app/actions/kanban";
import { getListColor } from "@/lib/list-colors";
import {
  createKanbanTaskDragGhost,
  KANBAN_DRAG_THRESHOLD_PX,
  KANBAN_DROP_INDICATOR_COLOR,
  KANBAN_TASK_DRAG_SOURCE_CLASS,
  resolveKanbanDropTarget,
  shouldStartKanbanTaskDrag,
  tryReleasePointerCapture,
  trySetPointerCapture,
  updateKanbanTaskDragGhostPosition,
} from "./kanban-task-drag";
import { ConfirmModal } from "./confirm-modal";
import type { TaskListItem, TodoList } from "./todo-app";

const NOT_ASSIGNED_COLUMN_NAME = "Not assigned";

type ListKanbanPanelProps = {
  list: TodoList;
  columns: KanbanColumnRecord[];
  tasks: TaskListItem[];
  onToggleTask: (taskId: string) => void;
  onAddColumn: (name: string) => Promise<void> | void;
  onAddTask: (columnId: string, name: string) => Promise<void> | void;
  onMoveTask: (
    taskId: string,
    targetColumnId: string,
    targetIndex: number,
  ) => Promise<void> | void;
  onRemoveColumn: (columnId: string) => Promise<void> | void;
  showSidebarMenu?: boolean;
  onOpenSidebar?: () => void;
};

type ColumnAddTaskState = {
  columnId: string;
  value: string;
};

type KanbanDragState = {
  sourceRow: HTMLElement;
  captureTarget: HTMLElement;
  sourceTaskId: string;
  sourceColumnId: string;
  sourceIndex: number;
  dropColumnId: string;
  dropIndex: number;
  pointerId: number;
  lastPointerX: number;
  lastPointerY: number;
  dragGhost: HTMLElement | null;
  ghostPointerOffsetX: number;
  ghostPointerOffsetY: number;
};

type DropIndicatorState = {
  columnId: string;
  top: number;
} | null;

type ColumnPendingRemoval = {
  column: KanbanColumnRecord;
  taskCount: number;
};

export function ListKanbanPanel({
  list,
  columns,
  tasks,
  onToggleTask,
  onAddColumn,
  onAddTask,
  onMoveTask,
  onRemoveColumn,
  showSidebarMenu = false,
  onOpenSidebar,
}: ListKanbanPanelProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingTask, setAddingTask] = useState<ColumnAddTaskState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [columnPendingRemoval, setColumnPendingRemoval] =
    useState<ColumnPendingRemoval | null>(null);
  const columnInputRef = useRef<HTMLInputElement>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef<KanbanDragState | null>(null);
  const listColor = getListColor({ color: list.color ?? null });

  const tasksByColumnId = useMemo(() => {
    const grouped = new Map<string, TaskListItem[]>();

    for (const column of columns) {
      grouped.set(column.id, []);
    }

    for (const task of tasks) {
      if (task.completed || task.parentId) continue;
      const columnId = task.kanbanColumnId;
      if (!columnId || !grouped.has(columnId)) continue;
      grouped.get(columnId)?.push(task);
    }

    return grouped;
  }, [columns, tasks]);

  function clearDragVisuals(dragState: KanbanDragState) {
    dragState.dragGhost?.remove();
    dragState.dragGhost = null;
    dragState.sourceRow.classList.remove(
      KANBAN_TASK_DRAG_SOURCE_CLASS,
      "task-row-dragging",
    );
    dragState.sourceRow.style.transform = "";
    dragState.sourceRow.style.cursor = "";
  }

  function ensureDragVisuals(
    dragState: KanbanDragState,
    clientX: number,
    clientY: number,
  ) {
    if (!dragState.dragGhost) {
      const rect = dragState.sourceRow.getBoundingClientRect();
      dragState.ghostPointerOffsetX = clientX - rect.left;
      dragState.ghostPointerOffsetY = clientY - rect.top;
      dragState.dragGhost = createKanbanTaskDragGhost(dragState.sourceRow);
    }

    dragState.sourceRow.classList.add(
      KANBAN_TASK_DRAG_SOURCE_CLASS,
      "task-row-dragging",
    );

    updateKanbanTaskDragGhostPosition(
      dragState.dragGhost,
      clientX,
      clientY,
      dragState.ghostPointerOffsetX,
      dragState.ghostPointerOffsetY,
    );
  }

  function handleDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    dragState.lastPointerX = event.clientX;
    dragState.lastPointerY = event.clientY;
    ensureDragVisuals(dragState, event.clientX, event.clientY);

    const dropTarget = resolveKanbanDropTarget(
      event.clientX,
      event.clientY,
      dragState.sourceColumnId,
      dragState.sourceTaskId,
    );

    if (!dropTarget) {
      setDropIndicator(null);
      return;
    }

    dragState.dropColumnId = dropTarget.columnId;
    dragState.dropIndex = dropTarget.dropIndex;
    setDropIndicator({
      columnId: dropTarget.columnId,
      top: dropTarget.indicatorTop,
    });
  }

  function beginTaskDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceTaskId: string,
    sourceColumnId: string,
    sourceIndex: number,
    startClientX: number,
    startClientY: number,
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceTaskId,
      sourceColumnId,
      sourceIndex,
      dropColumnId: sourceColumnId,
      dropIndex: sourceIndex,
      pointerId,
      lastPointerX: startClientX,
      lastPointerY: startClientY,
      dragGhost: null,
      ghostPointerOffsetX:
        startClientX - sourceRow.getBoundingClientRect().left,
      ghostPointerOffsetY: startClientY - sourceRow.getBoundingClientRect().top,
    };

    ensureDragVisuals(dragStateRef.current, startClientX, startClientY);
    trySetPointerCapture(sourceRow, pointerId);
    sourceRow.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleDragMove);
    document.addEventListener("pointerup", handleDragEnd);
    document.addEventListener("pointercancel", handleDragEnd);
  }

  function handleDragEnd() {
    const dragState = dragStateRef.current;

    document.removeEventListener("pointermove", handleDragMove);
    document.removeEventListener("pointerup", handleDragEnd);
    document.removeEventListener("pointercancel", handleDragEnd);
    document.body.style.cursor = "";
    setDropIndicator(null);

    if (dragState) {
      tryReleasePointerCapture(dragState.captureTarget, dragState.pointerId);
      clearDragVisuals(dragState);

      let insertIndex = dragState.dropIndex;
      if (
        dragState.dropColumnId === dragState.sourceColumnId &&
        dragState.sourceIndex < dragState.dropIndex
      ) {
        insertIndex -= 1;
      }

      const moved =
        dragState.dropColumnId !== dragState.sourceColumnId ||
        insertIndex !== dragState.sourceIndex;

      if (moved) {
        void onMoveTask(
          dragState.sourceTaskId,
          dragState.dropColumnId,
          insertIndex,
        );
      }
    }

    dragStateRef.current = null;
  }

  function handleTaskPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    taskId: string,
    columnId: string,
    sourceIndex: number,
  ) {
    if (event.button !== 0) return;
    if (!shouldStartKanbanTaskDrag(event.target)) return;

    const sourceRow = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    trySetPointerCapture(sourceRow, pointerId);
    sourceRow.style.cursor = "move";

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < KANBAN_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginTaskDrag(
        sourceRow,
        pointerId,
        taskId,
        columnId,
        sourceIndex,
        startX,
        startY,
      );
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
      if (!dragStarted) {
        tryReleasePointerCapture(sourceRow, pointerId);
        sourceRow.style.cursor = "";
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  async function handleAddColumnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newColumnName.trim();
    if (!trimmed) return;

    await onAddColumn(trimmed);
    setNewColumnName("");
    setIsAddingColumn(false);
  }

  async function handleAddTaskSubmit(
    event: FormEvent<HTMLFormElement>,
    columnId: string,
  ) {
    event.preventDefault();
    if (!addingTask || addingTask.columnId !== columnId) return;

    const trimmed = addingTask.value.trim();
    if (!trimmed) return;

    await onAddTask(columnId, trimmed);
    setAddingTask(null);
  }

  function startAddTask(columnId: string) {
    setAddingTask({ columnId, value: "" });
    requestAnimationFrame(() => taskInputRef.current?.focus());
  }

  return (
    <div className="panel-text-scope flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbfc] dark:bg-zinc-950">
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        {showSidebarMenu ? (
          <button
            type="button"
            aria-label="Open menu"
            className="flex size-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 lg:hidden"
            onClick={onOpenSidebar}
          >
            <span className="sr-only">Open menu</span>
            ☰
          </button>
        ) : null}
        <LuList
          className="size-[18px] shrink-0"
          style={{ color: listColor }}
          aria-hidden="true"
        />
        <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {list.name}
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max items-start gap-3 px-4 py-4">
          {columns.map((column) => {
            const columnTasks = tasksByColumnId.get(column.id) ?? [];
            const isAddingTaskHere = addingTask?.columnId === column.id;
            const canRemoveColumn = column.name !== NOT_ASSIGNED_COLUMN_NAME;

            return (
              <section
                key={column.id}
                data-kanban-column-id={column.id}
                className="flex w-[280px] shrink-0 flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-1 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {column.name}
                    </h2>
                    {columnTasks.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {columnTasks.length} task
                        {columnTasks.length === 1 ? "" : "s"}
                      </p>
                    )}
               
                  </div>
                  {canRemoveColumn ? (
                    <button
                      type="button"
                      aria-label={`Remove ${column.name} block`}
                      onClick={() =>
                        setColumnPendingRemoval({
                          column,
                          taskCount: columnTasks.length,
                        })
                      }
                      className="-mt-1.5 -mr-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <LuX className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                <div
                  data-kanban-column-body={column.id}
                  className="relative flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2"
                >
                  {dropIndicator?.columnId === column.id ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 left-2 z-20 flex items-center"
                      style={{ top: dropIndicator.top }}
                    >
                      <div
                        className="size-[7px] shrink-0 rounded-full bg-transparent box-border"
                        style={{
                          border: `2px solid ${KANBAN_DROP_INDICATOR_COLOR}`,
                        }}
                      />
                      <div
                        className="h-[2px] flex-1"
                        style={{ backgroundColor: KANBAN_DROP_INDICATOR_COLOR }}
                      />
                    </div>
                  ) : null}

                  {columnTasks.map((task, taskIndex) => (
                    <article
                      key={task.id}
                      data-kanban-task-id={task.id}
                      onPointerDown={(event) =>
                        handleTaskPointerDown(
                          event,
                          task.id,
                          column.id,
                          taskIndex,
                        )
                      }
                      className="cursor-move touch-none rounded-lg border border-zinc-200 bg-[#fafafa] px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => onToggleTask(task.id)}
                          aria-label={`Mark ${task.name} complete`}
                          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-zinc-700"
                        />
                        <span className="min-w-0 flex-1 break-words">
                          {task.name}
                        </span>
                      </div>
                    </article>
                  ))}

                  {isAddingTaskHere ? (
                    <form
                      onSubmit={(event) => handleAddTaskSubmit(event, column.id)}
                      className="rounded-lg border border-zinc-300 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-950"
                    >
                      <input
                        ref={taskInputRef}
                        type="text"
                        value={addingTask.value}
                        onChange={(event) =>
                          setAddingTask({
                            columnId: column.id,
                            value: event.target.value,
                          })
                        }
                        placeholder="Task name"
                        aria-label="New task name"
                        className="w-full bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-50"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setAddingTask(null);
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startAddTask(column.id)}
                      className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <LuPlus className="size-3.5 shrink-0" aria-hidden="true" />
                      Add task
                    </button>
                  )}
                </div>
              </section>
            );
          })}

          <div className="flex w-[220px] shrink-0 flex-col pt-1">
            {isAddingColumn ? (
              <form
                onSubmit={handleAddColumnSubmit}
                className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <input
                  ref={columnInputRef}
                  type="text"
                  value={newColumnName}
                  onChange={(event) => setNewColumnName(event.target.value)}
                  placeholder="Column name"
                  aria-label="New column name"
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsAddingColumn(false);
                      setNewColumnName("");
                    }
                  }}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingColumn(false);
                      setNewColumnName("");
                    }}
                    className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newColumnName.trim()}
                    className="cursor-pointer rounded-md bg-zinc-900 px-3 py-1 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Add
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(true);
                  requestAnimationFrame(() => columnInputRef.current?.focus());
                }}
                className="flex cursor-pointer items-center gap-1 text-sm font-medium text-[#6b6b6b] transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <LuPlus className="size-4 shrink-0" aria-hidden="true" />
                Add block
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={columnPendingRemoval !== null}
        title="Remove block"
        message={
          columnPendingRemoval
            ? columnPendingRemoval.taskCount > 0
              ? `"${columnPendingRemoval.column.name}" has ${columnPendingRemoval.taskCount} task${
                  columnPendingRemoval.taskCount === 1 ? "" : "s"
                }. Move or complete them before removing this block.`
              : `Remove the block "${columnPendingRemoval.column.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Remove block"
        showConfirm={columnPendingRemoval?.taskCount === 0}
        onConfirm={() => {
          if (!columnPendingRemoval || columnPendingRemoval.taskCount > 0) {
            setColumnPendingRemoval(null);
            return;
          }

          void onRemoveColumn(columnPendingRemoval.column.id);
          setColumnPendingRemoval(null);
        }}
        onCancel={() => setColumnPendingRemoval(null)}
      />
    </div>
  );
}
