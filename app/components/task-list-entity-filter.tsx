"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { HiOutlineSquare3Stack3D } from "react-icons/hi2";
import { MdOutlineStickyNote2 } from "react-icons/md";
import { VscTasklist } from "react-icons/vsc";
import type { IconType } from "react-icons";

export type TaskListEntityScope = "all" | "notes" | "tasks";

const ENTITY_SCOPE_TABS: {
  id: TaskListEntityScope;
  label: string;
  Icon: IconType;
}[] = [
  { id: "all", label: "All", Icon: HiOutlineSquare3Stack3D },
  { id: "notes", label: "Notes", Icon: MdOutlineStickyNote2 },
  { id: "tasks", label: "Tasks", Icon: VscTasklist },
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
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
    height: number;
    top: number;
  } | null>(null);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const index = ENTITY_SCOPE_TABS.findIndex((t) => t.id === value);
    const button = buttonRefs.current[index];
    if (!container || !button) return;

    const cr = container.getBoundingClientRect();
    const br = button.getBoundingClientRect();
    setIndicator({
      left: br.left - cr.left,
      width: br.width,
      height: br.height,
      top: br.top - cr.top,
    });
  }, [value]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      updateIndicator();
    });
    ro.observe(container);
    window.addEventListener("resize", updateIndicator);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto relative flex h-[26px] items-center rounded-full border border-[#e3e6ec] bg-white/90 px-[4px] py-0 shadow-sm backdrop-blur-[2px] dark:border-zinc-700 dark:bg-zinc-900/90"
      role="group"
      aria-label="Filter tasks and notes"
    >
      {indicator ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-[#e8f0fe] transition-[left,width,top,height] duration-200 ease-out motion-reduce:transition-none dark:bg-[#1e3a5f]"
          style={{
            left: indicator.left,
            width: indicator.width,
            top: indicator.top,
            height: indicator.height,
          }}
        />
      ) : null}
      {ENTITY_SCOPE_TABS.map((tab, index) => {
        const isSelected = value === tab.id;
        const previousTab = index > 0 ? ENTITY_SCOPE_TABS[index - 1] : null;
        const showDivider =
          index > 0 &&
          previousTab !== null &&
          value !== previousTab.id &&
          value !== tab.id;
        const { Icon } = tab;

        const tooltipId = `entity-filter-${tab.id}-tooltip`;

        return (
          <span key={tab.id} className="relative z-[1] flex items-center">
            {showDivider ? (
              <span
                className="mx-0.5 h-3.5 w-px shrink-0 bg-[#e3e6ec] dark:bg-zinc-600"
                aria-hidden="true"
              />
            ) : null}
            <div className="group relative">
              <button
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                type="button"
                aria-pressed={isSelected}
                aria-label={tab.label}
                aria-describedby={tooltipId}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange(tab.id)}
                className={`flex cursor-pointer items-center justify-center leading-none transition-colors duration-200 ease-out motion-reduce:transition-none ${
                  isSelected
                    ? "gap-1 rounded-full px-1.5 py-[2px] text-[11px] font-medium leading-none text-[#4873c7] dark:text-[#7da2ff]"
                    : "size-[27px] rounded-full text-[#8b8f98] hover:bg-zinc-100 hover:text-[#5c616b] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {isSelected ? <span>{tab.label}</span> : null}
              </button>
              <span
                id={tooltipId}
                role="tooltip"
                className="add-task-date-tooltip pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
              >
                {tab.label}
              </span>
            </div>
          </span>
        );
      })}
    </div>
  );
}
