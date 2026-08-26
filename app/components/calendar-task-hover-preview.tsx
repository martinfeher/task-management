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
import { BiCalendar, BiTimeFive } from "react-icons/bi";
import { LuFlag, LuList } from "react-icons/lu";
import { formatShortDayMonth } from "@/lib/date-format";
import { formatCalendarSlotTimeLabel } from "@/lib/calendar-time-grid";
import type { CalendarDropSlot } from "@/lib/calendar-time-grid";
import { getCalendarWeekdayLabel } from "@/lib/calendar-layout";
import {
  getTaskPriorityColor,
  getTaskPriorityShortLabel,
} from "@/lib/task-priority";
import {
  normalizeDueDurationMinutes,
  normalizeDueTimeMinutes,
} from "@/lib/task-due-time";
import { TaskLabelPills } from "./task-label-pills";
import { useCalendarTaskColorMenu } from "./calendar-task-color-menu";
import type { TaskListItem } from "./todo-app";

const PREVIEW_WIDTH = 280;
const PREVIEW_ESTIMATED_HEIGHT = 168;
const TASK_GAP = 12;
const CURSOR_OFFSET_PX = 50;

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
  clientY: number,
  options: PreviewPositionOptions = { mode: "task-edge" },
) {
  let left =
    options.mode === "cursor"
      ? clientX + (options.cursorOffsetPx ?? CURSOR_OFFSET_PX)
      : Math.max(rect.right, clientX) + TASK_GAP;
  let top = clientY - PREVIEW_ESTIMATED_HEIGHT / 2;

  if (typeof window !== "undefined") {
    left = Math.max(8, Math.min(left, window.innerWidth - PREVIEW_WIDTH - 8));
    top = Math.max(
      8,
      Math.min(top, window.innerHeight - PREVIEW_ESTIMATED_HEIGHT - 8),
    );
  }

  return { left, top };
}

function formatCalendarPreviewDate(dueDate: string | null) {
  if (!dueDate) return null;

  const date = new Date(`${dueDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = getCalendarWeekdayLabel(date);
  return `${weekday}, ${formatShortDayMonth(date)}`;
}

function formatCalendarPreviewTimeRange(
  task: TaskListItem,
  dueTimeMinutes: number | null,
) {
  if (dueTimeMinutes === null) return null;

  const duration =
    normalizeDueDurationMinutes(task.dueDurationMinutes) ??
    (task.dueDurationMinutes && task.dueDurationMinutes > 0
      ? task.dueDurationMinutes
      : 60);
  const endMinutes = dueTimeMinutes + duration;

  return `${formatCalendarSlotTimeLabel(dueTimeMinutes)} - ${formatCalendarSlotTimeLabel(endMinutes)}`;
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
    clientY,
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
    <div className="flex items-center gap-2.5 text-[13px] leading-5 text-zinc-600 dark:text-zinc-300">
      <span className="flex size-4 shrink-0 items-center justify-center text-zinc-400 dark:text-zinc-500">
        {icon}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  );
}

function CalendarTaskHoverPreviewCard({
  task,
  scheduleOverride = null,
}: {
  task: TaskListItem;
  scheduleOverride?: PreviewScheduleOverride | null;
}) {
  const dueTimeMinutes = scheduleOverride
    ? scheduleOverride.dueTimeMinutes
    : normalizeDueTimeMinutes(task.dueTimeMinutes);
  const dueDate =
    scheduleOverride?.dueDate ?? task.dueDate?.slice(0, 10) ?? null;
  const timeLabel = formatCalendarPreviewTimeRange(task, dueTimeMinutes);
  const dateLabel = formatCalendarPreviewDate(dueDate);
  const priorityLabel = getTaskPriorityShortLabel(task.priority);
  const priorityColor = getTaskPriorityColor(task.priority);

  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-zinc-900 dark:text-zinc-50">
        {task.name}
      </p>

      <div className="flex flex-col gap-1.5">
        {timeLabel ? (
          <PreviewMetaRow icon={<BiTimeFive className="size-4" />}>
            {timeLabel}
          </PreviewMetaRow>
        ) : null}

        {dateLabel ? (
          <PreviewMetaRow icon={<BiCalendar className="size-4" />}>
            {dateLabel}
          </PreviewMetaRow>
        ) : null}

        {task.listName ? (
          <PreviewMetaRow icon={<LuList className="size-4" />}>
            {task.listName}
          </PreviewMetaRow>
        ) : null}

        {priorityLabel ? (
          <PreviewMetaRow
            icon={
              <LuFlag
                className="size-4"
                style={priorityColor ? { color: priorityColor } : undefined}
              />
            }
          >
            {priorityLabel}
          </PreviewMetaRow>
        ) : null}
      </div>

      {task.labels.length > 0 ? (
        <TaskLabelPills
          labels={task.labels}
          className="flex-wrap"
          truncateAtPx={null}
        />
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
      const { x, y } = cursorRef.current;
      const { left, top } = getPreviewPosition(
        element.getBoundingClientRect(),
        x,
        y,
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

      openPreview(
        task,
        element,
        clientX,
        clientY,
        setPreview,
        refs,
        positionOptions,
      );
    },
    [positionOptions, refs],
  );

  const move = useCallback(
    (clientX: number, clientY: number) => {
      if (dragPreviewActiveRef.current) return;

      cursorRef.current = { x: clientX, y: clientY };
      const element = activeElementRef.current;
      if (!element || !activeTaskIdRef.current) return;

      const { left, top } = getPreviewPosition(
        element.getBoundingClientRect(),
        clientX,
        clientY,
        positionOptions,
      );
      setPreview((previous) =>
        previous ? { ...previous, x: left, y: top } : null,
      );
    },
    [positionOptions],
  );

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
              className="calendar-task-hover-preview pointer-events-none fixed z-[200] overflow-hidden bg-white dark:bg-zinc-950"
              style={{
                width: PREVIEW_WIDTH,
                left: preview.x,
                top: preview.y,
              }}
              role="tooltip"
              aria-label={preview.task.name}
            >
              <CalendarTaskHoverPreviewCard
                task={preview.task}
                scheduleOverride={preview.scheduleOverride}
              />
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
      onMouseMove: (event: MouseEvent<HTMLElement>) => {
        context.move(event.clientX, event.clientY);
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
  const colorMenuHandlers = useCalendarTaskColorMenu(task);

  return (
    <button
      type="button"
      {...props}
      {...hoverHandlers}
      onContextMenu={(event) => {
        hoverHandlers.onMouseLeave?.();
        colorMenuHandlers.onContextMenu?.(event);
        onContextMenu?.(event);
      }}
    />
  );
}
