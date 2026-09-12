"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeHexColor } from "@/lib/sidebar-background-types";

type HsvColor = {
  h: number;
  s: number;
  v: number;
};

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexToHsv(hex: string): HsvColor {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 0 };

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      default:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number) {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const intermediate =
    chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const match = value - chroma;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = chroma;
    g = intermediate;
  } else if (h < 120) {
    r = intermediate;
    g = chroma;
  } else if (h < 180) {
    g = chroma;
    b = intermediate;
  } else if (h < 240) {
    g = intermediate;
    b = chroma;
  } else if (h < 300) {
    r = intermediate;
    b = chroma;
  } else {
    r = chroma;
    b = intermediate;
  }

  return rgbToHex((r + match) * 255, (g + match) * 255, (b + match) * 255);
}

function clampPopoverPosition(top: number, left: number, width: number, height: number) {
  const margin = 8;
  const maxLeft = window.innerWidth - width - margin;
  const maxTop = window.innerHeight - height - margin;

  return {
    top: Math.max(margin, Math.min(top, maxTop)),
    left: Math.max(margin, Math.min(left, maxLeft)),
  };
}

type TemplateHexColorPickerProps = {
  label: string;
  value: string;
  onChange: (color: string) => void;
};

export function TemplateHexColorPicker({
  label,
  value,
  onChange,
}: TemplateHexColorPickerProps) {
  const popoverId = useId();
  const [draft, setDraft] = useState(value);
  const [popoverDraft, setPopoverDraft] = useState(value);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(value));
  const swatchRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const svAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
    setPopoverDraft(value);
    setHsv(hexToHsv(value));
  }, [value]);

  useEffect(() => {
    if (!isPopoverOpen) return;

    const rect = swatchRef.current?.getBoundingClientRect();
    const popoverRect = popoverRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = popoverRect?.width ?? 220;
    const height = popoverRect?.height ?? 248;
    const nextPosition = clampPopoverPosition(
      rect.bottom + 8,
      rect.left,
      width,
      height,
    );
    setPopoverPosition(nextPosition);
  }, [isPopoverOpen]);

  useEffect(() => {
    if (!isPopoverOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (swatchRef.current?.contains(target)) return;
      setIsPopoverOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  function commitDraft() {
    const normalized = normalizeHexColor(draft);
    if (normalized) {
      onChange(normalized);
      setDraft(normalized);
      return;
    }

    setDraft(value);
  }

  function commitPopoverDraft() {
    const normalized = normalizeHexColor(popoverDraft);
    if (normalized) {
      onChange(normalized);
      setDraft(normalized);
      setPopoverDraft(normalized);
      setHsv(hexToHsv(normalized));
      return;
    }

    setPopoverDraft(value);
    setHsv(hexToHsv(value));
  }

  function applyHsv(next: HsvColor) {
    const hex = hsvToHex(next.h, next.s, next.v);
    setHsv(next);
    setDraft(hex);
    setPopoverDraft(hex);
    onChange(hex);
  }

  function updateSvFromPointer(clientX: number, clientY: number) {
    const area = svAreaRef.current;
    if (!area) return;

    const rect = area.getBoundingClientRect();
    const saturation = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    );
    const brightness = Math.max(
      0,
      Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100),
    );

    applyHsv({ h: hsv.h, s: saturation, v: brightness });
  }

  function handleSvPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    updateSvFromPointer(event.clientX, event.clientY);

    function handlePointerMove(moveEvent: PointerEvent) {
      updateSvFromPointer(moveEvent.clientX, moveEvent.clientY);
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function stopInteraction(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  const hueHex = hsvToHex(hsv.h, 100, 100);
  const popover =
    isPopoverOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            id={popoverId}
            data-template-color-popover
            role="dialog"
            aria-label={`${label} picker`}
            className="fixed z-[1200] w-[220px] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
            onClick={stopInteraction}
            onPointerDown={stopInteraction}
          >
            <div
              ref={svAreaRef}
              className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-lg"
              style={{ backgroundColor: hueHex }}
              onPointerDown={handleSvPointerDown}
            >
              <div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
              <div className="absolute inset-0 bg-linear-to-t from-black to-transparent" />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                style={{
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  backgroundColor: value,
                }}
              />
            </div>

            <input
              type="range"
              min={0}
              max={360}
              step={1}
              aria-label={`${label} hue`}
              value={Math.round(hsv.h)}
              onChange={(event) => {
                applyHsv({
                  ...hsv,
                  h: Number(event.target.value),
                });
              }}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
            />

            <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Hex
              <input
                type="text"
                data-template-color-input
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                aria-label={`${label} hex value`}
                value={popoverDraft}
                onChange={(event) => setPopoverDraft(event.target.value)}
                onBlur={commitPopoverDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitPopoverDraft();
                    return;
                  }

                  if (
                    (event.metaKey || event.ctrlKey) &&
                    (event.key.toLowerCase() === "z" ||
                      event.key.toLowerCase() === "y")
                  ) {
                    event.stopPropagation();
                  }
                }}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-xs lowercase text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
              />
            </label>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="flex shrink-0 items-center gap-1.5"
        onClick={stopInteraction}
        onPointerDown={stopInteraction}
      >
        <button
          ref={swatchRef}
          type="button"
          aria-label={`${label} (visual picker)`}
          aria-haspopup="dialog"
          aria-expanded={isPopoverOpen}
          aria-controls={isPopoverOpen ? popoverId : undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (isPopoverOpen) {
              setIsPopoverOpen(false);
              return;
            }
            setHsv(hexToHsv(value));
            setPopoverDraft(value);
            setIsPopoverOpen(true);
          }}
          className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-zinc-300 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-900"
        >
          <span
            aria-hidden="true"
            className="size-full rounded-[4px] border border-zinc-200 dark:border-zinc-700"
            style={{ backgroundColor: value }}
          />
        </button>
        <input
          type="text"
          data-template-color-input
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
              return;
            }

            if (
              (event.metaKey || event.ctrlKey) &&
              (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
            ) {
              event.stopPropagation();
            }
          }}
          className="w-[4.75rem] rounded-md border border-zinc-300 bg-white px-1.5 py-1 font-mono text-xs lowercase text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
      </div>
      {popover}
    </>
  );
}
