"use client";

import type { TaskPriorityLevel } from "@/lib/task-priority";
import { TaskPrioritySelector } from "./task-priority-selector";

type TaskPriorityMenuProps = {
  selectedPriority: number | null;
  onSelectPriority: (priority: TaskPriorityLevel) => void;
  onClearPriority: () => void;
};

export function TaskPriorityMenu({
  selectedPriority,
  onSelectPriority,
  onClearPriority,
}: TaskPriorityMenuProps) {
  return (
    <div
      role="menu"
      className="overflow-visible rounded-[16px] bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
    >
      <TaskPrioritySelector
        selectedPriority={selectedPriority}
        onSelectPriority={onSelectPriority}
        onClearPriority={onClearPriority}
      />
    </div>
  );
}
