"use client";

import { IoTextOutline } from "react-icons/io5";
import type { DetailTextBlockType } from "./detail-lines";

const TEXT_BLOCK_OPTIONS: {
  type: DetailTextBlockType;
  label: string;
}[] = [
  { type: "text", label: "Body text" },
  { type: "h1", label: "Heading 1" },
  { type: "h2", label: "Heading 2" },
  { type: "h3", label: "Heading 3" },
];

type DetailBlockTypeControlsProps = {
  activeType: DetailTextBlockType;
  disabled?: boolean;
  isTypeDisabled?: (type: DetailTextBlockType) => boolean;
  onSelect: (type: DetailTextBlockType) => void;
  buttonClassName: string;
  activeButtonClassName?: string;
  dividerClassName?: string;
  showLeadingDivider?: boolean;
  showTrailingDivider?: boolean;
};

function HeadingLevelIcon({
  level,
  className,
}: {
  level: 1 | 2 | 3;
  className?: string;
}) {
  const subscript = level === 1 ? "₁" : level === 2 ? "₂" : "₃";

  return (
    <span
      className={`inline-flex items-baseline font-medium leading-none ${className ?? ""}`}
    >
      H
      <span className="text-[10px] leading-none">{subscript}</span>
    </span>
  );
}

function BlockTypeIcon({
  type,
  active,
}: {
  type: DetailTextBlockType;
  active: boolean;
}) {
  const colorClass = active ? "text-[#2563eb]" : "text-zinc-700 dark:text-zinc-200";

  if (type === "text") {
    return <IoTextOutline className={`size-4 ${colorClass}`} aria-hidden="true" />;
  }

  return (
    <HeadingLevelIcon
      level={type === "h1" ? 1 : type === "h2" ? 2 : 3}
      className={`text-[15px] ${colorClass}`}
    />
  );
}

export function DetailBlockTypeControls({
  activeType,
  disabled = false,
  isTypeDisabled,
  onSelect,
  buttonClassName,
  activeButtonClassName = "text-[#2563eb] dark:text-blue-300",
  dividerClassName = "mx-0.5 h-5 w-px shrink-0 self-center bg-zinc-200 dark:bg-zinc-700",
  showLeadingDivider = true,
  showTrailingDivider = true,
}: DetailBlockTypeControlsProps) {
  return (
    <>
      {showLeadingDivider ? (
        <div aria-hidden="true" className={dividerClassName} />
      ) : null}

      {TEXT_BLOCK_OPTIONS.map((option) => {
        const active = activeType === option.type;
        const optionDisabled =
          disabled || (isTypeDisabled?.(option.type) ?? false);

        return (
          <button
            key={option.type}
            type="button"
            disabled={optionDisabled}
            aria-label={option.label}
            aria-pressed={active}
            title={option.label}
            className={`${buttonClassName} ${
              active
                ? activeButtonClassName
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            } ${optionDisabled ? "cursor-not-allowed opacity-40" : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(option.type)}
          >
            <BlockTypeIcon type={option.type} active={active} />
          </button>
        );
      })}

      {showTrailingDivider ? (
        <div aria-hidden="true" className={dividerClassName} />
      ) : null}
    </>
  );
}
