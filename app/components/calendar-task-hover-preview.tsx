"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuList } from "react-icons/lu";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import { fetchTaskById } from "@/lib/task-details-api";
import {
  taskDetailsHasContent,
  taskDetailsToPlainText,
} from "@/lib/task-details-content";
import {
  getLabelColor,
  getLabelPillClassName,
  getLabelPillStyle,
} from "@/lib/label-colors";
import {
  CALENDAR_TASK_ID_DATA_ATTR,
  useCalendarTaskColorMenu,
} from "./calendar-task-color-menu";
import type { TaskListItem } from "./todo-app";

const PREVIEW_WIDTH = 280;
const PREVIEW_ESTIMATED_HEIGHT = 240;
const PREVIEW_SUBTITLE_CLASS =
  "text-[13.5px] leading-[16px] text-[#bfbfbf] dark:text-[#bfbfbf]";
const TASK_GAP = 12;
const TASK_EDGE_PREVIEW_UPWARD_OFFSET_PX = 10;
const CURSOR_OFFSET_PX = 50;
const POST_DRAG_HOVER_SUPPRESS_MS = 300;

type PreviewPositionMode = "task-edge" | "cursor";

type PreviewPositionOptions = {
  mode: PreviewPositionMode;
  cursorOffsetPx?: number;
};

type PreviewScheduleOverride = {
  dueTimeMinutes: number | null;
  dueDate?: string;
};

type PreviewState = {
  task: TaskListItem;
  x: number;
  y: number;
  scheduleOverride?: PreviewScheduleOverride | null;
  dragPreview?: boolean;
};

type CalendarTaskHoverPreviewContextValue = {
  show: (
    task: TaskListItem,
    element: HTMLElement,
    clientX: number,
    clientY: number,
  ) => void;
  move: (clientX: number, clientY: number) => void;
  hide: () => void;
  startDragPreview: (
    task: TaskListItem,
    clientX: number,
    clientY: number,
  ) => void;
  updateDragPreview: (
    clientX: number,
    clientY: number,
    slot: CalendarDropSlot | null,
  ) => void;
  endDragPreview: () => void;
  beginTaskDrag: () => void;
  isDragPreviewActive: () => boolean;
};

const CalendarTaskHoverPreviewContext =
  createContext<CalendarTaskHoverPreviewContextValue | null>(null);

function getPreviewPosition(
  rect: DOMRect,
  clientX: number,
  options: PreviewPositionOptions = { mode: "task-edge" },
) {
  let left =
    options.mode === "cursor"
      ? clientX + (options.cursorOffsetPx ?? CURSOR_OFFSET_PX)
      : Math.max(rect.right, clientX) + TASK_GAP;
  let top = rect.top;
  if (options.mode === "task-edge") {
    top -= TASK_EDGE_PREVIEW_UPWARD_OFFSET_PX;
  }

  if (typeof window !== "undefined") {
    const minTop = 8;
    const maxTop = window.innerHeight - PREVIEW_ESTIMATED_HEIGHT - 8;
    left = Math.max(8, Math.min(left, window.innerWidth - PREVIEW_WIDTH - 8));
    top = Math.max(minTop, Math.min(top, maxTop));
  }

  return { left, top };
}

const TASK_PREVIEW_CONTENT_LINE_COUNT = 3;

/** Tasks in calendar views often ship without `details` HTML; cache lazy loads on hover. */
const calendarPreviewDetailsCache = new Map<string, string>();

function normalizePreviewLine(line: string) {
  return line.trim().toLowerCase();
}

function taskWithResolvedDetails(task: TaskListItem): TaskListItem {
  if (taskDetailsHasContent(task.details)) return task;

  const cached = calendarPreviewDetailsCache.get(task.id);
  if (cached === undefined) return task;

  return { ...task, details: cached };
}

async function loadTaskDetailsForPreview(task: TaskListItem): Promise<string> {
  if (taskDetailsHasContent(task.details)) return task.details;

  if (calendarPreviewDetailsCache.has(task.id)) {
    return calendarPreviewDetailsCache.get(task.id) ?? "";
  }

  if (!task.hasDetails) {
    calendarPreviewDetailsCache.set(task.id, "");
    return "";
  }

  const loaded = await fetchTaskById(task.id);
  const details = loaded?.details ?? "";
  calendarPreviewDetailsCache.set(task.id, details);
  return details;
}

