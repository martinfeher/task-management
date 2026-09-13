"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LuX } from "react-icons/lu";
import { useImportantEnabled } from "@/lib/important-settings";
import { useListPreviewEnabled } from "@/lib/list-preview-settings";
import { useSubtasksEnabled } from "@/lib/subtasks-settings";
import {
  TASK_EDITOR_FONT_SIZE_MAX_PX,
  TASK_EDITOR_FONT_SIZE_MIN_PX,
  TASK_EDITOR_LINE_HEIGHT_MAX,
  TASK_EDITOR_LINE_HEIGHT_MIN,
  TASK_EDITOR_LINE_HEIGHT_STEP,
  useTaskEditorDefaults,
} from "@/lib/task-editor-defaults-settings";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";

type SettingsSection = "general" | "tasks" | "labels" | "calendar";

type SettingsModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  onClose: () => void;
};

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "tasks", label: "Tasks" },
  { id: "labels", label: "Labels" },
  { id: "calendar", label: "Calendar" },
];

function getDefaultSettingsRevealOrigin() {
  return {
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.12 : 0,
  };
}

function getSettingsSectionNavClassName(isSelected: boolean) {
  return `flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors cursor-pointer ${
    isSelected
      ? "bg-zinc-200/70 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
  }`;
}

function SettingsToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex items-center gap-8">
      <label
        htmlFor={id}
        className="text-sm text-zinc-900 dark:text-zinc-50"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-[#6bd29d]" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-4 rounded-full bg-white transition-transform dark:bg-zinc-900 ${
            checked ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function GeneralSettingsContent() {
  const { importantEnabled, setImportantEnabled } = useImportantEnabled();
  const { listPreviewEnabled, setListPreviewEnabled } = useListPreviewEnabled();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          General
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          General app preferences.
        </p>
      </div>
      <SettingsToggle
        label="Enable Important"
        checked={importantEnabled}
        onChange={setImportantEnabled}
      />
      <SettingsToggle
        label="List preview"
        checked={listPreviewEnabled}
        onChange={setListPreviewEnabled}
      />
    </div>
  );
}

function SettingsNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const [draft, setDraft] = useState(String(value));

  function commitDraft() {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const clamped = Math.min(max, Math.max(min, parsed));
    const stepped =
      step === 1
        ? Math.round(clamped)
        : Number(
            (Math.round(clamped / step) * step).toFixed(
              String(step).includes(".") ? String(step).split(".")[1].length : 0,
            ),
          );

    onChange(stepped);
    setDraft(String(stepped));
  }

  return (
    <div className="flex items-center justify-between gap-8">
      <label
        htmlFor={id}
        className="text-sm text-zinc-900 dark:text-zinc-50"
      >
        {label}
      </label>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          inputMode="decimal"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          className="w-[4.75rem] rounded-md border border-zinc-300 bg-white px-1.5 py-1 font-mono text-xs text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
        {unit ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{unit}</span>
        ) : null}
      </div>
    </div>
  );
}

function SettingsColorOptions({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-zinc-900 dark:text-zinc-50">{label}</p>
      <div className="grid max-w-[11.5rem] grid-cols-4 gap-2">
        {options.map((color) => {
          const isSelected = value === color;
          return (
            <button
              key={color}
              type="button"
              aria-label={`Set calendar task default color ${color}`}
              aria-pressed={isSelected}
              className={`size-6 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/15 ${
                isSelected
                  ? "ring-2 ring-zinc-800 ring-offset-2 dark:ring-zinc-100 dark:ring-offset-zinc-900"
                  : ""
              }`}
              style={{ backgroundColor: color }}
              onClick={() => onChange(color)}
            />
          );
        })}
      </div>
    </div>
  );
}

function CalendarSettingsContent() {
  const { defaultColor, setDefaultColor, colorOptions } =
    useCalendarTaskDefaultColor();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Calendar
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Calendar view preferences.
        </p>
      </div>
      <SettingsColorOptions
        label="Calendar task default color"
        value={defaultColor}
        options={colorOptions}
        onChange={setDefaultColor}
      />
    </div>
  );
}

function TasksSettingsContent() {
  const { subtasksEnabled, setSubtasksEnabled } = useSubtasksEnabled();
  const {
    defaultFontSizePx,
    defaultLineHeight,
    setDefaultFontSizePx,
    setDefaultLineHeight,
  } = useTaskEditorDefaults();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Tasks
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Task-related preferences.
        </p>
      </div>
      <SettingsToggle
        label="Sub-tasks"
        checked={subtasksEnabled}
        onChange={setSubtasksEnabled}
      />
      <SettingsNumberField
        key={`default-font-size-${defaultFontSizePx}`}
        label="Default font size"
        value={defaultFontSizePx}
        min={TASK_EDITOR_FONT_SIZE_MIN_PX}
        max={TASK_EDITOR_FONT_SIZE_MAX_PX}
        step={1}
        unit="px"
        onChange={setDefaultFontSizePx}
      />
      <SettingsNumberField
        key={`default-line-height-${defaultLineHeight}`}
        label="Default line height"
        value={defaultLineHeight}
        min={TASK_EDITOR_LINE_HEIGHT_MIN}
        max={TASK_EDITOR_LINE_HEIGHT_MAX}
        step={TASK_EDITOR_LINE_HEIGHT_STEP}
        onChange={setDefaultLineHeight}
      />
    </div>
  );
}

function SettingsSectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "general":
      return <GeneralSettingsContent />;
    case "tasks":
      return <TasksSettingsContent />;
    case "labels":
      return (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Labels
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Label settings will appear here.
          </p>
        </div>
      );
    case "calendar":
      return <CalendarSettingsContent />;
  }
}

export function SettingsModal({
  open,
  revealOrigin = null,
  onClose,
}: SettingsModalProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isEntered, setIsEntered] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");

  useEffect(() => {
    if (open) {
      setActiveSection("general");
      setIsMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setIsEntered(true);
        });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setIsEntered(false);
    setIsMounted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!isMounted) return null;

  const origin = revealOrigin ?? getDefaultSettingsRevealOrigin();
  const revealStyle = {
    "--search-reveal-x": `${origin.x}px`,
    "--search-reveal-y": `${origin.y}px`,
  } as CSSProperties;

  return (
    <div
      className={`search-modal-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-[8vh] ${
        isMounted ? "is-visible" : ""
      }`}
      style={revealStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={`search-modal-panel flex max-h-[min(75vh,600px)] w-full max-w-4xl flex-col overflow-hidden bg-white dark:bg-zinc-900 ${
          isEntered ? "is-entered" : ""
        }`}
        style={revealStyle}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2
            id="settings-modal-title"
            className="text-[16px] font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <LuX className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="search-modal-body min-h-0 flex-1">
          <div className="search-modal-body-inner flex min-h-0">
            <nav
              aria-label="Settings sections"
              className="flex w-[20%] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-zinc-200 px-2 py-3 dark:border-zinc-800"
            >
              {SETTINGS_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  aria-current={
                    activeSection === section.id ? "page" : undefined
                  }
                  onClick={() => setActiveSection(section.id)}
                  className={getSettingsSectionNavClassName(
                    activeSection === section.id,
                  )}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4">
              <SettingsSectionContent section={activeSection} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
