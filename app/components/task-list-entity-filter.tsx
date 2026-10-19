"use client";

export type TaskListEntityScope = "all" | "notes" | "tasks";

const ENTITY_SCOPE_TABS: { id: TaskListEntityScope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
];

export function taskMatchesEntityScope(
  isNote: boolean,
  scope: TaskListEntityScope,
) {
  if (scope === "all") return true;
  if (scope === "notes") return isNote;
  return !isNote;
}

type TaskListEntityFilterProps = {
  value: TaskListEntityScope;
  onChange: (value: TaskListEntityScope) => void;
};

export function TaskListEntityFilter({
  value,
  onChange,
}: TaskListEntityFilterProps) {
  return (
    <div
      className="pointer-events-auto flex items-center rounded-full border border-[#e3e6ec] bg-white/95 p-0.5 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95"
      role="group"
      aria-label="Filter tasks and notes"
    >
      {ENTITY_SCOPE_TABS.map((tab) => {
        const isSelected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isSelected}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(tab.id)}
            className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-medium leading-none transition-colors ${
              isSelected
                ? "bg-[#e8f0fe] text-[#4873c7] dark:bg-[#1e3a5f] dark:text-[#7da2ff]"
                : "text-[#8b8f98] hover:text-[#5c616b] dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
