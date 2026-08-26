"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BiCheck, BiSearch } from "react-icons/bi";
import { IoPricetagsOutline } from "react-icons/io5";
import { LuPlus, LuX } from "react-icons/lu";
import {
  getLabelColor,
  getLabelPillClassName,
  getLabelPillStyle,
  LABEL_PRESET_COLORS,
  normalizeLabelColorHex,
} from "@/lib/label-colors";

export type Label = {
  id: string;
  label: string;
  color?: string | null;
};

type TaskLabelSelectorProps = {
  labels: Label[];
  assignedLabelIds: string[];
  query: string;
  isSubmitting?: boolean;
  onQueryChange: (value: string) => void;
  onToggleLabel: (labelId: string) => void;
  onCreateLabel: (label: string, color: string) => void;
  onCancel: () => void;
};

function hasExactLabelMatch(labels: Label[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  return labels.some((item) => item.label.toLowerCase() === normalized);
}

type NavigableLabelItem =
  | { type: "create" }
  | { type: "label"; label: Label };

type LabelCreateColorPickerProps = {
  color: string;
  labelName: string;
  disabled?: boolean;
  onChange: (color: string) => void;
};

function LabelCreateColorPicker({
  color,
  labelName,
  disabled = false,
  onChange,
}: LabelCreateColorPickerProps) {
  const [showPresets, setShowPresets] = useState(false);

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => setShowPresets(true)}
      onMouseLeave={() => setShowPresets(false)}
    >
      <label className="relative flex size-5 cursor-pointer items-center justify-center rounded-full border border-zinc-200 p-0.5 dark:border-zinc-600">
        <span
          aria-hidden="true"
          className="size-full rounded-full"
          style={{ backgroundColor: color }}
        />
        <input
          type="color"
          aria-label={`Pick color for ${labelName}`}
          value={normalizeLabelColorHex(color)}
          disabled={disabled}
          onChange={(event) => {
            event.stopPropagation();
            onChange(event.target.value);
          }}
          onClick={(event) => event.stopPropagation()}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
      </label>

      {showPresets ? (
        <div className="absolute left-0 top-full z-10 mt-1 flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {LABEL_PRESET_COLORS.map((preset) => (
            <button
              key={preset.dot}
              type="button"
              aria-label={`Set label color ${preset.dot}`}
              disabled={disabled}
              className="size-5 rounded-full border border-zinc-200 transition-transform hover:scale-110 disabled:opacity-50 dark:border-zinc-600"
              style={{ backgroundColor: preset.dot }}
              onClick={(event) => {
                event.stopPropagation();
                onChange(preset.dot);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TaskLabelSelector({
  labels,
  assignedLabelIds,
  query,
  isSubmitting = false,
  onQueryChange,
  onToggleLabel,
  onCreateLabel,
  onCancel,
}: TaskLabelSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const trimmedQuery = query.trim();
  const [createLabelColor, setCreateLabelColor] = useState(
    LABEL_PRESET_COLORS[0].dot,
  );
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const assignedLabels = useMemo(
    () => labels.filter((item) => assignedLabelIds.includes(item.id)),
    [assignedLabelIds, labels],
  );

  const filteredLabels = useMemo(() => {
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return labels;

    return labels.filter((item) =>
      item.label.toLowerCase().includes(normalized),
    );
  }, [labels, trimmedQuery]);

  const showCreateLabel =
    trimmedQuery.length > 0 && !hasExactLabelMatch(labels, trimmedQuery);
  const navigableItems = useMemo<NavigableLabelItem[]>(() => {
    const items: NavigableLabelItem[] = [];
    if (showCreateLabel) {
      items.push({ type: "create" });
    }
    filteredLabels.forEach((label) => {
      items.push({ type: "label", label });
    });
    return items;
  }, [filteredLabels, showCreateLabel]);
  const wasCreatingLabelRef = useRef(false);

  useEffect(() => {
    if (activeIndex < 0) return;
    const highlightedIndex =
      navigableItems.length === 0
        ? -1
        : Math.min(activeIndex, navigableItems.length - 1);
    if (highlightedIndex < 0) return;
    itemRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, navigableItems.length]);

  const highlightedIndex =
    activeIndex < 0 || navigableItems.length === 0
      ? -1
      : Math.min(activeIndex, navigableItems.length - 1);

  useEffect(() => {
    if (!showCreateLabel) {
      setCreateLabelColor(LABEL_PRESET_COLORS[0].dot);
      wasCreatingLabelRef.current = false;
      return;
    }

    if (!wasCreatingLabelRef.current) {
      setCreateLabelColor(
        getLabelColor({ id: trimmedQuery, label: trimmedQuery }).dot,
      );
    }

    wasCreatingLabelRef.current = true;
  }, [showCreateLabel, trimmedQuery]);

  function handleCreateLabel() {
    onCreateLabel(trimmedQuery, createLabelColor);
  }

  function activateNavigableItem(index: number) {
    const item = navigableItems[index];
    if (!item) return;

    if (item.type === "create") {
      handleCreateLabel();
      return;
    }

    onToggleLabel(item.label.id);
  }

  function moveActiveIndex(delta: number) {
    if (navigableItems.length === 0) return;

    setActiveIndex((current) => {
      if (current === -1 && delta > 0) return 0;
      if (current === -1 && delta < 0) return -1;
      return Math.max(-1, Math.min(current + delta, navigableItems.length - 1));
    });
  }

  function getNavigableItemClassName(isActive: boolean, extra = "") {
    return `${extra} ${
      isActive
        ? "bg-zinc-100 dark:bg-zinc-800"
        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
    }`;
  }

  return (
    <div
      role="dialog"
      aria-label="Add label"
      className="w-[220px] overflow-hidden rounded-3xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        {assignedLabels.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {assignedLabels.map((item) => {
              const palette = getLabelColor(item);

              return (
              <span
                key={item.id}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getLabelPillClassName(palette)}`}
                style={getLabelPillStyle(palette)}
              >
                {item.label}
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  disabled={isSubmitting}
                  onClick={() => onToggleLabel(item.id)}
                  className="rounded-full p-0.5 transition-colors hover:bg-black/5 disabled:opacity-50 -mr-[5px]! cursor-pointer"
                >
                  <LuX className="size-3" />
                </button>
              </span>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          {showCreateLabel ? (
            <LabelCreateColorPicker
              color={createLabelColor}
              labelName={trimmedQuery}
              disabled={isSubmitting}
              onChange={setCreateLabelColor}
            />
          ) : (
            <BiSearch className="size-4 shrink-0 text-[#6f6f6f]" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setActiveIndex(-1);
              onQueryChange(event.target.value);
            }}
            placeholder="Type in a label"
            aria-label="Type in a label"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                if (navigableItems.length > 0) {
                  event.preventDefault();
                  moveActiveIndex(1);
                }
                return;
              }

              if (event.key === "ArrowUp") {
                if (navigableItems.length > 0) {
                  event.preventDefault();
                  moveActiveIndex(-1);
                }
                return;
              }

              if (event.key === "Enter" && !isSubmitting) {
                event.preventDefault();
                if (highlightedIndex >= 0) {
                  activateNavigableItem(highlightedIndex);
                  return;
                }
                if (showCreateLabel) {
                  handleCreateLabel();
                }
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      </div>

      <div
        className="max-h-[220px] overflow-y-auto py-1"
        role="listbox"
        aria-label="Labels"
        aria-activedescendant={
          highlightedIndex >= 0 ? `label-option-${highlightedIndex}` : undefined
        }
      >
        {navigableItems.length === 0 && !showCreateLabel ? (
          <p className="px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
            {trimmedQuery ? "No matching labels" : "No labels yet"}
          </p>
        ) : (
          navigableItems.map((item, index) => {
            const isActive = highlightedIndex === index;

            if (item.type === "create") {
              return (
                <button
                  key="create-label"
                  id={`label-option-${index}`}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={isSubmitting}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={handleCreateLabel}
                  className={getNavigableItemClassName(
                    isActive,
                    "flex min-h-[38px] w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-zinc-800 transition-colors disabled:opacity-50 dark:text-zinc-100",
                  )}
                >
                  <span className="relative flex size-4 shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400">
                    <IoPricetagsOutline className="size-4" />
                    <LuPlus className="absolute -right-1 -top-1 size-2.5 rounded-full bg-white dark:bg-zinc-900" />
                  </span>
                  <span className="truncate">
                    Create label &quot;{trimmedQuery}&quot;
                  </span>
                </button>
              );
            }

            const isAssigned = assignedLabelIds.includes(item.label.id);
            const palette = getLabelColor(item.label);

            return (
              <button
                key={item.label.id}
                id={`label-option-${index}`}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={isActive || isAssigned}
                disabled={isSubmitting}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onToggleLabel(item.label.id)}
                className={getNavigableItemClassName(
                  isActive,
                  `flex h-[38px] w-full items-center gap-2.5 px-4 text-left text-sm transition-colors cursor-pointer disabled:opacity-50 ${
                    isAssigned
                      ? `${palette.textClass || ""} ${
                          isActive
                            ? ""
                            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                        }`
                      : "text-zinc-800 dark:text-zinc-100"
                  }`,
                )}
                style={
                  isAssigned && !palette.textClass
                    ? { color: palette.text }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: palette.dot }}
                />
                <span className="min-w-0 flex-1 truncate">{item.label.label}</span>
                {isAssigned ? (
                  <BiCheck
                    className={`size-4 shrink-0 ${palette.textClass || ""}`}
                    style={
                      !palette.textClass ? { color: palette.text } : undefined
                    }
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
