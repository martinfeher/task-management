"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { BiListUl } from "react-icons/bi";
import { LuCheck, LuX } from "react-icons/lu";
import { formatShortDayMonthYear } from "@/lib/date-format";
import { formatDueTimeLabel } from "@/lib/task-due-time";
import { plainTextToTaskDetails } from "@/lib/task-details-content";
import { TaskMoveToSelector } from "./task-move-to-selector";
import type { TodoList } from "./todo-app";

export { plainTextToTaskDetails };

export const CALENDAR_ADD_TASK_MODAL_WIDTH_PX = 350;
export const CALENDAR_ADD_TASK_MODAL_HEIGHT_PX = 420;

type CalendarAddTaskPopoverProps = {
  date: Date;
  dueTimeMinutes?: number | null;
  lists: TodoList[];
  defaultListId: string | null;
  x?: number;
  y?: number;
  anchorRef?: RefObject<HTMLElement | null>;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onAddTask: (payload: {
    name: string;
    dueDate: string;
    details: string;
    listId: string;
    dueTimeMinutes?: number | null;
  }) => void | Promise<void>;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CalendarAddTaskPopover({
  date,
  dueTimeMinutes = null,
  lists,
  defaultListId,
  name,
  onNameChange,
  onClose,
  onAddTask,
}: CalendarAddTaskPopoverProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const listMenuRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [selectedListId, setSelectedListId] = useState(
    () => defaultListId ?? lists[0]?.id ?? null,
  );
  const [isListMenuOpen, setIsListMenuOpen] = useState(false);
  const [listQuery, setListQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dueDate = toDateKey(date);
  const dueDateLabel = formatShortDayMonthYear(date);
  const dueTimeLabel =
    dueTimeMinutes === null || dueTimeMinutes === undefined
      ? null
      : formatDueTimeLabel(dueTimeMinutes);
  const selectedList =
    lists.find((list) => list.id === selectedListId) ?? lists[0] ?? null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (isListMenuOpen) {
        setIsListMenuOpen(false);
        setListQuery("");
        return;
      }
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, isListMenuOpen]);

  useEffect(() => {
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!isListMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (listMenuRef.current?.contains(target)) return;
      if (listButtonRef.current?.contains(target)) return;
      setIsListMenuOpen(false);
      setListQuery("");
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isListMenuOpen]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || !selectedListId || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await onAddTask({
        name: trimmedName,
        dueDate,
        details: content,
        listId: selectedListId,
        dueTimeMinutes,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto px-6 py-6">
      <button
        type="button"
        aria-label="Close add task dialog"
        className="fixed inset-0 bg-zinc-900/25 backdrop-brightness-[1.1]"
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Add task for ${dueDateLabel}${dueTimeLabel ? ` at ${dueTimeLabel}` : ""}`}
        className="calendar-add-task-popover calendar-task-modal task-details-panel-background relative z-10 mx-auto flex flex-col overflow-hidden bg-white dark:bg-zinc-950"
        style={{
          width: CALENDAR_ADD_TASK_MODAL_WIDTH_PX,
          height: CALENDAR_ADD_TASK_MODAL_HEIGHT_PX,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="absolute right-2 top-2 z-20">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <LuX className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="relative flex shrink-0 items-center justify-between overflow-visible px-2.5 pt-[6px] pb-[4px] pr-12">
            <div className="flex items-center gap-3">
              <div
                aria-label={
                  dueTimeLabel
                    ? `Due ${dueDateLabel} at ${dueTimeLabel}`
                    : `Due ${dueDateLabel}`
                }
                className="flex h-[33px] cursor-default items-center gap-[2px] rounded-full bg-[#eceef0] pl-3.5 pr-3 text-[12px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              >
                <div className="shrink-0 text-[12px] leading-none">Date</div>
                <div
                  className={`relative ml-px flex flex-col normal-case tracking-normal ${
                    dueTimeLabel
                      ? "h-[17px] items-end justify-center"
                      : "items-center justify-center"
                  }`}
                >
                  <span className="font-normal text-[#5F5F5F] text-[12px] leading-[12px] dark:text-zinc-300">
                    {dueDateLabel}
                  </span>
                  {dueTimeLabel ? (
                    <div className="pt-[2px]! font-normal text-[#9f9f9f] text-[7px] leading-[7px]">
                      {dueTimeLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-2">
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Task name"
              aria-label="Task name"
              className="w-full shrink-0 border-0 bg-transparent py-2 text-[26px] font-bold leading-[36px] text-[#4B4B4B] outline-none placeholder:text-zinc-300 dark:text-[#F5F5F5] dark:placeholder:text-zinc-600"
            />

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Description"
              aria-label="Task description"
              className="min-h-0 flex-1 resize-none border-0 bg-transparent pt-1 pb-4 text-sm leading-relaxed text-[#555555] outline-none placeholder:text-zinc-400 dark:text-zinc-300 dark:placeholder:text-zinc-600"
            />
          </div>

          {selectedList ? (
            <div className="relative shrink-0 border-t border-zinc-100 dark:border-zinc-800">
              <button
                ref={listButtonRef}
                type="button"
                aria-label={`Choose list. Currently ${selectedList.name}`}
                aria-haspopup="dialog"
                aria-expanded={isListMenuOpen}
                onClick={(event) => {
                  event.preventDefault();
                  setIsListMenuOpen((open) => !open);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <BiListUl className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
                <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedList.name}
                </span>
              </button>

              {isListMenuOpen ? (
                <div
                  ref={listMenuRef}
                  className="absolute bottom-full left-3 z-10 mb-1"
                >
                  <TaskMoveToSelector
                    lists={lists}
                    currentListId={selectedListId}
                    query={listQuery}
                    onQueryChange={setListQuery}
                    onSelectList={(listId) => {
                      setSelectedListId(listId);
                      setIsListMenuOpen(false);
                      setListQuery("");
                    }}
                    onCancel={() => {
                      setIsListMenuOpen(false);
                      setListQuery("");
                    }}
                    showCurrentList
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="shrink-0 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <button
              type="submit"
              disabled={!name.trim() || !selectedListId || isSubmitting}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#4873c7] text-sm font-medium text-white transition-colors enabled:hover:bg-[#3f68bd] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LuCheck className="size-4" aria-hidden="true" />
              Add task
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
