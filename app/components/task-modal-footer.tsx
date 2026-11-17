"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CiLink } from "react-icons/ci";
import { LiaTagSolid } from "react-icons/lia";
import { LuInbox, LuList } from "react-icons/lu";
import { MdDeleteOutline } from "react-icons/md";
import { createLabel } from "@/app/actions/todo";
import { isInboxList } from "@/lib/inbox-list";
import {
  APP_HOVER_TOOLTIP_ABOVE_CENTER,
  APP_HOVER_TOOLTIP_SHOWN,
} from "@/lib/app-hover-tooltip-classes";
import { TASK_MODAL_CONTEXT_SURFACE_CLASS } from "@/lib/task-modal-context-surface";
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
import { ConfirmModal } from "./confirm-modal";

const MODAL_FOOTER_ACTION_COLOR = "#a4a4a4";

const MODAL_FOOTER_DELETE_TOOLTIP_ID = "task-modal-footer-delete-tooltip";
const MODAL_FOOTER_COPY_LINK_TOOLTIP_ID = "task-modal-footer-copy-link-tooltip";
const MODAL_FOOTER_PRIORITY_TOOLTIP_ID = "task-modal-footer-priority-tooltip";

const MODAL_FOOTER_ICON_TOOLTIP_GAP_PX = 8;
const MODAL_FOOTER_ICON_TOOLTIP_VIEWPORT_PADDING_PX = 8;
/** Above calendar task modal (`z-[10050]`). */
const MODAL_FOOTER_ICON_TOOLTIP_Z_CLASS = "z-[10060]";

const MODAL_FOOTER_ICON_TOOLTIP_CLASS = `add-task-date-tooltip ${APP_HOVER_TOOLTIP_ABOVE_CENTER} pointer-events-none fixed whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${MODAL_FOOTER_ICON_TOOLTIP_Z_CLASS}`;

const MODAL_FOOTER_ICON_BUTTON_CLASS =
  "flex h-7 mr-1 shrink-0 cursor-pointer items-center justify-center rounded-md text-[#C6C5D1] transition-colors hover:bg-zinc-100 hover:text-slate-450 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

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
  /** Calendar task modal: open priority / labels / move menus on footer control hover. */
  openMenusOnHover?: boolean;
};

const FOOTER_MENU_HOVER_CLOSE_MS = 120;

