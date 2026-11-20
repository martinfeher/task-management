"use client";

import { FROSTED_POPOVER_SURFACE_CLASS } from "@/lib/frosted-popover-surface";
import { TASK_LIST_METADATA_POPOVER_SHADOW_CLASS } from "@/lib/task-list-metadata-popover-shadow";
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
      className={`overflow-visible rounded-[16px] ${FROSTED_POPOVER_SURFACE_CLASS} ${TASK_LIST_METADATA_POPOVER_SHADOW_CLASS}`}
    >
      <TaskPrioritySelector
        selectedPriority={selectedPriority}
        onSelectPriority={onSelectPriority}
        onClearPriority={onClearPriority}
      />
    </div>
  );
}
