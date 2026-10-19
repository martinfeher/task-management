"use client";

import { PiNoteLight } from "react-icons/pi";
import { LuListTodo } from "react-icons/lu";

export type AddTaskKind = "task" | "note";

type AddTaskKindSwitchProps = {
  value: AddTaskKind;
  onChange: (value: AddTaskKind) => void;
};

export function AddTaskKindSwitch({ value, onChange }: AddTaskKindSwitchProps) {
  return (
    <div
      className="flex shrink-0 items-center rounded-full bg-[#eef0f3] p-px dark:bg-zinc-800"
      role="group"
      aria-label="Create as task or note"
    >
      <button
        type="button"
        aria-pressed={value === "task"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange("task")}
        className={`flex h-[18px] cursor-pointer items-center gap-0.5 rounded-full px-1.5 text-[10px] font-medium leading-none transition-colors ${
          value === "task"
            ? "bg-[#1e293b] text-white shadow-sm dark:bg-zinc-950"
            : "text-[#64748b] hover:text-[#475569] dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <LuListTodo className="size-3 shrink-0" aria-hidden="true" />
        Task
      </button>
      <button
        type="button"
        aria-pressed={value === "note"}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onChange("note")}
        className={`flex h-[18px] cursor-pointer items-center gap-0.5 rounded-full px-1.5 text-[10px] font-medium leading-none transition-colors ${
          value === "note"
            ? "bg-[#1e293b] text-white shadow-sm dark:bg-zinc-950"
            : "text-[#64748b] hover:text-[#475569] dark:text-zinc-400 dark:hover:text-zinc-200"
        }`}
      >
        <PiNoteLight
          className="size-3 shrink-0"
          aria-hidden="true"
          strokeWidth={0.5}
        />
        Note
      </button>
    </div>
  );
}