function ModalFooterPortaledIconButton({
  tooltipId,
  ariaLabel,
  tooltipText,
  onClick,
  className = MODAL_FOOTER_ICON_BUTTON_CLASS,
  style,
  ariaHaspopup,
  ariaExpanded,
  showTooltip = true,
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
  showTooltip?: boolean;
  children: React.ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!tooltipVisible) {
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
  }, [tooltipText, tooltipVisible]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
        aria-describedby={showTooltip && tooltipVisible ? tooltipId : undefined}
        style={style}
        onClick={onClick}
        onMouseEnter={() => {
          if (showTooltip) setTooltipVisible(true);
        }}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => {
          if (showTooltip) setTooltipVisible(true);
        }}
        onBlur={() => setTooltipVisible(false)}
        className={className}
      >
        {children}
      </button>
      {showTooltip && tooltipVisible && typeof document !== "undefined"
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
  ariaHaspopup,
  ariaExpanded,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel: string;
  ariaHaspopup?: "dialog" | "menu";
  ariaExpanded?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
      onClick={onClick}
      className="flex h-7 cursor-pointer items-center text-[13px] transition-opacity hover:opacity-80"
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
  openMenusOnHover = false,
}: TaskModalFooterProps) {
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = useState(false);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);
  const [labelQuery, setLabelQuery] = useState("");
  const [moveQuery, setMoveQuery] = useState("");
  const [isLabelSubmitting, setIsLabelSubmitting] = useState(false);
  const [copyLinkMessage, setCopyLinkMessage] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const copyLinkTimerRef = useRef<number | null>(null);
  const footerMenuHoverCloseTimerRef = useRef<number | null>(null);

  const priorityLevel =
    priority !== null && isTaskPriorityLevel(priority) ? priority : null;
  const hasPriorityActions = Boolean(onSetTaskPriority);
  const hasLabelActions = Boolean(onToggleTaskLabel);
  const hasMoveActions = Boolean(onMoveTaskToList && listId);
  const currentList = listId
    ? (lists.find((list) => list.id === listId) ?? null)
    : null;
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
      if (footerMenuHoverCloseTimerRef.current !== null) {
        window.clearTimeout(footerMenuHoverCloseTimerRef.current);
      }
    };
  }, []);

  function cancelFooterMenuHoverClose() {
    if (footerMenuHoverCloseTimerRef.current !== null) {
      window.clearTimeout(footerMenuHoverCloseTimerRef.current);
      footerMenuHoverCloseTimerRef.current = null;
    }
  }

  function scheduleFooterMenuHoverClose(
    close: () => void,
  ) {
    if (!openMenusOnHover) return;
    cancelFooterMenuHoverClose();
    footerMenuHoverCloseTimerRef.current = window.setTimeout(() => {
      footerMenuHoverCloseTimerRef.current = null;
      close();
    }, FOOTER_MENU_HOVER_CLOSE_MS);
  }

  function openPriorityMenuFromHover() {
    if (!openMenusOnHover) return;
    cancelFooterMenuHoverClose();
    setIsLabelMenuOpen(false);
    setIsMoveMenuOpen(false);
    setIsPriorityMenuOpen(true);
  }

  function openLabelMenuFromHover() {
    if (!openMenusOnHover) return;
    cancelFooterMenuHoverClose();
    setIsPriorityMenuOpen(false);
    setIsMoveMenuOpen(false);
    setIsLabelMenuOpen(true);
  }

  function openMoveMenuFromHover() {
    if (!openMenusOnHover) return;
    cancelFooterMenuHoverClose();
    setIsPriorityMenuOpen(false);
    setIsLabelMenuOpen(false);
    setIsMoveMenuOpen(true);
  }

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

  const hasOpenFooterOverlay =
    isPriorityMenuOpen ||
    isLabelMenuOpen ||
    isMoveMenuOpen ||
    deleteConfirmOpen;

  useEffect(() => {
    if (!hasOpenFooterOverlay) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();

      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
        return;
      }

      setIsPriorityMenuOpen(false);
      setIsLabelMenuOpen(false);
      setIsMoveMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [deleteConfirmOpen, hasOpenFooterOverlay]);

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

  function handleDeleteClick() {
    closeMenus();
    setDeleteConfirmOpen(true);
  }

  function confirmDeleteTask() {
    setDeleteConfirmOpen(false);
    void Promise.resolve(onDeleteTask?.(taskId));
  }

  function openLabelMenu() {
    cancelFooterMenuHoverClose();
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
      <div
        className={`relative shrink-0 ${anchorClassName}`}
        onMouseEnter={openLabelMenuFromHover}
        onMouseLeave={() =>
          scheduleFooterMenuHoverClose(() => setIsLabelMenuOpen(false))
        }
      >
        {showLabelsAfterCopyLink ? (
          assignedLabels.length > 0 ? (
            <TaskLabelPills
              labels={assignedLabels}
              truncateAtPx={null}
              className="flex items-center px-1 py-0"
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
          <div className="absolute bottom-full left-0 z-50 mb-px w-fit pb-1">
            <TaskLabelSelector
              labels={sortedLabels}
              assignedLabelIds={assignedLabelIds}
              query={labelQuery}
              isSubmitting={isLabelSubmitting}
              listMaxHeightPx={270}
              onQueryChange={setLabelQuery}
              onToggleLabel={(labelId) => void handleToggleLabel(labelId)}
              onCreateLabel={(label, color) =>
                void handleCreateLabel(label, color)
              }
              onCancel={() => setIsLabelMenuOpen(false)}
              surface="modalContext"
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
    <div
      ref={footerRef}
      className="flex h-full min-h-0 min-w-0 flex-1 items-center gap-2 self-stretch"
    >
      {hasPriorityActions ? (
        <div
          className="relative shrink-0"
          onMouseEnter={openPriorityMenuFromHover}
          onMouseLeave={() =>
            scheduleFooterMenuHoverClose(() => setIsPriorityMenuOpen(false))
          }
        >
          <ModalFooterPortaledIconButton
            tooltipId={MODAL_FOOTER_PRIORITY_TOOLTIP_ID}
            ariaLabel="Priority"
            tooltipText="Priority"
            showTooltip={!openMenusOnHover}
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
            <div className="absolute bottom-full left-0 z-50 mb-px pb-1">
              <div
                className={`w-[196px] overflow-visible rounded-[14px] ${TASK_MODAL_CONTEXT_SURFACE_CLASS}`}
              >
                {openMenusOnHover ? (
                  <p className="px-3 pt-1 text-[10px] text-[#7e7e85]">Priority</p>
                ) : null}
                <TaskPrioritySelector
                  selectedPriority={priorityLevel}
                  onSelectPriority={handleSelectPriority}
                  onClearPriority={handleClearPriority}
                  portaledOptionTooltips={openMenusOnHover}
                />
              </div>
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
        <div
          className="relative shrink-0"
          onMouseEnter={openMoveMenuFromHover}
          onMouseLeave={() =>
            scheduleFooterMenuHoverClose(() => setIsMoveMenuOpen(false))
          }
        >
          <FooterTextButton
            ariaLabel={
              currentList ? `List: ${currentList.name}. Change list` : "Move to list"
            }
            ariaHaspopup="dialog"
            ariaExpanded={isMoveMenuOpen}
            onClick={() => {
              setIsPriorityMenuOpen(false);
              setIsLabelMenuOpen(false);
              setIsMoveMenuOpen((open) => !open);
            }}
          >
            {currentList ? (
              <span className="flex max-w-[180px] items-center gap-1">
                {isInboxList(currentList) ? (
                  <LuInbox className="size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <LuList
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate">{currentList.name}</span>
              </span>
            ) : (
              "Move to"
            )}
          </FooterTextButton>

          {isMoveMenuOpen ? (
            <div className="absolute bottom-full left-0 z-50 mb-px pb-1">
              <TaskMoveToSelector
                lists={lists}
                currentListId={listId}
                showCurrentList
                query={moveQuery}
                onQueryChange={setMoveQuery}
                onSelectList={handleMoveToList}
                onCancel={() => setIsMoveMenuOpen(false)}
                surface="modalContext"
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
          <CiLink className="size-5" strokeWidth={0.5} />
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
            onClick={handleDeleteClick}
            className={`${MODAL_FOOTER_ICON_BUTTON_CLASS} ml-auto -mr-1.5 hover:text-red-500 dark:hover:text-red-400`}
          >
            <MdDeleteOutline className="size-[18px]" />
          </ModalFooterPortaledIconButton>
        ) : (
          <FooterTextButton ariaLabel="Delete task" onClick={handleDeleteClick}>
            Delete
          </FooterTextButton>
        )
      ) : null}
    </div>
    <ConfirmModal
      open={deleteConfirmOpen}
      title="Delete task"
      message="Are you sure you want to delete this task? This cannot be undone."
      confirmLabel="Delete"
      overlayClassName="z-[10070]"
      onConfirm={confirmDeleteTask}
      onCancel={() => setDeleteConfirmOpen(false)}
    />
    </>
  );
}

export type TaskModalFooterConfig = Omit<TaskModalFooterProps, "taskId">;
