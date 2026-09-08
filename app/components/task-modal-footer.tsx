"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IoPricetagsOutline } from "react-icons/io5";
import { createLabel } from "@/app/actions/todo";
import { buildTodoPath } from "@/lib/todo-routes";
import {
  isTaskPriorityLevel,
  type TaskPriorityLevel,
} from "@/lib/task-priority";
import { TaskLabelSelector, type Label } from "./task-label-selector";
import { TaskMoveToSelector } from "./task-move-to-selector";
import { TaskPriorityFlagIcon } from "./task-priority-icon";
import { TaskPrioritySelector } from "./task-priority-selector";
import type { TodoList } from "./todo-app";

const MODAL_FOOTER_ACTION_COLOR = "#a4a4a4";

type TaskModalFooterProps = {
  taskId: string;
  listId: string | null;
  priority: number | null;
  assignedLabelIds: string[];
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

function FooterTextButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="cursor-pointer text-[13px] transition-opacity hover:opacity-80"
      style={{ color: MODAL_FOOTER_ACTION_COLOR }}
    >
      {children}
    </button>
  );
}

export function TaskModalFooter({
  taskId,
  listId,
  priority,
  assignedLabelIds,
  lists,
  labels,
  onSetTaskPriority,
  onToggleTaskLabel,
  onLabelsChanged,
  onMoveTaskToList,
  onDeleteTask,
}: TaskModalFooterProps) {
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [labelQuery, setLabelQuery] = useState("");
  const [moveQuery, setMoveQuery] = useState("");
  const [isLabelSubmitting, setIsLabelSubmitting] = useState(false);
  const [copyLinkMessage, setCopyLinkMessage] = useState<string | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const copyLinkTimerRef = useRef<number | null>(null);

  const priorityLevel =
    priority !== null && isTaskPriorityLevel(priority) ? priority : null;
  const hasPriorityActions = Boolean(onSetTaskPriority);
  const hasLabelActions = Boolean(onToggleTaskLabel);
  const hasMoveActions = Boolean(onMoveTaskToList && listId);
  const hasDeleteActions = Boolean(onDeleteTask);

  const sortedLabels = useMemo(
    () =>
      [...labels].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    [labels],
  );

  useEffect(() => {
    return () => {
      if (copyLinkTimerRef.current !== null) {
        window.clearTimeout(copyLinkTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (footerRef.current?.contains(target)) return;

      setIsPriorityMenuOpen(false);
      setIsLabelMenuOpen(false);
      setIsMoveMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, []);

  function closeMenus() {
    setIsPriorityMenuOpen(false);
    setIsLabelMenuOpen(false);
    setIsMoveMenuOpen(false);
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}${buildTodoPath({ kind: "task", taskId })}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopyLinkMessage("Copied");
    } catch {
      setCopyLinkMessage("Copy failed");
    }

    if (copyLinkTimerRef.current !== null) {
      window.clearTimeout(copyLinkTimerRef.current);
    }

    copyLinkTimerRef.current = window.setTimeout(() => {
      copyLinkTimerRef.current = null;
      setCopyLinkMessage(null);
    }, 1600);
  }

  async function handleToggleLabel(labelId: string) {
    if (!onToggleTaskLabel) return;

    const isAssigned = assignedLabelIds.includes(labelId);
    setIsLabelSubmitting(true);

    try {
      await onToggleTaskLabel(taskId, labelId, !isAssigned);
      setLabelQuery("");
      closeMenus();
    } catch {
      // Keep menu open so the user can retry.
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  async function handleCreateLabel(name: string, color: string) {
    if (!onToggleTaskLabel) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    setIsLabelSubmitting(true);

    try {
      const tag = await createLabel(trimmed, color);
      await onToggleTaskLabel(taskId, tag.id, true);
      onLabelsChanged?.();
      setLabelQuery("");
      closeMenus();
    } catch {
      // Keep menu open so the user can retry.
    } finally {
      setIsLabelSubmitting(false);
    }
  }

  function handleSelectPriority(nextPriority: TaskPriorityLevel) {
    onSetTaskPriority?.(taskId, nextPriority);
    closeMenus();
  }

  function handleClearPriority() {
    onSetTaskPriority?.(taskId, null);
    closeMenus();
  }

  function handleMoveToList(targetListId: string) {
    if (!onMoveTaskToList || !listId || targetListId === listId) return;

    onMoveTaskToList(taskId, listId, targetListId);
    closeMenus();
  }

  function handleDelete() {
    void Promise.resolve(onDeleteTask?.(taskId));
    closeMenus();
  }

  return (
    <div ref={footerRef} className="flex min-w-0 flex-1 items-center gap-4">
      {hasPriorityActions ? (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Priority"
            aria-haspopup="dialog"
            aria-expanded={isPriorityMenuOpen}
            onClick={() => {
              setIsLabelMenuOpen(false);
              setIsMoveMenuOpen(false);
              setIsPriorityMenuOpen((open) => !open);
            }}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80"
          >
            <TaskPriorityFlagIcon
              level={priorityLevel}
              outline={priorityLevel === null}
              className={
                priorityLevel === null
                  ? "size-[15px] text-[#a4a4a4]"
                  : "size-[15px]"
              }
            />
          </button>

          {isPriorityMenuOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-[196px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <TaskPrioritySelector
                selectedPriority={priorityLevel}
                onSelectPriority={handleSelectPriority}
                onClearPriority={handleClearPriority}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {hasLabelActions ? (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Label"
            aria-haspopup="dialog"
            aria-expanded={isLabelMenuOpen}
            onClick={() => {
              setIsPriorityMenuOpen(false);
              setIsMoveMenuOpen(false);
              setIsLabelMenuOpen((open) => !open);
            }}
            className="flex size-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80"
          >
            <IoPricetagsOutline
              className="size-[15px]"
              style={{ color: MODAL_FOOTER_ACTION_COLOR }}
              aria-hidden="true"
            />
          </button>

          {isLabelMenuOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-[240px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <TaskLabelSelector
                labels={sortedLabels}
                assignedLabelIds={assignedLabelIds}
                query={labelQuery}
                isSubmitting={isLabelSubmitting}
                onQueryChange={setLabelQuery}
                onToggleLabel={(labelId) => void handleToggleLabel(labelId)}
                onCreateLabel={(label, color) =>
                  void handleCreateLabel(label, color)
                }
                onCancel={() => setIsLabelMenuOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {hasMoveActions ? (
        <div className="relative shrink-0">
          <FooterTextButton
            ariaLabel="Move to list"
            onClick={() => {
              setIsPriorityMenuOpen(false);
              setIsLabelMenuOpen(false);
              setIsMoveMenuOpen((open) => !open);
            }}
          >
            Move to
          </FooterTextButton>

          {isMoveMenuOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-1">
              <TaskMoveToSelector
                lists={lists}
                currentListId={listId}
                query={moveQuery}
                onQueryChange={setMoveQuery}
                onSelectList={handleMoveToList}
                onCancel={() => setIsMoveMenuOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <FooterTextButton ariaLabel="Copy task link" onClick={() => void handleCopyLink()}>
        {copyLinkMessage ?? "Copy link"}
      </FooterTextButton>

      {hasDeleteActions ? (
        <FooterTextButton ariaLabel="Delete task" onClick={handleDelete}>
          Delete
        </FooterTextButton>
      ) : null}
    </div>
  );
}

export type TaskModalFooterConfig = Omit<TaskModalFooterProps, "taskId">;
