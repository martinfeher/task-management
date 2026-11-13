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
export const LIST_CALENDAR_OVERLAP_TRANSITION_MS = 400;

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
  onOverlapLayoutChange?: (active: boolean) => void;
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
  onOverlapLayoutChange,
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
  const pendingFlipRef = useRef<DOMRect | null>(null);

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

  useEffect(() => {
    onOverlapLayoutChange?.(overlapActive);
  }, [onOverlapLayoutChange, overlapActive]);

  useEffect(() => {
    if (!enabled) {
      onOverlapLayoutChange?.(false);
    }
  }, [enabled, onOverlapLayoutChange]);

  const captureFlipStart = useCallback(() => {
    const shell = shellRef.current;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!shell || !canToggleLayout || prefersReducedMotion) {
      pendingFlipRef.current = null;
      return;
    }

    pendingFlipRef.current = shell.getBoundingClientRect();
  }, [canToggleLayout]);

  const toggleLayout = useCallback(() => {
    captureFlipStart();
    setIsSlideExpanded((current) => !current);
  }, [captureFlipStart]);

  useEffect(() => {
    if (!canToggleLayout) return;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, LIST_CALENDAR_OVERLAP_TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [isSlideExpanded, canToggleLayout]);

  const expandToDefaultLayout = useCallback(() => {
    captureFlipStart();
    setIsSlideExpanded(true);
  }, [captureFlipStart]);

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

  useLayoutEffect(() => {
    if (!canToggleLayout) return;

    const first = pendingFlipRef.current;
    if (!first) return;

    if (overlapActive && !overlapFrame) {
      return;
    }

    const shellElement = shellRef.current;
    if (!shellElement) {
      pendingFlipRef.current = null;
      return;
    }

    const last = shellElement.getBoundingClientRect();
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    const scaleX = first.width / Math.max(last.width, 1);

    pendingFlipRef.current = null;

    if (
      Math.abs(deltaX) < 0.5 &&
      Math.abs(deltaY) < 0.5 &&
      Math.abs(scaleX - 1) < 0.002
    ) {
      return;
    }

    shellElement.style.transformOrigin = "top left";
    shellElement.style.transition = "none";
    shellElement.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scaleX(${scaleX})`;

    requestAnimationFrame(() => {
      shellElement.style.transition = `transform ${LIST_CALENDAR_OVERLAP_TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      shellElement.style.transform = "";

      function onTransitionEnd(event: TransitionEvent) {
        const el = shellRef.current;
        if (
          !el ||
          event.target !== el ||
          event.propertyName !== "transform"
        ) {
          return;
        }
        el.style.transition = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
        el.removeEventListener("transitionend", onTransitionEnd);
      }

      shellElement.addEventListener("transitionend", onTransitionEnd);
    });
  }, [canToggleLayout, isSlideExpanded, overlapActive, overlapFrame]);

  const overlapStyle: CSSProperties | undefined =
    overlapActive && overlapFrame
      ? {
          position: "fixed",
          top: overlapFrame.top,
          left: overlapFrame.left,
          right: 0,
          // `w-full` on the shell would otherwise make it viewport-wide and push
          // its right edge (calendar sidebar) off-screen when offset by `left`.
          width: "auto",
          bottom: overlapFrame.bottom,
          zIndex: 2200,
        }
      : undefined;

  const shellClassName = [
    "list-calendar-overlap-shell flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-white rounded-l-[15px] dark:bg-zinc-950",
    overlapActive ? "list-calendar-overlap-shell--docked" : "",
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
        className="relative flex min-h-0 min-w-0 flex-1 flex-col self-stretch"
        style={{ minWidth: TASK_LIST_PANEL_MIN_WIDTH }}
      >
        <div ref={shellRef} className={shellClassName} style={overlapStyle}>
          {children}
        </div>
      </div>
    </ListCalendarOverlapContext.Provider>
  );
}
