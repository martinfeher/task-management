"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  LuCalendarDays,
  LuLogOut,
  LuMail,
  LuShieldCheck,
  LuTriangleAlert,
  LuX,
} from "react-icons/lu";
import { authClient, useSession } from "@/lib/auth-client";
import { useImportantEnabled } from "@/lib/important-settings";
import { useListPreviewEnabled } from "@/lib/list-preview-settings";
import { useAddTaskNoteSwitchEnabled } from "@/lib/add-task-note-switch-settings";
import { useSubtasksEnabled } from "@/lib/subtasks-settings";
import { ConfirmModal } from "./confirm-modal";
import {
  TASK_EDITOR_FONT_SIZE_MAX_PX,
  TASK_EDITOR_FONT_SIZE_MIN_PX,
  TASK_EDITOR_LINE_HEIGHT_MAX,
  TASK_EDITOR_LINE_HEIGHT_MIN,
  TASK_EDITOR_LINE_HEIGHT_STEP,
  useTaskEditorDefaults,
} from "@/lib/task-editor-defaults-settings";
import { useCalendarTaskDefaultColor } from "@/lib/calendar-task-default-color-settings";

export type SettingsSection = "account" | "general" | "tasks" | "labels" | "calendar";

type SettingsModalProps = {
  open: boolean;
  revealOrigin?: { x: number; y: number } | null;
  /** Which sidebar opens when the modal opens (e.g. from profile menu). */
  initialSection?: SettingsSection;
  onClose: () => void;
};

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "account", label: "Account" },
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

function getAccountInitials(name: string | undefined, email: string | undefined) {
  const source = name?.trim() || email?.trim() || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function formatMemberSince(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function AccountSettingsContent() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const user = session?.user;
  const memberSince = formatMemberSince(
    (user as { createdAt?: unknown } | undefined)?.createdAt,
  );

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Failed to delete account");
      }

      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      setIsDeleteOpen(false);
      setIsDeleting(false);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Account
        </h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your profile and session.
        </p>
      </div>

      {isPending ? (
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      ) : user ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                referrerPolicy="no-referrer"
                className="size-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                {getAccountInitials(user.name, user.email)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-zinc-900 dark:text-zinc-50">
                {user.name}
              </p>
              <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <LuMail className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <LuShieldCheck className="size-3" aria-hidden="true" />
              Google
            </span>
          </div>

          {memberSince ? (
            <p className="flex items-center gap-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
              <LuCalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              Member since {memberSince}
            </p>
          ) : null}

          <div className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Session
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Sign out of Todolist on this device.
            </p>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              <LuLogOut className="size-4 shrink-0" aria-hidden="true" />
              {isSigningOut ? "Signing out…" : "Sign out"}
            </button>
          </div>

          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/40 p-3 dark:border-red-900/50 dark:bg-red-950/10">
            <p className="text-xs text-red-600/80 dark:text-red-300/70">
              Permanently delete your account and all of your lists, tasks,
              labels, and settings. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setIsDeleteOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
            >
              Delete account
            </button>
            {deleteError ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {deleteError}
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You&apos;re not signed in.
        </p>
      )}

      <ConfirmModal
        open={isDeleteOpen}
        title="Delete account"
        message="This permanently deletes your account and all of your lists, tasks, labels, and settings. This cannot be undone."
        confirmLabel={isDeleting ? "Deleting…" : "Delete account"}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => {
          if (!isDeleting) setIsDeleteOpen(false);
        }}
      />
    </div>
  );
}

function GeneralSettingsContent() {
  const { importantEnabled, setImportantEnabled } = useImportantEnabled();
  const { listPreviewEnabled, setListPreviewEnabled } = useListPreviewEnabled();
  const { addTaskNoteSwitchEnabled, setAddTaskNoteSwitchEnabled } =
    useAddTaskNoteSwitchEnabled();

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
      <SettingsToggle
        label="Task and note switch"
        checked={addTaskNoteSwitchEnabled}
        onChange={setAddTaskNoteSwitchEnabled}
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
    case "account":
      return <AccountSettingsContent />;
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
  initialSection = "account",
  onClose,
}: SettingsModalProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isEntered, setIsEntered] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(initialSection);

  useEffect(() => {
    if (open) {
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
      className={`search-modal-overlay fixed inset-0 z-10000 flex items-start justify-center p-4 pt-[8vh] ${
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
              {SETTINGS_SECTIONS.map((section, index) => (
                <div key={section.id} className="contents">
                  {index === 1 ? (
                    <div
                      role="separator"
                      aria-hidden="true"
                      className="my-1.5 h-px shrink-0 bg-zinc-200 dark:bg-zinc-700"
                    />
                  ) : null}
                  <button
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
                </div>
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
