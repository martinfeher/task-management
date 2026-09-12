"use client";

import { useEffect, useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { getSidebarBackgroundPresentation } from "@/lib/sidebar-background";
import type { TemplateSettingsSnapshot } from "@/lib/template-settings-history";
import {
  normalizeTemplateStyleName,
  type TemplateStyleRecord,
} from "@/lib/template-style-types";
import { useTemplateStyles } from "@/lib/template-styles";

type TemplateStylesSectionProps = {
  getCurrentSnapshot: () => TemplateSettingsSnapshot;
  applySnapshot: (snapshot: TemplateSettingsSnapshot) => void;
  saveAllSettings: (snapshot: TemplateSettingsSnapshot) => Promise<void>;
};

function TemplateStyleSwatch({ style }: { style: TemplateStyleRecord }) {
  const sidebarPreview = getSidebarBackgroundPresentation(
    style.settings.sidebar.backgroundId,
    style.settings.sidebar.baseColor,
  );

  return (
    <span
      aria-hidden="true"
      className={`size-3 shrink-0 rounded-full border border-zinc-200/80 ${sidebarPreview.className ?? ""}`}
      style={sidebarPreview.style}
    />
  );
}

export function TemplateStylesSection({
  getCurrentSnapshot,
  applySnapshot,
  saveAllSettings,
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
    templateStyles.setSelectedStyleId(style.id);
    setNameDraft(style.name);
    applySnapshot(style.settings);
    await saveAllSettings(style.settings);
    await templateStyles.activateStyle(style.id);
  }

  async function handleSaveAsNew() {
    const name = normalizeTemplateStyleName(nameDraft);
    if (!name) return;

    const snapshot = getCurrentSnapshot();
    await templateStyles.createStyle(name, snapshot);
    await saveAllSettings(snapshot);
    setNameDraft(name);
  }

  async function handleUpdateSelected() {
    if (!selectedStyle) return;

    const name = normalizeTemplateStyleName(nameDraft) || selectedStyle.name;
    const snapshot = getCurrentSnapshot();
    await templateStyles.updateStyle(selectedStyle.id, name, snapshot);
    await saveAllSettings(snapshot);
  }

  async function handleDeleteSelected() {
    if (!selectedStyle) return;
    if (!window.confirm(`Delete template "${selectedStyle.name}"?`)) return;
    await templateStyles.deleteStyle(selectedStyle.id);
  }

  return (
    <section className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <h3 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Saved templates
      </h3>

      <div className="mb-2 flex gap-2">
        <input
          type="text"
          data-template-style-name-input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          placeholder="Template name"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500"
        />
        <button
          type="button"
          disabled={
            templateStyles.isWorking || !normalizeTemplateStyleName(nameDraft)
          }
          onClick={() => void handleSaveAsNew()}
          className="shrink-0 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Save
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <button
          type="button"
          disabled={templateStyles.isWorking || !selectedStyle}
          onClick={() => void handleUpdateSelected()}
          className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Update selected
        </button>
        <button
          type="button"
          disabled={templateStyles.isWorking || !selectedStyle}
          onClick={() => void handleDeleteSelected()}
          aria-label="Delete selected template"
          className="rounded-md border border-red-200 px-2 py-1 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
        >
          <LuTrash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {templateStyles.error ? (
        <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">
          {templateStyles.error}
        </p>
      ) : null}
      {templateStyles.successMessage ? (
        <p className="mb-2 text-[11px] text-emerald-600 dark:text-emerald-400">
          {templateStyles.successMessage}
        </p>
      ) : null}

      <div className="max-h-36 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
        {templateStyles.isLoading ? (
          <p className="px-2 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Loading...
          </p>
        ) : templateStyles.styles.length === 0 ? (
          <p className="px-2 py-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            No saved templates yet. Adjust settings above, name your template,
            then click Save.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {templateStyles.styles.map((style) => {
              const isSelected = templateStyles.selectedStyleId === style.id;
              const isActive = templateStyles.activeStyleId === style.id;

              return (
                <li key={style.id}>
                  <button
                    type="button"
                    disabled={templateStyles.isWorking}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => void applyStyle(style)}
                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-900"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                    }`}
                  >
                    <TemplateStyleSwatch style={style} />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
                      {style.name}
                    </span>
                    {isActive ? (
                      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#4873c7]">
                        Active
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

    </section>
  );
}
