"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

type CalendarPeriodNavigationProps = {
  onPrevious: () => void;
  onNext: () => void;
  onToday?: () => void;
  centerLabel?: string;
  isViewingToday?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
  enableArrowKeyNavigation?: boolean;
};

function CalendarPeriodNavigationCenter({
  centerLabel,
  isViewingToday = true,
  onToday,
}: {
  centerLabel?: string;
  isViewingToday?: boolean;
  onToday?: () => void;
}) {
  const [showTodayPopover, setShowTodayPopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const showTodayHint = Boolean(centerLabel && !isViewingToday && onToday);

  function clearHideTimeout() {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }

  function openPopover() {
    if (!showTodayHint) return;
    clearHideTimeout();
    setShowTodayPopover(true);
  }

  function scheduleClosePopover() {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setShowTodayPopover(false);
    }, 120);
  }

  useEffect(() => {
    if (!showTodayPopover || !anchorRef.current) {
      setPopoverPosition(null);
      return;
    }

    function updatePosition() {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopoverPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showTodayPopover, centerLabel]);

  useEffect(() => {
    return () => clearHideTimeout();
  }, []);

  if (centerLabel) {
    return (
      <>
        <div
          ref={anchorRef}
          className="relative"
          onMouseEnter={openPopover}
          onMouseLeave={scheduleClosePopover}
        >
          <span className="block min-w-0 truncate rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 cursor-pointer">
            {centerLabel}
          </span>
        </div>
        {showTodayHint &&
        showTodayPopover &&
        popoverPosition &&
        typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed z-[120] -translate-x-1/2"
                style={{
                  top: popoverPosition.top,
                  left: popoverPosition.left,
                }}
                onMouseEnter={openPopover}
                onMouseLeave={scheduleClosePopover}
              >
                <div className="border rounded-full border-zinc-200 bg-[#fcfcfc]/90 px-2 pb-[4px] pt-[3px] shadow-lg dark:border-zinc-700 dark:bg-zinc-900/80">
           
                  <button
                    type="button"
                    onClick={() => {
                      onToday?.();
                      setShowTodayPopover(false);
                    }}
                    className="cursor-pointer rounded-full px-2 py-[2px] text-[11px] text-[#797979] transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Go to today
                  </button>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onToday}
      className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-150 dark:text-zinc-200 dark:hover:bg-zinc-700/80"
    >
      Today
    </button>
  );
}

export function CalendarPeriodNavigation({
  onPrevious,
  onNext,
  onToday,
  centerLabel,
  isViewingToday,
  previousLabel = "Previous period",
  nextLabel = "Next period",
  className = "",
  enableArrowKeyNavigation = false,
}: CalendarPeriodNavigationProps) {
  useEffect(() => {
    if (!enableArrowKeyNavigation) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTypingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }

      event.preventDefault();
      if (event.key === "ArrowLeft") {
        onPrevious();
      } else {
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableArrowKeyNavigation, onNext, onPrevious]);

  return (
    <div
      className={`inline-flex h-9 items-center gap-0.5 overflow-visible rounded-full bg-zinc-100/90 p-0.5 dark:bg-zinc-800/70 ${className}`.trim()}
    >
      <button
        type="button"
        aria-label={previousLabel}
        onClick={onPrevious}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-150 dark:text-zinc-300 dark:hover:bg-zinc-700/80"
      >
        <BiChevronLeft className="size-5" />
      </button>
      <CalendarPeriodNavigationCenter
        centerLabel={centerLabel}
        isViewingToday={isViewingToday}
        onToday={onToday}
      />
      <button
        type="button"
        aria-label={nextLabel}
        onClick={onNext}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-150 dark:text-zinc-300 dark:hover:bg-zinc-700/80"
      >
        <BiChevronRight className="size-5" />
      </button>
    </div>
  );
}
