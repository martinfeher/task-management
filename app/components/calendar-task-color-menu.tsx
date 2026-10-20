"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  CALENDAR_TASK_COLOR_OPTIONS,
  normalizeCalendarTaskColor,
} from "@/lib/calendar-task-colors";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";
import type { TaskListItem } from "./todo-app";

const MENU_WIDTH = 168;
const MENU_HEIGHT = 196;
const VIEWPORT_PADDING = 8;

type ColorMenuState = {
  task: TaskListItem;
  top: number;
  left: number;
};

type CalendarTaskColorMenuContextValue = {
  enabled: boolean;
  open: (task: TaskListItem, clientX: number, clientY: number) => void;
  close: () => void;
};

const CalendarTaskColorMenuContext =
  createContext<CalendarTaskColorMenuContextValue | null>(null);

export const CALENDAR_TASK_ID_DATA_ATTR = "data-calendar-task-id";

export function getCalendarTaskIdFromEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null;

  const element = target.closest(`[${CALENDAR_TASK_ID_DATA_ATTR}]`);
  return element?.getAttribute(CALENDAR_TASK_ID_DATA_ATTR) ?? null;
}

export function useCalendarTaskColorMenuActions() {
  return useContext(CalendarTaskColorMenuContext);
}

export function useCalendarTaskColorMenuCaptureHandler(tasks: TaskListItem[]) {
  const colorMenuActions = useCalendarTaskColorMenuActions();
  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  return useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!colorMenuActions?.enabled) return;

      const taskId = getCalendarTaskIdFromEventTarget(event.target);
      if (!taskId) return;

      const task = tasksById.get(taskId);
      if (!task) return;

      event.preventDefault();
      event.stopPropagation();
      colorMenuActions.open(task, event.clientX, event.clientY);
    },
    [colorMenuActions, tasksById],
  );
}

function clampMenuPosition(top: number, left: number) {
  if (typeof window === "undefined") {
    return { top, left };
  }

  return {
    top: Math.min(
      Math.max(VIEWPORT_PADDING, top),
      window.innerHeight - MENU_HEIGHT - VIEWPORT_PADDING,
    ),
    left: Math.min(
      Math.max(VIEWPORT_PADDING, left),
      window.innerWidth - MENU_WIDTH - VIEWPORT_PADDING,
    ),
  };
}

export function CalendarTaskColorMenuProvider({
  children,
  onSetTaskCalendarColor,
}: {
  children: ReactNode;
  onSetTaskCalendarColor?: (taskId: string, color: string | null) => void;
}) {
  const [menu, setMenu] = useState<ColorMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { defaultColor } = useCalendarTaskDefaultColor();

  const close = useCallback(() => {
    setMenu(null);
  }, []);

  const open = useCallback(
    (task: TaskListItem, clientX: number, clientY: number) => {
      if (!onSetTaskCalendarColor) return;
      setMenu({
        task,
        ...clampMenuPosition(clientY + 4, clientX + 4),
      });
    },
    [onSetTaskCalendarColor],
  );

  useEffect(() => {
    if (!menu) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, menu]);

  const enabled = Boolean(onSetTaskCalendarColor);

  const contextValue = useMemo(
    () => ({ enabled, open, close }),
    [close, enabled, open],
  );

  const selectedColor = menu
    ? normalizeCalendarTaskColor(menu.task.calendarColor) ?? defaultColor
    : null;

  return (
    <CalendarTaskColorMenuContext.Provider value={contextValue}>
      {children}
      {menu && onSetTaskCalendarColor && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Change calendar color"
              className="fixed z-[5000] rounded-2xl border border-zinc-200 bg-white p-3 shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.36)]"
              style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <p className="mb-2 px-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Task color
              </p>
              <div className="grid grid-cols-4 gap-2">
                {CALENDAR_TASK_COLOR_OPTIONS.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isSelected}
                      aria-label={`Set calendar color ${color}`}
                      className={`size-6 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/15 ${
                        isSelected
                          ? "ring-2 ring-zinc-800 ring-offset-2 dark:ring-zinc-100 dark:ring-offset-zinc-900"
                          : ""
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => {
                        onSetTaskCalendarColor(
                          menu.task.id,
                          isSelected ? null : color,
                        );
                        close();
                      }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                role="menuitem"
                className="mt-2.5 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => {
                  onSetTaskCalendarColor(menu.task.id, null);
                  close();
                }}
              >
                Use default color
              </button>
            </div>,
            document.body,
          )
        : null}
    </CalendarTaskColorMenuContext.Provider>
  );
}

export function useCalendarTaskColorMenu(
  task: TaskListItem,
  options?: { onBeforeOpen?: () => void },
) {
  const context = useContext(CalendarTaskColorMenuContext);

  return useMemo(() => {
    if (!context?.enabled) {
      return {};
    }

    return {
      onContextMenu: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        options?.onBeforeOpen?.();
        context.open(task, event.clientX, event.clientY);
      },
    };
  }, [context, options?.onBeforeOpen, task]);
}
