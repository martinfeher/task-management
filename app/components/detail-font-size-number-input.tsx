"use client";

import { useEffect, useState } from "react";
import {
  MAX_DETAIL_FONT_SIZE_PX,
  MIN_DETAIL_FONT_SIZE_PX,
  clampDetailFontSizeInput,
  type DetailFontSizeOption,
} from "./detail-fonts";

const DETAIL_FONT_SIZE_NUMBER_INPUT_CLASS =
  "h-7 w-full min-w-[2.5rem] rounded-md border-0 bg-zinc-100 px-1 tabular-nums text-center text-[12px] font-medium outline-none focus:ring-2 focus:ring-emerald-600/40 dark:bg-zinc-800 text-[#3d3d3f] dark:text-[#f5f5f6]";

type DetailFontSizeNumberInputProps = {
  value: DetailFontSizeOption;
  className?: string;
  onCommit: (size: DetailFontSizeOption) => void;
  onPreview?: (size: DetailFontSizeOption) => void;
  onFocus?: () => void;
};

export function DetailFontSizeNumberInput({
  value,
  className = DETAIL_FONT_SIZE_NUMBER_INPUT_CLASS,
  onCommit,
  onPreview,
  onFocus,
}: DetailFontSizeNumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft(raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const next = clampDetailFontSizeInput(parsed);
    setDraft(String(next));
    onCommit(next);
  }

  return (
    <input
      type="number"
      min={MIN_DETAIL_FONT_SIZE_PX}
      max={MAX_DETAIL_FONT_SIZE_PX}
      step={1}
      inputMode="numeric"
      aria-label="Font size"
      value={draft}
      className={className}
      onMouseDown={(event) => event.preventDefault()}
      onFocus={() => onFocus?.()}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) {
          onPreview?.(clampDetailFontSizeInput(parsed));
        }
      }}
      onBlur={() => commitDraft(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft(draft);
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}