"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LuLayoutTemplate } from "react-icons/lu";
import {
  CALENDAR_TASK_BACKGROUND_OPTIONS,
  getCalendarTaskBackgroundPresentation,
  useCalendarTaskBackground,
} from "@/lib/calendar-task-background";
import {
  getSidebarBackgroundPresentation,
  SIDEBAR_BACKGROUND_OPTIONS,
  useSidebarBackground,
} from "@/lib/sidebar-background";
import {
  getTaskListBackgroundPresentation,
  TASK_LIST_BACKGROUND_OPTIONS,
  useTaskListBackground,
} from "@/lib/task-list-background";
import {
  PANEL_TEXT_ELEMENT_GROUPS,
  PANEL_TEXT_ELEMENT_LABELS,
  PANEL_TEXT_SHADE_DROPDOWN_OPTIONS,
  usePanelTextColors,
  type PanelTextElementKey,
  type PanelTextShadeToken,
} from "@/lib/panel-text-shade";
import {
  MAX_TOOLTIP_CORNER_RADIUS_PX,
  MIN_TOOLTIP_CORNER_RADIUS_PX,
  useTooltipSettings,
} from "@/lib/tooltip-settings";
import { TemplateHexColorPicker } from "./template-hex-color-picker";
import { TemplateStylesSection } from "./template-styles-section";
import {
  areTemplateSettingsSnapshotsEqual,
  cloneTemplateSettingsSnapshot,
  type TemplateSettingsSnapshot,
} from "@/lib/template-settings-history";

const DRAWER_WIDTH_CLASS = "w-[280px]";

type TemplateSettingsControllers = {
  panelTextColors: ReturnType<typeof usePanelTextColors>;
  sidebar: ReturnType<typeof useSidebarBackground>;
  taskList: ReturnType<typeof useTaskListBackground>;
  calendarTask: ReturnType<typeof useCalendarTaskBackground>;
  tooltip: ReturnType<typeof useTooltipSettings>;
};

function captureTemplateSettingsSnapshot(
  controllers: TemplateSettingsControllers,
): TemplateSettingsSnapshot {
  return {
    panelTextColors: controllers.panelTextColors.settings,
    sidebar: controllers.sidebar.currentSettings,
    taskList: controllers.taskList.currentSettings,
    calendarTask: controllers.calendarTask.currentSettings,
    tooltip: controllers.tooltip.currentSettings,
  };
}

function applyTemplateSettingsSnapshot(
  snapshot: TemplateSettingsSnapshot,
  controllers: TemplateSettingsControllers,
) {
  controllers.panelTextColors.replaceSettings(snapshot.panelTextColors);
  controllers.sidebar.replaceSettings(snapshot.sidebar);
  controllers.taskList.replaceSettings(snapshot.taskList);
  controllers.calendarTask.replaceSettings(snapshot.calendarTask);
  controllers.tooltip.replaceSettings(snapshot.tooltip);
}

function areTemplateSettingsLoading(controllers: TemplateSettingsControllers) {
  return (
    controllers.panelTextColors.isLoading ||
    controllers.sidebar.isLoading ||
    controllers.taskList.isLoading ||
    controllers.calendarTask.isLoading ||
    controllers.tooltip.isLoading
  );
}

function isTemplateSettingsShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.closest("[data-template-options-drawer]") !== null ||
    target.closest("[data-template-color-popover]") !== null
  );
}

function isTemplateStyleNameInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    target.matches("[data-template-style-name-input]")
  );
}

function TemplateCornerRadiusInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const clamped = Math.max(
      MIN_TOOLTIP_CORNER_RADIUS_PX,
      Math.min(MAX_TOOLTIP_CORNER_RADIUS_PX, parsed),
    );
    onChange(clamped);
    setDraft(String(clamped));
  }

  function stopInteraction(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      onClick={stopInteraction}
      onPointerDown={stopInteraction}
    >
      <input
        type="number"
        min={MIN_TOOLTIP_CORNER_RADIUS_PX}
        max={MAX_TOOLTIP_CORNER_RADIUS_PX}
        step={1}
        inputMode="numeric"
        aria-label={label}
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
      <span className="text-xs text-zinc-500 dark:text-zinc-400">px</span>
    </div>
  );
}

type BackgroundOption = {
  id: string;
  label: string;
  usesBaseColor: boolean;
  usesEndColor?: boolean;
};

