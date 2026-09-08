"use client";

import { useLayoutEffect, useRef } from "react";
import {
  DETAIL_LINE_HEIGHT_OPTIONS,
  type DetailLineHeightOption,
} from "./detail-line-height";
import {
  FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR,
  FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR,
} from "./detail-format-toolbar-menus";

const DETAIL_LINE_HEIGHT_LIST_CLASS =
  "min-w-[168px] overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900";

type DetailLineHeightControlProps = {
  value: DetailLineHeightOption;
  onSelect: (lineHeight: DetailLineHeightOption) => void;
  className?: string;
  open?: boolean;
};

function lineHeightsMatch(
  left: DetailLineHeightOption,
  right: DetailLineHeightOption,
) {
  return Math.abs(left - right) < 0.001;
}

function getLineHeightScrollTarget(
  value: DetailLineHeightOption,
): DetailLineHeightOption {
  const exactMatch = DETAIL_LINE_HEIGHT_OPTIONS.find((option) =>
    lineHeightsMatch(option, value),
  );
  if (exactMatch !== undefined) {
    return exactMatch;
  }

  return DETAIL_LINE_HEIGHT_OPTIONS.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest,
  );
}

function scrollLineHeightOptionToCenter(
  container: HTMLElement,
  option: DetailLineHeightOption,
) {
  const optionButton = container.querySelector<HTMLElement>(
    `[data-line-height-option="${option}"]`,
  );
  if (!optionButton) return;

  const scrollTop =
    optionButton.offsetTop -
    container.clientHeight / 2 +
    optionButton.offsetHeight / 2;

  container.scrollTop = Math.max(
    0,
    Math.min(scrollTop, container.scrollHeight - container.clientHeight),
  );
}

export function DetailLineHeightControl({
  value,
  onSelect,
  className = "",
  open = true,
}: DetailLineHeightControlProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const container = listRef.current;
    if (!container) return;

    scrollLineHeightOptionToCenter(
      container,
      getLineHeightScrollTarget(value),
    );
  }, [open, value]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Line height"
      className={`${DETAIL_LINE_HEIGHT_LIST_CLASS} max-h-40 py-1 ${className}`}
    >
      {DETAIL_LINE_HEIGHT_OPTIONS.map((option) => {
        const selected = lineHeightsMatch(option, value);

        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={selected}
            data-line-height-option={option}
            className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              selected
                ? `font-medium ${FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR}`
                : FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR
            }`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(option)}
          >
            <span>{option.toFixed(1)}</span>
          </button>
        );
      })}
    </div>
  );
}
