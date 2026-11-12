"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CiLink } from "react-icons/ci";
import { LiaTagSolid } from "react-icons/lia";
import { MdDeleteOutline } from "react-icons/md";
import { createLabel } from "@/app/actions/todo";
import {
  APP_HOVER_TOOLTIP_ABOVE_CENTER,
  APP_HOVER_TOOLTIP_SHOWN,
} from "@/lib/app-hover-tooltip-classes";
import { buildTodoPath } from "@/lib/todo-routes";
import {
  isTaskPriorityLevel,
  type TaskPriorityLevel,
} from "@/lib/task-priority";
import { TaskLabelPills } from "./task-label-pills";
import { TaskLabelSelector, type Label } from "./task-label-selector";
import { TaskMoveToSelector } from "./task-move-to-selector";
import { TaskPriorityFlagIcon } from "./task-priority-icon";
import { TaskPrioritySelector } from "./task-priority-selector";
import type { TodoList } from "./todo-app";

const MODAL_FOOTER_ACTION_COLOR = "#a4a4a4";

const MODAL_FOOTER_DELETE_TOOLTIP_ID = "task-modal-footer-delete-tooltip";
const MODAL_FOOTER_COPY_LINK_TOOLTIP_ID = "task-modal-footer-copy-link-tooltip";
const MODAL_FOOTER_PRIORITY_TOOLTIP_ID = "task-modal-footer-priority-tooltip";
const MODAL_FOOTER_MOVE_TOOLTIP_ID = "task-modal-footer-move-tooltip";

const MODAL_FOOTER_ICON_TOOLTIP_GAP_PX = 8;
const MODAL_FOOTER_ICON_TOOLTIP_VIEWPORT_PADDING_PX = 8;
/** Above calendar task modal (`z-[10050]`). */
const MODAL_FOOTER_ICON_TOOLTIP_Z_CLASS = "z-[10060]";

const MODAL_FOOTER_ICON_TOOLTIP_CLASS = `add-task-date-tooltip ${APP_HOVER_TOOLTIP_ABOVE_CENTER} pointer-events-none fixed whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${MODAL_FOOTER_ICON_TOOLTIP_Z_CLASS}`;

const MODAL_FOOTER_ICON_BUTTON_CLASS =
  "flex h-6 mr-1 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#b9b8c4] transition-colors hover:bg-zinc-100 hover:text-slate-450 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

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
  /** When true, assigned labels render as pills (still ordered before Move to / Copy link). */
  showLabelsAfterCopyLink?: boolean;
  hideDelete?: boolean;
  deleteButtonVariant?: "text" | "icon";
};