function PanelTextColorControl({
  label,
  shade,
  color,
  onShadeChange,
  onColorChange,
}: {
  label: string;
  shade: string;
  color: string;
  onShadeChange: (shade: string) => void;
  onColorChange: (color: string) => void;
}) {
  function stopInteraction(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  return (
    <div
      className="space-y-1.5 py-2"
      onClick={stopInteraction}
      onPointerDown={stopInteraction}
    >
      <span className="block text-sm text-zinc-800 dark:text-zinc-100">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <select
          aria-label={`${label} shade`}
          value={shade}
          onChange={(event) => onShadeChange(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-1.5 py-1 text-xs text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        >
          {PANEL_TEXT_SHADE_DROPDOWN_OPTIONS.map((group) => (
            <optgroup key={group.palette} label={group.label}>
              {group.tokens.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <TemplateHexColorPicker
          label={`${label} color`}
          value={color}
          onChange={onColorChange}
        />
      </div>
    </div>
  );
}

function BackgroundOptionList<T extends string>({
  options,
  selectedId,
  baseColor,
  endColor,
  getPresentation,
  onSelect,
  onBaseColorChange,
  onEndColorChange,
  startColorLabel = "Start color",
  endColorLabel = "End color",
  colorPickerLabelPrefix,
}: {
  options: BackgroundOption[];
  selectedId: T;
  baseColor: string;
  endColor?: string;
  getPresentation: (
    id: T,
    baseColor: string,
    endColor?: string,
  ) => {
    className?: string;
    style?: { background?: string };
  };
  onSelect: (id: T) => void;
  onBaseColorChange: (color: string) => void;
  onEndColorChange?: (color: string) => void;
  startColorLabel?: string;
  endColorLabel?: string;
  colorPickerLabelPrefix?: string;
}) {
  return (
    <ul className="space-y-2">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const preview = getPresentation(
          option.id as T,
          baseColor,
          endColor,
        );

        return (
          <li key={option.id}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              onClick={() => onSelect(option.id as T)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(option.id as T);
              }}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
                  : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              <div className="mb-2 flex items-start gap-2">
                <div
                  aria-hidden="true"
                  className={`h-10 min-w-0 flex-1 rounded-md border border-zinc-200 ${preview.className ?? ""}`}
                  style={preview.style}
                />
                {option.usesBaseColor || option.usesEndColor ? (
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {option.usesBaseColor ? (
                      <TemplateHexColorPicker
                        label={
                          colorPickerLabelPrefix
                            ? `${colorPickerLabelPrefix} ${option.label}`
                            : `${startColorLabel} for ${option.label}`
                        }
                        value={baseColor}
                        onChange={(color) => {
                          onBaseColorChange(color);
                          if (!isSelected) {
                            onSelect(option.id as T);
                          }
                        }}
                      />
                    ) : null}
                    {option.usesEndColor && endColor && onEndColorChange ? (
                      <TemplateHexColorPicker
                        label={`${endColorLabel} for ${option.label}`}
                        value={endColor}
                        onChange={(color) => {
                          onEndColorChange(color);
                          if (!isSelected) {
                            onSelect(option.id as T);
                          }
                        }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {option.label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TemplateOptionsDrawer() {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const sidebar = useSidebarBackground();
  const taskList = useTaskListBackground();
  const calendarTask = useCalendarTaskBackground();
  const tooltip = useTooltipSettings();
  const panelTextColors = usePanelTextColors();
  const settingsControllers = {
    panelTextColors,
    sidebar,
    taskList,
    calendarTask,
    tooltip,
  };
  const historyRef = useRef<TemplateSettingsSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const isApplyingHistoryRef = useRef(false);
  const historyInitializedRef = useRef(false);

  const isDirty =
    sidebar.isDirty ||
    taskList.isDirty ||
    calendarTask.isDirty ||
    tooltip.isDirty ||
    panelTextColors.isDirty;
  const isSaving =
    sidebar.isSaving ||
    taskList.isSaving ||
    calendarTask.isSaving ||
    tooltip.isSaving ||
    panelTextColors.isSaving;
  const saveError =
    sidebar.saveError ??
    taskList.saveError ??
    calendarTask.saveError ??
    tooltip.saveError ??
    panelTextColors.saveError;
  const saveSuccess =
    sidebar.saveSuccess ||
    taskList.saveSuccess ||
    calendarTask.saveSuccess ||
    tooltip.saveSuccess ||
    panelTextColors.saveSuccess;

  const applySnapshot = useCallback(
    (snapshot: TemplateSettingsSnapshot) => {
      isApplyingHistoryRef.current = true;
      panelTextColors.replaceSettings(snapshot.panelTextColors);
      sidebar.replaceSettings(snapshot.sidebar);
      taskList.replaceSettings(snapshot.taskList);
      calendarTask.replaceSettings(snapshot.calendarTask);
      tooltip.replaceSettings(snapshot.tooltip);
      requestAnimationFrame(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [
      calendarTask.replaceSettings,
      panelTextColors.replaceSettings,
      sidebar.replaceSettings,
      taskList.replaceSettings,
      tooltip.replaceSettings,
    ],
  );

  const undoTemplateSettings = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    historyIndexRef.current -= 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;

    applySnapshot(snapshot);
  }, [applySnapshot]);

  const redoTemplateSettings = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    historyIndexRef.current += 1;
    const snapshot = historyRef.current[historyIndexRef.current];
    if (!snapshot) return;

    applySnapshot(snapshot);
  }, [applySnapshot]);

  useEffect(() => {
    if (!open) {
      historyInitializedRef.current = false;
      return;
    }

    if (areTemplateSettingsLoading(settingsControllers)) return;

    if (!historyInitializedRef.current) {
      const initial = cloneTemplateSettingsSnapshot(
        captureTemplateSettingsSnapshot(settingsControllers),
      );
      historyRef.current = [initial];
      historyIndexRef.current = 0;
      historyInitializedRef.current = true;
    }
  }, [
    open,
    panelTextColors.isLoading,
    sidebar.isLoading,
    taskList.isLoading,
    calendarTask.isLoading,
    tooltip.isLoading,
  ]);

  useEffect(() => {
    if (!open || !historyInitializedRef.current || isApplyingHistoryRef.current) {
      return;
    }

    if (areTemplateSettingsLoading(settingsControllers)) return;

    const snapshot = cloneTemplateSettingsSnapshot(
      captureTemplateSettingsSnapshot(settingsControllers),
    );
    const history = historyRef.current;
    const index = historyIndexRef.current;
    const current = history[index];

    if (current && areTemplateSettingsSnapshotsEqual(current, snapshot)) {
      return;
    }

    historyRef.current = [...history.slice(0, index + 1), snapshot];
    historyIndexRef.current = historyRef.current.length - 1;
  }, [
    open,
    panelTextColors.settings,
    sidebar.currentSettings,
    taskList.currentSettings,
    calendarTask.currentSettings,
    tooltip.currentSettings,
    panelTextColors.isLoading,
    sidebar.isLoading,
    taskList.isLoading,
    calendarTask.isLoading,
    tooltip.isLoading,
  ]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (!isTemplateSettingsShortcutTarget(event.target)) return;

      if (isTemplateStyleNameInput(event.target)) return;

      if (!(event.metaKey || event.ctrlKey)) return;

      const key = event.key.toLowerCase();

      if (key === "z" && !event.shiftKey) {
        if (historyIndexRef.current <= 0) return;
        event.preventDefault();
        event.stopPropagation();
        undoTemplateSettings();
        return;
      }

      if (key === "y" || (key === "z" && event.shiftKey)) {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        event.preventDefault();
        event.stopPropagation();
        redoTemplateSettings();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, redoTemplateSettings, undoTemplateSettings]);

  async function handleSave() {
    if (sidebar.isDirty) {
      await sidebar.saveSettings();
    }
    if (taskList.isDirty) {
      await taskList.saveSettings();
    }
    if (calendarTask.isDirty) {
      await calendarTask.saveSettings();
    }
    if (tooltip.isDirty) {
      await tooltip.saveSettings();
    }
    if (panelTextColors.isDirty) {
      await panelTextColors.saveSettings();
    }
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close template settings panel"
          className="fixed inset-0 z-40 cursor-default bg-transparent"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        id={drawerId}
        data-template-options-drawer
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 flex h-dvh ${DRAWER_WIDTH_CLASS} flex-col border-l border-zinc-200 bg-white shadow-xl transition-transform duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Template settings
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Panel text colors
            </h3>
            <p className="mb-2 px-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              Choose a Tailwind zinc, slate, or gray shade (50-step increments)
              or pick a custom hex color for each text, divider, and surface
              element.
            </p>
            <div className="space-y-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
              {PANEL_TEXT_ELEMENT_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="mb-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    {group.title}
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {group.keys.map((key) => (
                      <PanelTextColorControl
                        key={key}
                        label={PANEL_TEXT_ELEMENT_LABELS[key as PanelTextElementKey]}
                        shade={panelTextColors.settings[key as PanelTextElementKey].shade}
                        color={panelTextColors.settings[key as PanelTextElementKey].color}
                        onShadeChange={(shade) =>
                          panelTextColors.setElementShade(
                            key as PanelTextElementKey,
                            shade as PanelTextShadeToken,
                          )
                        }
                        onColorChange={(color) =>
                          panelTextColors.setElementColor(
                            key as PanelTextElementKey,
                            color,
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Sidebar background
            </h3>
            <BackgroundOptionList
              options={SIDEBAR_BACKGROUND_OPTIONS}
              selectedId={sidebar.backgroundId}
              baseColor={sidebar.baseColor}
              getPresentation={getSidebarBackgroundPresentation}
              onSelect={sidebar.setBackgroundId}
              onBaseColorChange={sidebar.setBaseColor}
              colorPickerLabelPrefix="Base color for"
            />
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Task list background
            </h3>
            <BackgroundOptionList
              options={TASK_LIST_BACKGROUND_OPTIONS}
              selectedId={taskList.backgroundId}
              baseColor={taskList.baseColor}
              getPresentation={getTaskListBackgroundPresentation}
              onSelect={taskList.setBackgroundId}
              onBaseColorChange={taskList.setBaseColor}
              colorPickerLabelPrefix="Base color for"
            />
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Calendar task background
            </h3>
            <BackgroundOptionList
              options={CALENDAR_TASK_BACKGROUND_OPTIONS}
              selectedId={calendarTask.backgroundId}
              baseColor={calendarTask.baseColor}
              endColor={calendarTask.endColor}
              getPresentation={(id, color, gradientEndColor) => ({
                style: {
                  background: getCalendarTaskBackgroundPresentation(
                    id,
                    color,
                    gradientEndColor,
                  ).background,
                },
              })}
              onSelect={calendarTask.setBackgroundId}
              onBaseColorChange={calendarTask.setBaseColor}
              onEndColorChange={calendarTask.setEndColor}
              startColorLabel="Start color"
              endColorLabel="End color"
            />
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Calendar task text
            </h3>
            <div className="space-y-2 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Title color
                </span>
                <TemplateHexColorPicker
                  label="Calendar task title color"
                  value={calendarTask.titleColor}
                  onChange={calendarTask.setTitleColor}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Time color
                </span>
                <TemplateHexColorPicker
                  label="Calendar task time color"
                  value={calendarTask.timeColor}
                  onChange={calendarTask.setTimeColor}
                />
              </div>
              <div
                aria-hidden="true"
                className="rounded-md border border-zinc-200 px-2 py-1.5"
                style={{
                  background: calendarTask.presentation.background,
                  color: calendarTask.titleColor,
                }}
              >
                <div className="text-[12.5px] font-medium">Task title preview</div>
                <div
                  className="text-[11px]"
                  style={{ color: calendarTask.timeColor }}
                >
                  9:00 – 10:00
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Tooltips
            </h3>
            <div className="space-y-2 rounded-lg border border-zinc-200 px-3 py-3 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Background color
                </span>
                <TemplateHexColorPicker
                  label="Tooltip background color"
                  value={tooltip.backgroundColor}
                  onChange={tooltip.setBackgroundColor}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Text color
                </span>
                <TemplateHexColorPicker
                  label="Tooltip text color"
                  value={tooltip.textColor}
                  onChange={tooltip.setTextColor}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  Corner radius
                </span>
                <TemplateCornerRadiusInput
                  label="Tooltip corner radius in pixels"
                  value={tooltip.cornerRadiusPx}
                  onChange={tooltip.setCornerRadius}
                />
              </div>
              <div className="flex justify-center pt-1">
                <div
                  aria-hidden="true"
                  className="add-task-date-tooltip relative px-3 py-1.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: tooltip.backgroundColor,
                    color: tooltip.textColor,
                    borderRadius: `${tooltip.cornerRadiusPx}px`,
                  }}
                >
                  Tooltip preview
                </div>
              </div>
            </div>
          </section>

          <TemplateStylesSection sidebar={sidebar} calendarTask={calendarTask} />
        </div>

        <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
          {saveError ? (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
              Settings saved.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isDirty || isSaving}
            className="w-full rounded-lg bg-[#4873c7] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#3f68bd] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </aside>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={drawerId}
        aria-label={open ? "Close template settings" : "Open template settings"}
        onClick={() => setOpen((previous) => !previous)}
        className={`fixed top-0 right-0 z-[60] flex size-8 items-center justify-center rounded-md transition-colors ${
          open
            ? "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            : "text-zinc-400/80 hover:bg-zinc-100/80 hover:text-zinc-600 dark:text-zinc-500/80 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-300"
        }`}
      >
        <LuLayoutTemplate className="size-4" aria-hidden="true" />
      </button>
    </>
  );
}
