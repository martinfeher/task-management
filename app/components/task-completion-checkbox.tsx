"use client";

import type { CSSProperties, MouseEvent, SVGProps } from "react";

const CHECKMARK_OUTLINE_CHECK_PATH =
  "m14 21.414l-5-5.001L10.413 15L14 18.586L21.585 11L23 12.415z";

const CHECKMARK_OUTLINE_CIRCLE_PATH =
  "M16 2a14 14 0 1 0 14 14A14 14 0 0 0 16 2m0 26a12 12 0 1 1 12-12a12 12 0 0 1-12 12";

export const CHECKMARK_HIDE_MS = 1500;
export const CHECKMARK_HIDE_FADE_MS = 200;
/** Row celebration + settle background animation duration. */
export const TASK_COMPLETE_ANIMATION_MS = 350;
/** Text/content dim during task completion. */
export const CHECKED_ROW_DIM_MS = TASK_COMPLETE_ANIMATION_MS;
/** Session completions after the first two run at 30% duration. */
export const COMPLETION_ANIMATION_FAST_SCALE = 0.8;

export function getCompletionAnimationMs(baseMs: number, fast: boolean) {
  if (!fast) return baseMs;
  return Math.max(0, Math.round(baseMs * COMPLETION_ANIMATION_FAST_SCALE));
}

const checkStartTimes = new Map<string, number>();

export function clearCheckboxCheckStart(checkKey: string) {
  checkStartTimes.delete(checkKey);
}

function CheckmarkOutlineIcon({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d={CHECKMARK_OUTLINE_CIRCLE_PATH} fillRule="evenodd" />
      <path
        className="opacity-20 transition-opacity group-hover:opacity-100"
        d={CHECKMARK_OUTLINE_CHECK_PATH}
      />
    </svg>
  );
}

type TaskCompletionCheckboxProps = {
  checked: boolean;
  onChange: () => void;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLInputElement>) => void;
  className?: string;
  variant?: "outline" | "box";
  outlineClassName?: string;
  checkKey?: string;
  /** Only the actively checking box should animate (avoids animating the next row). */
  animateCheck?: boolean;
  /** Keep the settled checkmark visible instead of fading it out. */
  persistCheckmark?: boolean;
  "aria-label"?: string;
};

export function TaskCompletionCheckbox({
  checked,
  onChange,
  onClick,
  className = "",
  variant = "outline",
  outlineClassName,
  checkKey,
  animateCheck = false,
  persistCheckmark = false,
  "aria-label": ariaLabel,
}: TaskCompletionCheckboxProps) {
  if (variant === "box") {
    if (checkKey) {
      if (checked) {
        if (!persistCheckmark && !checkStartTimes.has(checkKey)) {
          checkStartTimes.set(checkKey, Date.now());
        }
      } else {
        checkStartTimes.delete(checkKey);
      }
    }

    const startedAt =
      !persistCheckmark && checkKey ? checkStartTimes.get(checkKey) : undefined;
    const elapsedMs = startedAt != null ? Date.now() - startedAt : 0;
    const hideDelayMs =
      checked && startedAt != null
        ? Math.max(0, CHECKMARK_HIDE_MS - elapsedMs)
        : CHECKMARK_HIDE_MS;
    const checkHidden =
      !persistCheckmark &&
      checked &&
      startedAt != null &&
      elapsedMs >= CHECKMARK_HIDE_MS;

    return (
      <div
        className={`checkbox-wrapper-29 task-completion-checkbox-box shrink-0 ${
          animateCheck ? "animate-check" : ""
        } ${checkHidden ? "check-hidden" : ""} ${
          persistCheckmark && checked ? "persist-checkmark" : ""
        } ${className}`}
        style={
          {
            "--check-hide-delay": `${hideDelayMs}ms`,
          } as CSSProperties
        }
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <label className="checkbox">
          <input
            type="checkbox"
            className="checkbox__input "
            checked={checked}
            aria-label={ariaLabel}
            onChange={onChange}
            onClick={(event) => {
              onClick?.(event);
            }}
          />
          <div className="checkbox__label" />
        </label>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        onChange();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      className={`group inline-flex shrink-0 items-center justify-center rounded-full p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60 dark:focus-visible:ring-zinc-500/60 ${
        outlineClassName ??
        (checked
          ? "text-[#5b8b6f] hover:text-zinc-400 dark:text-zinc-300 dark:hover:text-zinc-300"
          : "cursor-pointer text-[#31d988] hover:text-[#5b8b6f] dark:text-zinc-500 dark:hover:text-zinc-400")
      } ${className}`}
    >
      <CheckmarkOutlineIcon className="size-[1.06875rem]" />
    </button>
  );
}

export function TaskCompletionIcon({
  className = "size-8",
}: {
  checked?: boolean;
  className?: string;
}) {
  return <CheckmarkOutlineIcon className={className} />;
}
