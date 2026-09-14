"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  getTaskPriorityLabel,
  getTaskPrioritySurface,
  isTaskPriorityLevel,
  type TaskPriorityLevel,
} from "@/lib/task-priority";
import { TaskPriorityFlagIcon } from "./task-priority-icon";

type TaskPriorityPillProps = {
  priority: number | null | undefined;
  className?: string;
  interactive?: boolean;
  menuOpen?: boolean;
  onToggleMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
};

const TOOLTIP_GAP_PX = 10;
const VIEWPORT_PADDING_PX = 8;

export function TaskPriorityPill({
  priority,
  className = "",
  interactive = false,
  menuOpen = false,
  onToggleMenu,
  buttonRef,
}: TaskPriorityPillProps) {
  if (priority == null || !isTaskPriorityLevel(priority)) return null;

  return (
    <TaskPriorityPillInner
      priority={priority}
      className={className}
      interactive={interactive}
      menuOpen={menuOpen}
      onToggleMenu={onToggleMenu}
      buttonRef={buttonRef}
    />
  );
}

function TaskPriorityPillInner({
  priority,
  className,
  interactive,
  menuOpen,
  onToggleMenu,
  buttonRef,
}: {
  priority: TaskPriorityLevel;
  className: string;
  interactive: boolean;
  menuOpen: boolean;
  onToggleMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number;
    left: number;
    arrowLeft: number;
  } | null>(null);

  const surface = getTaskPrioritySurface(priority);
  const ariaLabel = getTaskPriorityLabel(priority);

  useLayoutEffect(() => {
    if (!showTooltip || menuOpen) {
      setTooltipStyle(null);
      return;
    }

    let frameId = 0;

    function updatePosition() {
      const anchor = interactive ? buttonRef?.current : anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) {
        frameId = window.requestAnimationFrame(updatePosition);
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      const anchorCenterX = anchorRect.left + anchorRect.width / 2;

      let left = anchorCenterX - tooltipRect.width / 2;
      left = Math.max(
        VIEWPORT_PADDING_PX,
        Math.min(
          left,
          window.innerWidth - tooltipRect.width - VIEWPORT_PADDING_PX,
        ),
      );

      const top = anchorRect.top - tooltipRect.height - TOOLTIP_GAP_PX;
      const arrowLeft = Math.max(
        12,
        Math.min(tooltipRect.width - 12, anchorCenterX - left),
      );
      setTooltipStyle({ top, left, arrowLeft });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showTooltip, menuOpen, ariaLabel, interactive, buttonRef]);

  if (!surface || !ariaLabel) return null;

  const pill = (
    <span
      aria-hidden={interactive ? true : undefined}
      className="inline-flex w-[25px] h-[25px] items-center justify-center rounded-full"
      style={{ backgroundColor: surface.background }}
    >
      <TaskPriorityFlagIcon level={priority} className="size-[10px] shrink-0" />
    </span>
  );

  return (
    <>
      {interactive ? (
        <button
          ref={buttonRef}
          type="button"
          data-task-priority-trigger
          aria-label={`${ariaLabel}. Change priority`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`inline-flex shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-90 ${className}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu?.(event);
          }}
          onMouseEnter={() => {
            if (!menuOpen) {
              setShowTooltip(true);
            }
          }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {pill}
        </button>
      ) : (
        <span
          ref={anchorRef}
          className={`inline-flex shrink-0 ${className}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span aria-label={ariaLabel}>{pill}</span>
        </span>
      )}
      {showTooltip && !menuOpen
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              className={`task-priority-tooltip add-task-date-tooltip pointer-events-none fixed z-[200] whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${
                tooltipStyle ? "opacity-100" : "opacity-0"
              }`}
              style={
                tooltipStyle
                  ? {
                      top: tooltipStyle.top,
                      left: tooltipStyle.left,
                      ["--task-priority-tooltip-arrow-left" as string]: `${tooltipStyle.arrowLeft}px`,
                    }
                  : {
                      top: -9999,
                      left: -9999,
                    }
              }
            >
              {ariaLabel}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
