"use client";

import { useEffect, useState } from "react";
import { getCalendarTaskBackgroundPresentation } from "@/lib/calendar-task-background";
import type { CalendarTaskBackgroundSettings } from "@/lib/calendar-task-background-types";
import { getSidebarBackgroundPresentation } from "@/lib/sidebar-background";
import {
  getCopyTemplateName,
  normalizeTemplateStyleName,
  type TemplateStyleRecord,
} from "@/lib/template-style-types";
import { useTemplateStyles } from "@/lib/template-styles";

type TemplateStylesSectionProps = {
  sidebar: {
    currentSettings: {
      backgroundId: Parameters<typeof getSidebarBackgroundPresentation>[0];
      baseColor: string;
    };
    replaceSettings: (
      settings: {
        backgroundId: Parameters<typeof getSidebarBackgroundPresentation>[0];
        baseColor: string;
      },
      options?: { markSaved?: boolean },
    ) => void;
    saveSettings: (settings?: {
      backgroundId: Parameters<typeof getSidebarBackgroundPresentation>[0];
      baseColor: string;
    }) => Promise<void>;
  };
  calendarTask: {
    currentSettings: CalendarTaskBackgroundSettings;
    replaceSettings: (
      settings: CalendarTaskBackgroundSettings,
      options?: { markSaved?: boolean },
    ) => void;
    saveSettings: (
      settings?: CalendarTaskBackgroundSettings,
    ) => Promise<void>;
  };
};

function TemplateStylePreview({ style }: { style: TemplateStyleRecord }) {
  const sidebarPreview = getSidebarBackgroundPresentation(
    style.sidebarBackgroundId,
    style.sidebarBaseColor,
  );
  const calendarPreview = getCalendarTaskBackgroundPresentation(
    style.calendarBackgroundId,
    style.calendarBaseColor,
    style.calendarEndColor,
  );

  return (
    <div className="flex gap-1.5">
      <div
        aria-hidden="true"
        title="Sidebar preview"
        className={`h-8 flex-1 rounded border border-zinc-200 ${sidebarPreview.className ?? ""}`}
        style={sidebarPreview.style}
      />
      <div
        aria-hidden="true"
        title="Calendar task preview"
        className="h-8 flex-1 rounded border border-zinc-200"
        style={{ background: calendarPreview.background }}
      />
    </div>
  );
}

export function TemplateStylesSection({
  sidebar,
  calendarTask,
}: TemplateStylesSectionProps) {
  const templateStyles = useTemplateStyles();
  const [nameDraft, setNameDraft] = useState("My template");

  const selectedStyle = templateStyles.styles.find(
    (style) => style.id === templateStyles.selectedStyleId,
  );

  useEffect(() => {
    if (selectedStyle) {
      setNameDraft(selectedStyle.name);
    }
  }, [selectedStyle]);

  async function applyStyle(style: TemplateStyleRecord) {
    const sidebarSettings = {
      backgroundId: style.sidebarBackgroundId,
      baseColor: style.sidebarBaseColor,
    };
    const calendarSettings = {
      backgroundId: style.calendarBackgroundId,
      baseColor: style.calendarBaseColor,
      endColor: style.calendarEndColor,
      titleColor: style.calendarTitleColor,
      timeColor: style.calendarTimeColor,
    };

    sidebar.replaceSettings(sidebarSettings, { markSaved: true });
    calendarTask.replaceSettings(calendarSettings, { markSaved: true });

    await Promise.all([
      sidebar.saveSettings(sidebarSettings),
      calendarTask.saveSettings(calendarSettings),
      templateStyles.activateStyle(style.id),
    ]);
  }

  async function handleSaveAsNew() {
    const name = normalizeTemplateStyleName(nameDraft);
    if (!name) return;

    await templateStyles.createStyle(
      name,
      sidebar.currentSettings,
      calendarTask.currentSettings,
    );
    setNameDraft(name);
  }

  async function handleUpdateSelected() {
    if (!selectedStyle) return;

    const name = normalizeTemplateStyleName(nameDraft) || selectedStyle.name;
    await templateStyles.updateStyle(
      selectedStyle.id,
      name,
      sidebar.currentSettings,
      calendarTask.currentSettings,
    );
  }

  async function handleCreateBlank() {
    const name = normalizeTemplateStyleName(nameDraft) || "Untitled template";
    const style = await templateStyles.createBlankStyle(name);
    await applyStyle(style);
    setNameDraft(style.name);
  }

  async function handleCopySelected() {
    if (!selectedStyle) return;
    const copied = await templateStyles.copyStyle(
      selectedStyle.id,
      getCopyTemplateName(nameDraft || selectedStyle.name),
    );
    setNameDraft(copied.name);
  }

  async function handleDeleteSelected() {
    if (!selectedStyle) return;
    if (!window.confirm(`Delete template "${selectedStyle.name}"?`)) return;
    await templateStyles.deleteStyle(selectedStyle.id);
  }

  return (
    <section className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Saved templates
      </h3>

      <div className="mb-3 space-y-2">
        <input
          type="text"
          data-template-style-name-input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          placeholder="Template name"
          className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={templateStyles.isWorking || !normalizeTemplateStyleName(nameDraft)}
            onClick={() => void handleSaveAsNew()}
            className="rounded-md bg-zinc-900 px-2 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Save as new
          </button>
          <button
            type="button"
            disabled={templateStyles.isWorking}
            onClick={() => void handleCreateBlank()}
            className="rounded-md border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            New blank
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={templateStyles.isWorking || !selectedStyle}
            onClick={() => void handleUpdateSelected()}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Update
          </button>
          <button
            type="button"
            disabled={templateStyles.isWorking || !selectedStyle}
            onClick={() => void handleCopySelected()}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Copy
          </button>
          <button
            type="button"
            disabled={templateStyles.isWorking || !selectedStyle}
            onClick={() => void handleDeleteSelected()}
            className="rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Delete
          </button>
        </div>
      </div>

      {templateStyles.error ? (
        <p className="mb-2 text-xs text-red-600 dark:text-red-400">
          {templateStyles.error}
        </p>
      ) : null}
      {templateStyles.successMessage ? (
        <p className="mb-2 text-xs text-emerald-600 dark:text-emerald-400">
          {templateStyles.successMessage}
        </p>
      ) : null}

      {templateStyles.isLoading ? (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          Loading templates...
        </p>
      ) : templateStyles.styles.length === 0 ? (
        <p className="px-1 text-xs text-zinc-500 dark:text-zinc-400">
          No saved templates yet. Adjust the settings above, name your style,
          then click Save as new.
        </p>
      ) : (
        <ul className="space-y-2">
          {templateStyles.styles.map((style) => {
            const isSelected = templateStyles.selectedStyleId === style.id;
            const isActive = templateStyles.activeStyleId === style.id;

            return (
              <li key={style.id}>
                <div
                  className={`rounded-lg border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900"
                      : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => templateStyles.setSelectedStyleId(style.id)}
                    className="mb-2 w-full text-left"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {style.name}
                      </span>
                      {isActive ? (
                        <span className="shrink-0 rounded-full bg-[#4873c7]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#4873c7]">
                          Active
                        </span>
                      ) : null}
                    </div>
                    <TemplateStylePreview style={style} />
                  </button>
                  <button
                    type="button"
                    disabled={templateStyles.isWorking}
                    onClick={() => void applyStyle(style)}
                    className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-950"
                  >
                    Load template
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
