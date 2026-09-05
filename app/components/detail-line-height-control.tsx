"use client";

import {
  DETAIL_LINE_HEIGHT_OPTIONS,
  type DetailLineHeightOption,
} from "./detail-line-height";
import {
  FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS,
  FORMAT_TOOLBAR_FONT_SIZE_SELECTED_COLOR,
  FORMAT_TOOLBAR_TRIGGER_LABEL_COLOR,
} from "./detail-format-toolbar-menus";

type DetailLineHeightControlProps = {
  value: DetailLineHeightOption;
  onSelect: (lineHeight: DetailLineHeightOption) => void;
  className?: string;
};

function lineHeightsMatch(
  left: DetailLineHeightOption,
  right: DetailLineHeightOption,
) {
  return Math.abs(left - right) < 0.001;
}

export function DetailLineHeightControl({
  value,
  onSelect,
  className = "",
}: DetailLineHeightControlProps) {
  return (
    <div
      role="listbox"
      aria-label="Line height"
      className={`${FORMAT_TOOLBAR_DROPDOWN_MENU_CLASS} max-h-56 overflow-y-auto py-1 ${className}`}
    >
      {DETAIL_LINE_HEIGHT_OPTIONS.map((option) => {
        const selected = lineHeightsMatch(option, value);

        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={selected}
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
