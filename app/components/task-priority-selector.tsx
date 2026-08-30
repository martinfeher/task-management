"use client";

import { useId, type MouseEvent, type ReactNode } from "react";
import {
  TASK_PRIORITY_OPTIONS,
  type TaskPriorityLevel,
} from "@/lib/task-priority";
import { TaskPriorityFlagIcon } from "./task-priority-icon";

type TaskPrioritySelectorProps = {
  selectedPriority: number | null;
  onSelectPriority: (priority: TaskPriorityLevel) => void;
  onClearPriority: () => void;
};

function TaskPrioritySelectorButton({
  label,
  isSelected,
  tooltipId,
  tooltipAlign = "center",
  onClick,
  children,
}: {
  label: string;
  isSelected: boolean;
  tooltipId: string;
  tooltipAlign?: "start" | "center" | "end";
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  const tooltipPositionClass =
    tooltipAlign === "start"
      ? "left-0 task-context-menu-tooltip-start"
      : tooltipAlign === "end"
        ? "right-0 left-auto task-context-menu-tooltip-end"
        : "left-1/2 -translate-x-1/2";

  return (
    <div className="group/priority-option relative cursor-pointer">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-pressed={isSelected}
        className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${
          isSelected ? "bg-zinc-100 dark:bg-zinc-800" : ""
        }`}
        onClick={onClick}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+6px)] z-50 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/priority-option:opacity-100 ${tooltipPositionClass}`}
      >
        {label}
      </span>
    </div>
  );
}

export function TaskPrioritySelector({
  selectedPriority,
  onSelectPriority,
  onClearPriority,
}: TaskPrioritySelectorProps) {
  const tooltipBaseId = useId();

  return (
    <div className="overflow-visible px-3 py-2">
      <div className="mb-[3px] text-xs font-medium text-zinc-350 dark:text-zinc-500">
        priority
      </div>
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
