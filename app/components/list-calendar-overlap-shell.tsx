"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { TASK_LIST_PANEL_MIN_WIDTH } from "./task-list-panel";

export const LIST_CALENDAR_OVERLAP_MAX_WIDTH_PX = 1800;
export const LIST_CALENDAR_OVERLAP_LEFT_INSET_PX = 44;

type ListCalendarOverlapContextValue = {
  canToggleLayout: boolean;
  isOverlapLayout: boolean;
  toggleLayout: () => void;
};

const ListCalendarOverlapContext =
  createContext<ListCalendarOverlapContextValue | null>(null);

export function useListCalendarOverlapLayout() {
  return useContext(ListCalendarOverlapContext);
}

type ListCalendarOverlapShellProps = {
  enabled: boolean;
  taskListPanelRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
};

type OverlapFrame = {
  top: number;
  left: number;
  bottom: number;
};

export function ListCalendarOverlapShell({
  enabled,
  taskListPanelRef,
  children,
  className = "",
}: ListCalendarOverlapShellProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [isSlideExpanded, setIsSlideExpanded] = useState(true);
  const [overlapFrame, setOverlapFrame] = useState<OverlapFrame | null>(null);
  const [gapHitArea, setGapHitArea] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      `(max-width: ${LIST_CALENDAR_OVERLAP_MAX_WIDTH_PX - 1}px)`,
    );

    function syncViewport() {
      setIsNarrowViewport(mediaQuery.matches);
    }

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (!enabled || !isNarrowViewport) {
      return;
    }
    setIsSlideExpanded(true);
  }, [enabled, isNarrowViewport]);

  const canToggleLayout = enabled && isNarrowViewport;
  const overlapActive = canToggleLayout && !isSlideExpanded;

  const toggleLayout = useCallback(() => {
    setIsSlideExpanded((current) => !current);
  }, []);

  useEffect(() => {
    if (!canToggleLayout) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 320);
    return () => window.clearTimeout(timer);
  }, [isSlideExpanded, canToggleLayout]);

  const expandToDefaultLayout = useCallback(() => {
    setIsSlideExpanded(true);
  }, []);

  useLayoutEffect(() => {
    if (!overlapActive) {
      setOverlapFrame(null);
      setGapHitArea(null);
      return;
    }

    function measureOverlap() {
      const taskListElement = taskListPanelRef.current;
      const wrapperElement = wrapperRef.current;
      if (!taskListElement || !wrapperElement) return;

      const taskListRect = taskListElement.getBoundingClientRect();
      const wrapperRect = wrapperElement.getBoundingClientRect();
      const left = taskListRect.left + LIST_CALENDAR_OVERLAP_LEFT_INSET_PX;

      setOverlapFrame({
        top: wrapperRect.top,
        left,
        bottom: Math.max(0, window.innerHeight - wrapperRect.bottom),
      });
      setGapHitArea({
        left: taskListRect.left,
        top: wrapperRect.top,
        width: LIST_CALENDAR_OVERLAP_LEFT_INSET_PX,
        height: wrapperRect.height,
      });
    }

    measureOverlap();

    const resizeObserver = new ResizeObserver(measureOverlap);
    if (taskListPanelRef.current) {
      resizeObserver.observe(taskListPanelRef.current);
    }
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    window.addEventListener("resize", measureOverlap);
    window.visualViewport?.addEventListener("resize", measureOverlap);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureOverlap);
      window.visualViewport?.removeEventListener("resize", measureOverlap);
    };
  }, [overlapActive, enabled, taskListPanelRef]);

  const overlapStyle: CSSProperties | undefined =
    overlapActive && overlapFrame
      ? {
          position: "fixed",
          top: overlapFrame.top,
          left: overlapFrame.left,
          right: 0,
          bottom: overlapFrame.bottom,
          zIndex: 2100,
        }
      : undefined;

  const shellClassName = [
    "flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white rounded-l-[15px] transition-[left,right,transform] duration-300 ease-out dark:bg-zinc-950",
    overlapActive
      ? "shadow-[0_0_28px_rgba(15,23,42,0.14),12px_0_32px_-6px_rgba(15,23,42,0.22)] dark:shadow-[0_0_28px_rgba(0,0,0,0.4),12px_0_32px_-6px_rgba(0,0,0,0.55)]"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const overlapContextValue = useMemo<ListCalendarOverlapContextValue | null>(
    () =>
      canToggleLayout
        ? {
            canToggleLayout: true,
            isOverlapLayout: overlapActive,
            toggleLayout,
          }
        : null,
    [canToggleLayout, overlapActive, toggleLayout],
  );

  return (
    <ListCalendarOverlapContext.Provider value={overlapContextValue}>
      {overlapActive && gapHitArea && typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              aria-label="Move calendar to default layout"
              title="Default calendar layout"
              className="fixed z-[2500] cursor-pointer border-0 bg-transparent p-0"
              style={{
                left: gapHitArea.left,
                top: gapHitArea.top,
                width: gapHitArea.width,
                height: gapHitArea.height,
              }}
              onClick={expandToDefaultLayout}
            />,
            document.body,
          )
        : null}
      <div
        ref={wrapperRef}
        className="relative flex min-h-0 flex-1 flex-col self-stretch"
        style={{ minWidth: TASK_LIST_PANEL_MIN_WIDTH }}
      >
        <div ref={shellRef} className={shellClassName} style={overlapStyle}>
          {children}
        </div>
      </div>
    </ListCalendarOverlapContext.Provider>
  );
}
