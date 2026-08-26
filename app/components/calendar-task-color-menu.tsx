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
import type { TaskListItem } from "./todo-app";

const MENU_WIDTH = 148;
const MENU_HEIGHT = 148;
const VIEWPORT_PADDING = 8;

type ColorMenuState = {
  task: TaskListItem;
  top: number;
  left: number;
};

type CalendarTaskColorMenuContextValue = {
  open: (task: TaskListItem, clientX: number, clientY: number) => void;
  close: () => void;
};

const CalendarTaskColorMenuContext =
  createContext<CalendarTaskColorMenuContextValue | null>(null);

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

  const contextValue = useMemo(
    () => ({ open, close }),
    [close, open],
  );

  const selectedColor = menu
    ? normalizeCalendarTaskColor(menu.task.calendarColor)
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
              className="fixed z-[220] rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.36)]"
              style={{ top: menu.top, left: menu.left, width: MENU_WIDTH }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
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
            </div>,
            document.body,
          )
        : null}
    </CalendarTaskColorMenuContext.Provider>
  );
}

export function useCalendarTaskColorMenu(task: TaskListItem) {
  const context = useContext(CalendarTaskColorMenuContext);

  return useMemo(() => {
    if (!context) {
      return {};
    }

    return {
      onContextMenu: (event: MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        context.open(task, event.clientX, event.clientY);
      },
    };
  }, [context, task]);
}
