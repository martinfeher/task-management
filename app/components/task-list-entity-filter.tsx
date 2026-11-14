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
      className="pointer-events-auto relative flex h-[26px] items-center rounded-full border border-[#e3e6ec] px-[4px] py-0 shadow-sm  bg-white/[0.6] backdrop-blur-[4px] dark:border-zinc-700 dark:bg-zinc-900/[0.83]"
      role="group"
      aria-label="Filter tasks and notes"
    >
      {indicator ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full bg-[#e8f0fe] transition-[left,width,top,height] duration-[400ms] ease-in-out motion-reduce:transition-none dark:bg-[#1e3a5f]"
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
        const { Icon } = tab;

        return (
          <span key={tab.id} className="relative z-[1] flex items-center">
            {index > 0 ? (
              <span
                className={`mx-0.5 h-3.5 w-px shrink-0 bg-[#e3e6ec] transition-opacity duration-[400ms] ease-in-out motion-reduce:transition-none dark:bg-zinc-600 ${
                  value === "all" ? "opacity-100" : "opacity-0"
                }`}
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onChange(tab.id)}
                className={`flex h-[21px] min-w-[22px] mb-[1px] mt-px cursor-pointer items-center justify-center gap-1 rounded-full px-1.5 py-[2px] leading-none transition-[color,font-size,font-weight] duration-[400ms] ease-in-out motion-reduce:transition-none ${
                  isSelected
                    ? "text-[11px] font-medium text-[#4873c7] dark:text-[#7da2ff]"
                    : "text-[9px] font-normal text-[#8b8f98] hover:bg-zinc-100 hover:text-[#5c616b] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            </div>
          </span>
        );
      })}
    </div>
  );
}
