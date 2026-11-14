"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  TASK_PRIORITY_OPTIONS,
  type TaskPriorityLevel,
} from "@/lib/task-priority";
import { TaskPriorityFlagIcon } from "./task-priority-icon";
import {
  APP_HOVER_TOOLTIP_ABOVE_CENTER,
  APP_HOVER_TOOLTIP_ABOVE_END,
  APP_HOVER_TOOLTIP_ABOVE_START,
  APP_HOVER_TOOLTIP_SHOWN,
} from "@/lib/app-hover-tooltip-classes";

const PRIORITY_OPTION_TOOLTIP_GAP_PX = 6;
const PRIORITY_OPTION_TOOLTIP_VIEWPORT_PADDING_PX = 8;
const PRIORITY_OPTION_PORTAL_TOOLTIP_Z_CLASS = "z-[10060]";

type TaskPrioritySelectorProps = {
  selectedPriority: number | null;
  onSelectPriority: (priority: TaskPriorityLevel) => void;
  onClearPriority: () => void;
  tone?: "default" | "contextMenu";
  /** Calendar modal footer: render option tooltips in a portal so they are not clipped. */
  portaledOptionTooltips?: boolean;
};

function TaskPrioritySelectorButton({
  label,
  isSelected,
  tooltipId,
  tooltipAlign = "center",
  portaledTooltip = false,
  onClick,
  children,
}: {
  label: string;
  isSelected: boolean;
  tooltipId: string;
  tooltipAlign?: "start" | "center" | "end";
  portaledTooltip?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const tooltipPositionClass =
    tooltipAlign === "start"
      ? `${APP_HOVER_TOOLTIP_ABOVE_START} left-0 task-context-menu-tooltip-start`
      : tooltipAlign === "end"
        ? `${APP_HOVER_TOOLTIP_ABOVE_END} right-0 left-auto task-context-menu-tooltip-end`
        : APP_HOVER_TOOLTIP_ABOVE_CENTER;

  const portaledTooltipPositionClass =
    tooltipAlign === "start"
      ? APP_HOVER_TOOLTIP_ABOVE_START
      : tooltipAlign === "end"
        ? APP_HOVER_TOOLTIP_ABOVE_END
        : APP_HOVER_TOOLTIP_ABOVE_CENTER;

  useLayoutEffect(() => {
    if (!portaledTooltip || !tooltipVisible) {
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
      const top =
        anchorRect.top - tooltipRect.height - PRIORITY_OPTION_TOOLTIP_GAP_PX;

      let left: number;
      if (tooltipAlign === "start") {
        left = Math.max(
          PRIORITY_OPTION_TOOLTIP_VIEWPORT_PADDING_PX,
          anchorRect.left,
        );
      } else if (tooltipAlign === "end") {
        left = Math.min(
          anchorRect.right - tooltipRect.width,
          window.innerWidth -
            PRIORITY_OPTION_TOOLTIP_VIEWPORT_PADDING_PX -
            tooltipRect.width,
        );
      } else {
        const anchorCenterX = anchorRect.left + anchorRect.width / 2;
        const halfTooltipWidth = tooltipRect.width / 2;
        left = Math.max(
          PRIORITY_OPTION_TOOLTIP_VIEWPORT_PADDING_PX + halfTooltipWidth,
          Math.min(
            anchorCenterX,
            window.innerWidth -
              PRIORITY_OPTION_TOOLTIP_VIEWPORT_PADDING_PX -
              halfTooltipWidth,
          ),
        );
      }

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
  }, [portaledTooltip, tooltipAlign, tooltipVisible]);

  const tooltipNode = (
    <span
      ref={portaledTooltip ? tooltipRef : undefined}
      id={tooltipId}
      role="tooltip"
      className={`add-task-date-tooltip pointer-events-none whitespace-nowrap px-3 py-1.5 text-[11px] font-medium ${
        portaledTooltip
          ? `fixed ${PRIORITY_OPTION_PORTAL_TOOLTIP_Z_CLASS} ${portaledTooltipPositionClass} ${
              tooltipStyle ? APP_HOVER_TOOLTIP_SHOWN : ""
            }`
          : `absolute bottom-[calc(100%+6px)] z-50 ${tooltipPositionClass}`
      }`}
      style={
        portaledTooltip
          ? tooltipStyle
            ? { top: tooltipStyle.top, left: tooltipStyle.left }
            : { top: -9999, left: -9999 }
          : undefined
      }
    >
      {label}
    </span>
  );

  return (
    <div
      className="group/priority-option relative cursor-pointer"
      onMouseEnter={() => {
        if (portaledTooltip) setTooltipVisible(true);
      }}
      onMouseLeave={() => {
        if (portaledTooltip) setTooltipVisible(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-pressed={isSelected}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
          isSelected ? "bg-zinc-100 dark:bg-zinc-800" : ""
        }`}
        onClick={onClick}
      >
        {children}
      </button>
      {portaledTooltip
        ? tooltipVisible && typeof document !== "undefined"
          ? createPortal(tooltipNode, document.body)
          : null
        : tooltipNode}
    </div>
  );
}

export function TaskPrioritySelector({
  selectedPriority,
  onSelectPriority,
  onClearPriority,
  tone = "default",
  portaledOptionTooltips = false,
}: TaskPrioritySelectorProps) {
  const tooltipBaseId = useId();

  return (
    <div className="overflow-visible px-3 pt-[2px] pb-[4px]">
      <div className="flex w-full items-center justify-between">
        {TASK_PRIORITY_OPTIONS.map((option, index) => {
          const isSelected = selectedPriority === option.level;

          return (
            <TaskPrioritySelectorButton
              key={option.label}
              label={option.label}
              isSelected={isSelected}
              tooltipId={`${tooltipBaseId}-priority-${option.level}`}
              tooltipAlign={index === 0 ? "start" : "center"}
              portaledTooltip={portaledOptionTooltips}
              onClick={(event) => {
                event.stopPropagation();
                onSelectPriority(option.level);
              }}
            >
              <TaskPriorityFlagIcon level={option.level} className="size-4" />
            </TaskPrioritySelectorButton>
          );
        })}
        <TaskPrioritySelectorButton
          label="Clear"
          isSelected={selectedPriority == null}
          tooltipId={`${tooltipBaseId}-priority-clear`}
          tooltipAlign="end"
          portaledTooltip={portaledOptionTooltips}
          onClick={(event) => {
            event.stopPropagation();
            onClearPriority();
          }}
        >
          <TaskPriorityFlagIcon outline className="size-4" />
        </TaskPrioritySelectorButton>
      </div>
    </div>
  );
}
