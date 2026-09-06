"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LuX } from "react-icons/lu";
import { useImportantEnabled } from "@/lib/important-settings";

type SettingsSection = "general" | "tasks" | "labels";

type SettingsModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  onClose: () => void;
};

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "general", label: "General" },
  { id: "tasks", label: "Tasks" },
  { id: "labels", label: "Labels" },
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
    </div>
  );
}

function SettingsSectionContent({ section }: { section: SettingsSection }) {
  switch (section) {
    case "general":
      return <GeneralSettingsContent />;
    case "tasks":
      return (
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Tasks
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Task-related settings will appear here.
          </p>
        </div>
      );
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