function ModalFooterPortaledIconButton({
  tooltipId,
  ariaLabel,
  tooltipText,
  onClick,
  className = MODAL_FOOTER_ICON_BUTTON_CLASS,
  style,
  ariaHaspopup,
  ariaExpanded,
  children,
}: {
  tooltipId: string;
  ariaLabel: string;
  tooltipText: string;
  onClick: () => void;
  className?: string;
  style?: React.CSSProperties;
  ariaHaspopup?: boolean | "dialog" | "menu";
  ariaExpanded?: boolean;
  children: React.ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!showTooltip) {
      setTooltipStyle(null);
      return;
    }

    let frameId = 0;

    function updatePosition() {
      const button = buttonRef.current;
      const tooltip = tooltipRef.current;
      if (!button || !tooltip) {
        frameId = window.requestAnimationFrame(updatePosition);
        return;
      }

      const anchorRect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      const halfTooltipWidth = tooltipRect.width / 2;

      const left = Math.max(
        MODAL_FOOTER_ICON_TOOLTIP_VIEWPORT_PADDING_PX + halfTooltipWidth,
        Math.min(
          anchorCenterX,
          window.innerWidth -
            MODAL_FOOTER_ICON_TOOLTIP_VIEWPORT_PADDING_PX -
            halfTooltipWidth,
        ),
      );

      const top =
        anchorRect.top - tooltipRect.height - MODAL_FOOTER_ICON_TOOLTIP_GAP_PX;

      setTooltipStyle({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showTooltip, tooltipText]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
        aria-describedby={showTooltip ? tooltipId : undefined}
        style={style}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={className}
      >
        {children}
      </button>
      {showTooltip && typeof document !== "undefined"
        ? createPortal(
            <span
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              className={`${MODAL_FOOTER_ICON_TOOLTIP_CLASS} ${
                tooltipStyle ? APP_HOVER_TOOLTIP_SHOWN : ""
              }`}
              style={
                tooltipStyle
                  ? { top: tooltipStyle.top, left: tooltipStyle.left }
                  : { top: -9999, left: -9999 }
              }
            >
              {tooltipText}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

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
  showLabelsAfterCopyLink = false,
  hideDelete = false,
  deleteButtonVariant = "text",
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
  const hasDeleteActions = Boolean(onDeleteTask) && !hideDelete;
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

  function openLabelMenu() {
    setIsPriorityMenuOpen(false);
    setIsMoveMenuOpen(false);
    setIsLabelMenuOpen((open) => !open);
  }

  const assignedLabels = useMemo(
    () => sortedLabels.filter((item) => assignedLabelIds.includes(item.id)),
    [assignedLabelIds, sortedLabels],
  );

  function renderLabelMenu(anchorClassName: string) {
    if (!hasLabelActions) return null;

    return (
      <div className={`relative shrink-0 ${anchorClassName}`}>
        {showLabelsAfterCopyLink ? (
          assignedLabels.length > 0 ? (
            <TaskLabelPills
              labels={assignedLabels}
              truncateAtPx={null}
              className="px-1 py-0.5"
              onClick={(event) => {
                event.stopPropagation();
                openLabelMenu();
              }}
            />
          ) : (
            <FooterTextButton ariaLabel="Labels" onClick={openLabelMenu}>
              Labels
            </FooterTextButton>
          )
        ) : (
          <button
            type="button"
            aria-label="Label"
            aria-haspopup="dialog"
            aria-expanded={isLabelMenuOpen}
            onClick={openLabelMenu}
            className="flex h-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80"
          >
            <LiaTagSolid
              className="size-[18px]"
              style={{ color: MODAL_FOOTER_ACTION_COLOR }}
              aria-hidden="true"
            />
          </button>
        )}

        {isLabelMenuOpen ? (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-fit">
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
    );
  }

  return (
    <div ref={footerRef} className="flex min-w-0 flex-1 items-center gap-4">
      {hasPriorityActions ? (
        <div className="relative shrink-0">
          <ModalFooterPortaledIconButton
            tooltipId={MODAL_FOOTER_PRIORITY_TOOLTIP_ID}
            ariaLabel="Priority"
            tooltipText="Priority"
            ariaHaspopup="dialog"
            ariaExpanded={isPriorityMenuOpen}
            onClick={() => {
              setIsLabelMenuOpen(false);
              setIsMoveMenuOpen(false);
              setIsPriorityMenuOpen((open) => !open);
            }}
            className="flex h-7 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80"
          >
            <TaskPriorityFlagIcon
              level={priorityLevel}
              outline={priorityLevel === null}
              className={
                priorityLevel === null
                  ? "size-[15px] !text-[#a4a4a4]"
                  : "size-[15px]"
              }
            />
          </ModalFooterPortaledIconButton>

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

      {hasLabelActions
        ? renderLabelMenu(
            showLabelsAfterCopyLink ? "min-w-0 max-w-[min(240px,40vw)]" : "",
          )
        : null}

      {hasMoveActions ? (
        <div className="relative shrink-0">
          <ModalFooterPortaledIconButton
            tooltipId={MODAL_FOOTER_MOVE_TOOLTIP_ID}
            ariaLabel="Move to list"
            tooltipText="Move to"
            onClick={() => {
              setIsPriorityMenuOpen(false);
              setIsLabelMenuOpen(false);
              setIsMoveMenuOpen((open) => !open);
            }}
            className="cursor-pointer text-[13px] transition-opacity hover:opacity-80"
            style={{ color: MODAL_FOOTER_ACTION_COLOR }}
          >
            Move to
          </ModalFooterPortaledIconButton>

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

      {deleteButtonVariant === "icon" ? (
        <ModalFooterPortaledIconButton
          tooltipId={MODAL_FOOTER_COPY_LINK_TOOLTIP_ID}
          ariaLabel="Copy task link"
          tooltipText={copyLinkMessage ?? "Copy Link"}
          onClick={() => void handleCopyLink()}
          className={`${MODAL_FOOTER_ICON_BUTTON_CLASS} w-7`}
        >
          <CiLink className="size-5 mt-0.5" strokeWidth={0.5} />
        </ModalFooterPortaledIconButton>
      ) : (
        <FooterTextButton
          ariaLabel="Copy task link"
          onClick={() => void handleCopyLink()}
        >
          {copyLinkMessage ?? "Copy link"}
        </FooterTextButton>
      )}

      {hasDeleteActions ? (
        deleteButtonVariant === "icon" ? (
          <ModalFooterPortaledIconButton
            tooltipId={MODAL_FOOTER_DELETE_TOOLTIP_ID}
            ariaLabel="Delete task"
            tooltipText="Delete task"
            onClick={handleDelete}
            className={`${MODAL_FOOTER_ICON_BUTTON_CLASS} ml-auto w-5 -mr-1.5 hover:text-red-500 dark:hover:text-red-400`}
          >
            <MdDeleteOutline className="size-[18px]" />
          </ModalFooterPortaledIconButton>
        ) : (
          <FooterTextButton ariaLabel="Delete task" onClick={handleDelete}>
            Delete
          </FooterTextButton>
        )
      ) : null}
    </div>
  );
}

export type TaskModalFooterConfig = Omit<TaskModalFooterProps, "taskId">;