function getTaskPreviewDescriptionLines(
  details: string,
  taskName: string,
  maxLines = TASK_PREVIEW_CONTENT_LINE_COUNT,
) {
  if (!taskDetailsHasContent(details)) return [];

  let lines = taskDetailsToPlainText(details)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const normalizedTitle = normalizePreviewLine(taskName);
  if (lines.length > 0 && normalizePreviewLine(lines[0]) === normalizedTitle) {
    lines = lines.slice(1);
  }

  return lines.slice(0, maxLines);
}

function openPreview(
  task: TaskListItem,
  element: HTMLElement,
  clientX: number,
  clientY: number,
  setPreview: (preview: PreviewState) => void,
  refs: {
    activeTaskIdRef: { current: string | null };
    activeElementRef: { current: HTMLElement | null };
    cursorRef: { current: { x: number; y: number } };
  },
  positionOptions: PreviewPositionOptions,
) {
  refs.activeTaskIdRef.current = task.id;
  refs.activeElementRef.current = element;
  refs.cursorRef.current = { x: clientX, y: clientY };

  const { left, top } = getPreviewPosition(
    element.getBoundingClientRect(),
    clientX,
    positionOptions,
  );

  setPreview({
    task,
    x: left,
    y: top,
  });
}

function PreviewMetaRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 text-[11px] leading-5 text-zinc-600 dark:text-zinc-300">
      <span className="flex size-[14px] shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500">
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function CalendarTaskHoverPreviewCard({ task }: { task: TaskListItem }) {
  const descriptionLines = getTaskPreviewDescriptionLines(
    task.details,
    task.name,
  );

  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex flex-col gap-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-zinc-900 dark:text-zinc-50">
          {task.name}
        </p>

        {descriptionLines.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {descriptionLines.map((line, index) => (
              <p
                key={`${index}-${line}`}
                className={`line-clamp-1 ${PREVIEW_SUBTITLE_CLASS}`}
              >
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {task.listName ? (
          <PreviewMetaRow icon={<LuList className="h-[14px] w-[14px]" />}>
            {task.listName}
          </PreviewMetaRow>
        ) : null}
      </div>

      {task.labels.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {task.labels.map((item) => {
            const palette = getLabelColor(item);

            return (
              <span
                key={item.id}
                className={`${getLabelPillClassName(palette)} inline-block max-w-full truncate`}
                style={getLabelPillStyle(palette)}
                title={item.label}
              >
                {item.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CalendarTaskHoverPreviewProvider({
  children,
  positionFromCursor = false,
  cursorOffsetPx = CURSOR_OFFSET_PX,
}: {
  children: ReactNode;
  positionFromCursor?: boolean;
  cursorOffsetPx?: number;
}) {
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const dragPreviewActiveRef = useRef(false);
  const suppressHoverUntilRef = useRef(0);
  const suppressHoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (suppressHoverTimerRef.current !== null) {
        window.clearTimeout(suppressHoverTimerRef.current);
      }
    };
  }, []);

  const positionOptions = useMemo<PreviewPositionOptions>(
    () =>
      positionFromCursor
        ? { mode: "cursor", cursorOffsetPx }
        : { mode: "task-edge" },
    [cursorOffsetPx, positionFromCursor],
  );

  const refs = useMemo(
    () => ({
      activeTaskIdRef,
      activeElementRef,
      cursorRef,
    }),
    [],
  );

  const repositionPreview = useCallback(
    (element: HTMLElement) => {
      const { x } = cursorRef.current;
      const { left, top } = getPreviewPosition(
        element.getBoundingClientRect(),
        x,
        positionOptions,
      );
      setPreview((previous) =>
        previous ? { ...previous, x: left, y: top } : null,
      );
    },
    [positionOptions],
  );

  const hide = useCallback(() => {
    dragPreviewActiveRef.current = false;
    activeTaskIdRef.current = null;
    activeElementRef.current = null;
    setPreview(null);
  }, []);

  const beginTaskDrag = useCallback(() => {
    dragPreviewActiveRef.current = true;
    activeTaskIdRef.current = null;
    activeElementRef.current = null;
    setPreview(null);
  }, []);

  const endTaskDrag = useCallback(() => {
    hide();

    // Releasing pointer capture after a drag can make the browser emit a
    // synthetic hover event for whatever is now under the cursor, which
    // would otherwise pop the hover preview open right after the drop.
    suppressHoverUntilRef.current = Date.now() + POST_DRAG_HOVER_SUPPRESS_MS;
    if (suppressHoverTimerRef.current !== null) {
      window.clearTimeout(suppressHoverTimerRef.current);
    }
    suppressHoverTimerRef.current = window.setTimeout(() => {
      suppressHoverTimerRef.current = null;
    }, POST_DRAG_HOVER_SUPPRESS_MS);
  }, [hide]);

  const startDragPreview = useCallback(
    (_task: TaskListItem, _clientX: number, _clientY: number) => {
      beginTaskDrag();
    },
    [beginTaskDrag],
  );

  const updateDragPreview = useCallback(
    (_clientX: number, _clientY: number, _slot: CalendarDropSlot | null) => {
      if (!dragPreviewActiveRef.current) return;
    },
    [],
  );

  const endDragPreview = endTaskDrag;

  const show = useCallback(
    (
      task: TaskListItem,
      element: HTMLElement,
      clientX: number,
      clientY: number,
    ) => {
      if (dragPreviewActiveRef.current) return;
      if (Date.now() < suppressHoverUntilRef.current) return;

      const taskForPreview = taskWithResolvedDetails(task);

      openPreview(
        taskForPreview,
        element,
        clientX,
        clientY,
        setPreview,
        refs,
        positionOptions,
      );

      if (
        !taskDetailsHasContent(taskForPreview.details) &&
        task.hasDetails
      ) {
        void loadTaskDetailsForPreview(task).then((details) => {
          if (activeTaskIdRef.current !== task.id) return;

          setPreview((previous) =>
            previous?.task.id === task.id
              ? { ...previous, task: { ...previous.task, details } }
              : previous,
          );
        });
      }
    },
    [positionOptions, refs],
  );

  const move = useCallback((_clientX: number, clientY: number) => {
    if (dragPreviewActiveRef.current) return;
    cursorRef.current = { x: cursorRef.current.x, y: clientY };
  }, []);

  useEffect(() => {
    if (!preview || preview.dragPreview) return;

    function handleReposition() {
      const element = activeElementRef.current;
      if (element) {
        repositionPreview(element);
      }
    }

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [preview, repositionPreview]);

  const contextValue = useMemo(
    () => ({
      show,
      move,
      hide,
      startDragPreview,
      updateDragPreview,
      endDragPreview,
      beginTaskDrag,
      isDragPreviewActive: () => dragPreviewActiveRef.current,
    }),
    [show, move, hide, startDragPreview, updateDragPreview, endDragPreview, beginTaskDrag],
  );

  return (
    <CalendarTaskHoverPreviewContext.Provider value={contextValue}>
      {children}
      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="calendar-task-hover-preview pointer-events-none fixed z-[4100] overflow-hidden bg-white dark:bg-zinc-950"
              style={{
                width: PREVIEW_WIDTH,
                left: preview.x,
                top: preview.y,
              }}
              role="tooltip"
              aria-label={preview.task.name}
            >
              <CalendarTaskHoverPreviewCard task={preview.task} />
            </div>,
            document.body,
          )
        : null}
    </CalendarTaskHoverPreviewContext.Provider>
  );
}

export function useCalendarTaskHoverPreview(task: TaskListItem) {
  const context = useContext(CalendarTaskHoverPreviewContext);

  return useMemo(() => {
    if (!context) {
      return {
        onMouseEnter: undefined,
        onMouseLeave: undefined,
        onMouseMove: undefined,
      };
    }

    return {
      onMouseEnter: (event: MouseEvent<HTMLElement>) => {
        context.show(task, event.currentTarget, event.clientX, event.clientY);
      },
      onMouseLeave: () => {
        if (!context.isDragPreviewActive()) {
          context.hide();
        }
      },
    };
  }, [context, task]);
}

export function useCalendarTaskDragPreview() {
  const context = useContext(CalendarTaskHoverPreviewContext);

  return useMemo(() => {
    if (!context) {
    return {
      startDragPreview: undefined,
      updateDragPreview: undefined,
      endDragPreview: undefined,
      beginTaskDrag: undefined,
    };
  }

  return {
    startDragPreview: context.startDragPreview,
    updateDragPreview: context.updateDragPreview,
    endDragPreview: context.endDragPreview,
    beginTaskDrag: context.beginTaskDrag,
  };
  }, [context]);
}

export function CalendarTaskHoverButton({
  task,
  onContextMenu,
  ...props
}: { task: TaskListItem } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const hoverHandlers = useCalendarTaskHoverPreview(task);
  const colorMenuHandlers = useCalendarTaskColorMenu(task, {
    onBeforeOpen: () => hoverHandlers.onMouseLeave?.(),
  });

  return (
    <button
      type="button"
      {...{ [CALENDAR_TASK_ID_DATA_ATTR]: task.id }}
      {...props}
      {...hoverHandlers}
      onContextMenu={(event) => {
        colorMenuHandlers.onContextMenu?.(event);
        onContextMenu?.(event);
      }}
    />
  );
}
