"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import {
  BiChevronDown,
  BiChevronLeft,
  BiChevronRight,
  BiSun,
  BiTimeFive,
} from "react-icons/bi";
import { MdAlarm } from "react-icons/md";
import { CalendarOff, Repeat } from "lucide-react";
import {
  formatDueTimeLabel,
  formatDurationInputText,
  formatTime24Hour,
  generateTimeListOptions,
  DEFAULT_TIME_PICKER_DURATION_MINUTES,
  isPresetDurationMinutes,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
  parseTypedDuration,
  parseTypedTime,
  TIME_PICKER_DURATION_OPTIONS,
  TIME_PRESETS,
  type TaskDueTime,
} from "@/lib/task-due-time";
import {
  formatRecurrenceLabel,
  getRecurrenceMenuSelectionId,
  getRecurringOccurrenceDateKeys,
  parseRecurrenceRule,
  RECURRENCE_MENU_OPTIONS,
  type TaskRecurrenceRule,
} from "@/lib/task-recurrence";
import {
  formatReminderLabel,
  REMINDER_MENU_OPTIONS,
  type TaskReminderOptionId,
} from "@/lib/task-reminder";

type TaskDueTimeSaveOptions = {
  keepOpen?: boolean;
};

type TaskDatePickerProps = {
  dueDate: string | null;
  dueTimeMinutes?: number | null;
  dueDurationMinutes?: number | null;
  dueTimeZone?: string | null;
  recurrenceRule?: string | null;
  onSelectDate: (dateValue: string | null) => void;
  onSaveDueTime?: (dueTime: TaskDueTime, options?: TaskDueTimeSaveOptions) => void;
  onSaveRecurrence?: (
    rule: TaskRecurrenceRule | null,
  ) => void | Promise<void>;
  onRecurrenceMenuOpenChange?: (open: boolean) => void;
  onReminderMenuOpenChange?: (open: boolean) => void;
  reminderOptionId?: TaskReminderOptionId | null;
  onSaveReminder?: (optionId: TaskReminderOptionId) => void;
  className?: string;
};

const TASK_DATE_PICKER_WIDTH = 280;
const TASK_DATE_PICKER_GAP = 4;

export { TASK_DATE_PICKER_WIDTH, TASK_DATE_PICKER_GAP };

export function computeTaskDatePickerMenuPosition(
  anchor: HTMLElement,
  options?: { align?: "left" | "right" },
) {
  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 8;
  let left =
    options?.align === "right"
      ? rect.right - TASK_DATE_PICKER_WIDTH
      : rect.left;

  left = Math.max(
    viewportPadding,
    Math.min(
      left,
      window.innerWidth - TASK_DATE_PICKER_WIDTH - viewportPadding,
    ),
  );

  return {
    top: rect.bottom + TASK_DATE_PICKER_GAP,
    left,
  };
}

/** Canvas Time Lens–aligned picker tokens (oklch approximations) */
const PICKER_ACCENT = "#67676";
const PICKER_ACCENT_SOFT = "#f1f1f1";
const PICKER_BORDER = "#ebecef";
const PICKER_MUTED = "#f4f5f7";
const PICKER_MUTED_FG = "#71717a";
const PICKER_FOREGROUND = "#1c2030";
const PICKER_POPOVER_SHADOW =
  "0 12px 40px -8px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06)";

function lightenHexColor(hex: string, amount: number) {
  const normalized = hex.replace("#", "");
  const channels = [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];

  return `#${channels
    .map((channel) =>
      Math.round(channel + (255 - channel) * amount)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const PICKER_DURATION_SCROLL_THUMB = lightenHexColor("#a1a1aa", 0.15);
const PICKER_DURATION_SCROLL_THUMB_HOVER = lightenHexColor("#71717a", 0.15);
const PICKER_DURATION_SCROLL_TRACK = lightenHexColor("#f4f4f5", 0.15);
const PICKER_DURATION_SCROLL_THUMB_DARK = lightenHexColor("#71717a", 0.15);
const PICKER_DURATION_SCROLL_TRACK_DARK = lightenHexColor("#27272a", 0.15);

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function getMondayFirstWeekdayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateValue(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function isPastDay(day: Date, today: Date) {
  return toDateValue(day) < toDateValue(today);
}

type DateInputFormat = "european" | "american";

const DATE_FORMAT_OPTIONS: {
  value: DateInputFormat;
  label: string;
  placeholder: string;
  example: string;
}[] = [
  {
    value: "european",
    label: "dd/mm/yyyy",
    placeholder: "dd/mm/yyyy",
    example: "07/05/2026 or 15.09.2026",
  },
  {
    value: "american",
    label: "mm/dd/yyyy",
    placeholder: "mm/dd/yyyy",
    example: "07/05/2026",
  },
];

function getDateFormatConfig(format: DateInputFormat) {
  return DATE_FORMAT_OPTIONS.find((option) => option.value === format)!;
}

type ParsedTypedDate = {
  date: Date;
  normalized: string;
};

function formatNormalizedDate(date: Date, format: DateInputFormat) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return format === "european"
    ? `${day}/${month}/${year}`
    : `${month}/${day}/${year}`;
}

function parseOrderedDateParts(
  first: number,
  second: number,
  year: number,
  format: DateInputFormat,
) {
  if (first > 12) {
    return buildDate(year, second, first);
  }

  if (second > 12) {
    return buildDate(year, first, second);
  }

  if (format === "european") {
    return buildDate(year, second, first);
  }

  return buildDate(year, first, second);
}

function normalizeYear(year: number) {
  if (year < 100) {
    return 2000 + year;
  }
  return year;
}

function buildDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseNumericDateInput(
  input: string,
  today: Date,
  format: DateInputFormat,
) {
  const trimmed = input.trim();

  const isoMatch = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (isoMatch) {
    return buildDate(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10),
    );
  }

  const dottedFullMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (dottedFullMatch) {
    return buildDate(
      normalizeYear(parseInt(dottedFullMatch[3], 10)),
      parseInt(dottedFullMatch[2], 10),
      parseInt(dottedFullMatch[1], 10),
    );
  }

  const dottedShortMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dottedShortMatch) {
    return buildDate(
      today.getFullYear(),
      parseInt(dottedShortMatch[2], 10),
      parseInt(dottedShortMatch[1], 10),
    );
  }

  const fullMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (fullMatch) {
    return parseOrderedDateParts(
      parseInt(fullMatch[1], 10),
      parseInt(fullMatch[2], 10),
      normalizeYear(parseInt(fullMatch[3], 10)),
      format,
    );
  }

  const shortMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (shortMatch) {
    return parseOrderedDateParts(
      parseInt(shortMatch[1], 10),
      parseInt(shortMatch[2], 10),
      today.getFullYear(),
      format,
    );
  }

  return null;
}

function parseTypedDate(
  input: string,
  today: Date,
  format: DateInputFormat,
): ParsedTypedDate | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();

  if (lowered === "today") {
    return {
      date: today,
      normalized: formatNormalizedDate(today, format),
    };
  }

  if (lowered === "tomorrow") {
    const date = addDays(today, 1);
    return { date, normalized: formatNormalizedDate(date, format) };
  }

  const numericDate = parseNumericDateInput(trimmed, today, format);
  if (numericDate && !isPastDay(numericDate, today)) {
    return {
      date: numericDate,
      normalized: formatNormalizedDate(numericDate, format),
    };
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const date = startOfDay(parsed);
    if (!isPastDay(date, today)) {
      return { date, normalized: formatNormalizedDate(date, format) };
    }
  }

  return null;
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function getMonthDays(year: number, month: number, today: Date) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const visibleDays: Date[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (!isPastDay(date, today)) {
      visibleDays.push(date);
    }
  }

  if (visibleDays.length === 0) {
    return [];
  }

  const padding = getMondayFirstWeekdayIndex(visibleDays[0]);
  const cells: (Date | null)[] = Array.from({ length: padding }, () => null);
  return [...cells, ...visibleDays];
}

function TodayIcon() {
  const today = new Date().getDate();
  return (
    <span className="relative flex size-6 items-center justify-center rounded-md bg-emerald-500 text-[14px] font-semibold text-white">
      {today}
    </span>
  );
}

function getVisiblePickerCalendarRange(
  viewMonth: Date,
  nextMonth: Date,
  today: Date,
) {
  const monthStart = startOfDay(
    new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1),
  );
  const rangeStart = monthStart > today ? monthStart : today;
  const rangeEnd = startOfDay(
    new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0),
  );

  return { start: rangeStart, end: rangeEnd };
}

function MonthGrid({
  monthDate,
  today,
  selectedDate,
  recurringDateKeys,
  onSelectDate,
  showHeading = true,
}: {
  monthDate: Date;
  today: Date;
  selectedDate: Date | null;
  recurringDateKeys?: Set<string>;
  onSelectDate: (date: Date) => void;
  showHeading?: boolean;
}) {
  const days = useMemo(
    () => getMonthDays(monthDate.getFullYear(), monthDate.getMonth(), today),
    [monthDate, today],
  );

  if (days.length === 0) {
    return null;
  }

  return (
    <div>
      {showHeading && (
        <div className="mb-2 flex items-center justify-between px-3">
          <h4 className="text-sm font-semibold text-zinc-750 dark:text-zinc-50">
            {formatMonthYear(monthDate)}
          </h4>
        </div>
      )}

      <div className="grid grid-cols-7 px-1.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex h-7 items-center justify-center text-[13px] font-medium text-zinc-400"
          >
            {label}
          </div>
        ))}

        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const isSunday = day.getDay() === 0;
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const dateKey = toDateValue(day);
          const isRecurring = recurringDateKeys?.has(dateKey) ?? false;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`relative mx-auto flex size-[29px] items-center justify-center rounded-full text-[13px] transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#87a1cb] font-medium text-white"
                  : isSunday
                    ? "font-medium text-orange-700 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    : "text-zinc-600 hover:bg-slate-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {day.getDate()}
              {isToday && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gray-300" />
              ) : null}
              {isRecurring && !isSelected ? (
                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-gray-300" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskReminderMenu({
  activeReminder,
  disabled,
  isOpen,
  onSelectReminder,
  onOpenChange,
}: {
  activeReminder: TaskReminderOptionId | null;
  disabled?: boolean;
  isOpen: boolean;
  onSelectReminder: (optionId: TaskReminderOptionId) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const triggerLabel = formatReminderLabel(activeReminder);
  const hasActiveReminder = activeReminder !== null;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isOpen, onOpenChange]);

  function openMenu() {
    if (disabled || isOpen) return;
    onOpenChange(true);
  }

  function closeMenu() {
    if (!isOpen) return;
    onOpenChange(false);
  }

  function scheduleCloseMenu() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      closeMenu();
    }, 120);
  }

  function cancelScheduledClose() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function handleSelectOption(optionId: TaskReminderOptionId) {
    if (activeReminder === optionId) {
      closeMenu();
      return;
    }

    onSelectReminder(optionId);
    closeMenu();
  }

  return (
    <div
      ref={menuRef}
      className="relative mb-2"
      onMouseEnter={() => {
        cancelScheduledClose();
        openMenu();
      }}
      onMouseLeave={() => scheduleCloseMenu()}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={
          hasActiveReminder ? `Reminder: ${triggerLabel}` : "Reminder"
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={() => {
          if (disabled) return;
          if (isOpen) {
            closeMenu();
            return;
          }
          openMenu();
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-full border py-2 text-[13px] font-medium transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        style={{
          borderColor: PICKER_BORDER,
          color: PICKER_FOREGROUND,
        }}
      >
        <MdAlarm
          className="size-4 shrink-0"
          style={{ color: PICKER_MUTED_FG }}
          aria-hidden="true"
        />
        <span
          className="truncate"
          style={{
            color: hasActiveReminder ? PICKER_ACCENT : "#6c6d6d",
          }}
        >
          {triggerLabel}
        </span>
        <BiChevronDown
          className={`size-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          style={{ color: PICKER_MUTED_FG }}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          className="absolute bottom-full left-0 right-0 z-40 pb-1"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div
            role="listbox"
            aria-label="Reminder options"
            className="overflow-hidden rounded-xl border bg-white p-1"
            style={{
              borderColor: PICKER_BORDER,
              boxShadow: PICKER_POPOVER_SHADOW,
            }}
          >
            {REMINDER_MENU_OPTIONS.map((option) => {
              const isSelected = option.id === activeReminder;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSelectOption(option.id);
                  }}
                  className={`flex w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-zinc-100 font-medium text-zinc-700"
                      : "text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaskRecurrenceMenu({
  activeRecurrence,
  disabled,
  isOpen,
  onSaveRecurrence,
  onOpenChange,
}: {
  activeRecurrence: TaskRecurrenceRule | null;
  disabled?: boolean;
  isOpen: boolean;
  onSaveRecurrence: (rule: TaskRecurrenceRule | null) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const menuSelectionId = getRecurrenceMenuSelectionId(activeRecurrence);
  const activeOptionId = menuSelectionId ?? "none";
  const triggerLabel =
    menuSelectionId !== null
      ? (RECURRENCE_MENU_OPTIONS.find((option) => option.id === menuSelectionId)
          ?.label ?? formatRecurrenceLabel(activeRecurrence))
      : formatRecurrenceLabel(activeRecurrence);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
    };
  }, [isOpen, onOpenChange]);

  function openMenu() {
    if (disabled || isOpen) return;
    onOpenChange(true);
  }

  function closeMenu() {
    if (!isOpen) return;
    onOpenChange(false);
  }

  function handleSelectOption(optionId: string) {
    const option = RECURRENCE_MENU_OPTIONS.find((entry) => entry.id === optionId);
    if (!option) return;

    if (optionId === "none") {
      if (!activeRecurrence) {
        closeMenu();
        return;
      }

      onSaveRecurrence(null);
      closeMenu();
      return;
    }

    if (menuSelectionId === optionId) {
      closeMenu();
      return;
    }

    onSaveRecurrence(option.rule);
    closeMenu();
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={() => openMenu()}
      onMouseLeave={() => closeMenu()}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label="Repeat"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={() => {
          if (disabled) return;
          if (isOpen) {
            closeMenu();
            return;
          }
          openMenu();
        }}
        className={`flex w-full items-center justify-center gap-2 rounded-full border py-2 text-[13px] font-medium transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        style={{
          borderColor: PICKER_BORDER,
          color: PICKER_FOREGROUND,
        }}
      >
        <Repeat
          className="size-4 shrink-0 text-[#929494]"
          strokeWidth={2}
          style={{ color: PICKER_MUTED_FG }}
          aria-hidden="true"
        />
        <span className="truncate text-[#6c6d6d]">{triggerLabel}</span>
        <BiChevronDown
          className={`size-4 shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          style={{ color: PICKER_MUTED_FG }}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          className="absolute bottom-full left-0 right-0 z-40 pb-1"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
        >
          <div
            role="listbox"
            aria-label="Repeat options"
            className="overflow-hidden rounded-xl border bg-white p-1"
            style={{
              borderColor: PICKER_BORDER,
              boxShadow: PICKER_POPOVER_SHADOW,
            }}
          >
          {RECURRENCE_MENU_OPTIONS.map((option) => {
            const isSelected = option.id === activeOptionId;

            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectOption(option.id)}
                className={`flex w-full rounded-lg px-3 py-2 text-left text-[13px] transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-zinc-100 font-medium text-zinc-700"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_TIME_LIST_SCROLL_MINUTES = 15 * 60;

function scrollTimeListToMinutes(
  container: HTMLDivElement,
  minutes: number,
) {
  const targetRow = container.querySelector(`[data-minutes="${minutes}"]`);
  if (!(targetRow instanceof HTMLElement)) return;

  const targetTop = targetRow.offsetTop;
  const targetHeight = targetRow.offsetHeight;
  const containerHeight = container.clientHeight;
  container.scrollTop =
    targetTop - containerHeight / 2 + targetHeight / 2;
}

function TaskTimeMenu({
  initialDueTime,
  onSave,
}: {
  initialDueTime: TaskDueTime;
  onSave: (dueTime: TaskDueTime, options?: TaskDueTimeSaveOptions) => void;
}) {
  const initialMinutes = normalizeDueTimeMinutes(initialDueTime.dueTimeMinutes);
  const [draftMinutes, setDraftMinutes] = useState<number | null>(initialMinutes);
  const [typedTime, setTypedTime] = useState(() =>
    initialMinutes != null ? formatTime24Hour(initialMinutes) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialDueTime.dueDurationMinutes,
  );
  const [isCustomDurationOpen, setIsCustomDurationOpen] = useState(() =>
    isPresetDurationMinutes(initialDueTime.dueDurationMinutes)
      ? false
      : initialDueTime.dueDurationMinutes !== null,
  );
  const [typedDuration, setTypedDuration] = useState(() => {
    const initialDuration = initialDueTime.dueDurationMinutes;
    if (
      initialDuration !== null &&
      !isPresetDurationMinutes(initialDuration)
    ) {
      return formatDurationInputText(initialDuration);
    }

    return "";
  });
  const [durationInputError, setDurationInputError] = useState(false);
  const [timeInputError, setTimeInputError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const customDurationInputRef = useRef<HTMLInputElement>(null);
  const hadTimeAtOpenRef = useRef(initialMinutes !== null);
  const hasAppliedDefaultDurationRef = useRef(false);
  const hasInitialScrolledRef = useRef(false);
  const timeOptions = useMemo(() => generateTimeListOptions(), []);

  function resolveDurationWhenSettingTime(
    minutes: number | null,
    duration: number | null,
  ) {
    if (minutes === null) return duration;

    if (
      duration === null &&
      !hasAppliedDefaultDurationRef.current &&
      !hadTimeAtOpenRef.current &&
      initialDueTime.dueDurationMinutes === null
    ) {
      hasAppliedDefaultDurationRef.current = true;
      return DEFAULT_TIME_PICKER_DURATION_MINUTES;
    }

    return duration;
  }

  function applyDurationIfDefault(minutes: number | null, duration: number | null) {
    const nextDuration = resolveDurationWhenSettingTime(minutes, duration);
    if (nextDuration !== duration) {
      setDurationMinutes(nextDuration);
    }
    return nextDuration;
  }

  useLayoutEffect(() => {
    if (!listRef.current || hasInitialScrolledRef.current) return;

    scrollTimeListToMinutes(
      listRef.current,
      initialMinutes ?? DEFAULT_TIME_LIST_SCROLL_MINUTES,
    );
    hasInitialScrolledRef.current = true;
  }, [initialMinutes]);

  useLayoutEffect(() => {
    if (draftMinutes == null || !listRef.current) return;
    if (document.activeElement === timeInputRef.current) return;

    scrollTimeListToMinutes(listRef.current, draftMinutes);
  }, [draftMinutes]);

  function persistDueTime(
    minutes: number | null,
    duration: number | null = durationMinutes,
    options?: TaskDueTimeSaveOptions,
  ) {
    onSave(
      {
        dueTimeMinutes: minutes,
        dueDurationMinutes: duration,
        dueTimeZone: initialDueTime.dueTimeZone,
      },
      options,
    );
  }

  function selectTime(minutes: number) {
    const nextDuration = applyDurationIfDefault(minutes, durationMinutes);
    setDraftMinutes(minutes);
    setTypedTime(formatTime24Hour(minutes));
    setTimeInputError(false);
    persistDueTime(minutes, nextDuration, { keepOpen: true });
  }

  function commitTypedTime() {
    const parsed = parseTypedTime(typedTime);
    if (parsed === null) {
      if (typedTime.trim()) {
        setTimeInputError(true);
      }
      return false;
    }

    setDraftMinutes(parsed);
    setTypedTime(formatTime24Hour(parsed));
    setTimeInputError(false);
    return true;
  }

  function resolveDraftMinutes() {
    if (typedTime.trim()) {
      const parsed = parseTypedTime(typedTime);
      if (parsed !== null) return parsed;
    }

    return draftMinutes;
  }

  function commitTypedTimeAndSave() {
    if (!typedTime.trim()) return;
    if (!commitTypedTime()) return;

    const minutes = resolveDraftMinutes();
    if (minutes !== null) {
      const nextDuration = applyDurationIfDefault(minutes, durationMinutes);
      persistDueTime(minutes, nextDuration, { keepOpen: true });
    }
  }

  function handleClearTime() {
    hadTimeAtOpenRef.current = false;
    hasAppliedDefaultDurationRef.current = false;
    setDurationMinutes(null);
    setIsCustomDurationOpen(false);
    setTypedDuration("");
    setDurationInputError(false);
    persistDueTime(null, null, { keepOpen: true });
  }

  function selectDuration(minutes: number) {
    setIsCustomDurationOpen(false);
    setTypedDuration("");
    setDurationInputError(false);
    setDurationMinutes(minutes);

    const draftMinutes = resolveDraftMinutes();
    if (draftMinutes !== null) {
      persistDueTime(draftMinutes, minutes, { keepOpen: true });
    }
  }

  function openCustomDuration() {
    setIsCustomDurationOpen(true);
    setDurationInputError(false);

    if (
      durationMinutes !== null &&
      !isPresetDurationMinutes(durationMinutes)
    ) {
      setTypedDuration(formatDurationInputText(durationMinutes));
    }

    requestAnimationFrame(() => customDurationInputRef.current?.focus());
  }

  function commitTypedDuration() {
    const parsed = parseTypedDuration(typedDuration);
    if (parsed === null) {
      if (typedDuration.trim()) {
        setDurationInputError(true);
      }
      return false;
    }

    setDurationMinutes(parsed);
    setTypedDuration(formatDurationInputText(parsed));
    setDurationInputError(false);

    const draftMinutes = resolveDraftMinutes();
    if (draftMinutes !== null) {
      persistDueTime(draftMinutes, parsed, { keepOpen: true });
    }

    return true;
  }

  const isCustomDurationSelected =
    isCustomDurationOpen ||
    (durationMinutes !== null && !isPresetDurationMinutes(durationMinutes));

  return (
    <div
      data-task-time-menu
      className="space-y-3 rounded-2xl border bg-white px-3 pt-3 pb-2"
      style={{ borderColor: PICKER_BORDER }}
    >
      <div
        className={`flex items-center gap-2 text-[14px] rounded-xl px-3 py-[6px] ${
          timeInputError ? "" : ""
        }`}
        style={{
          backgroundColor: PICKER_MUTED,
          ...(draftMinutes != null && !timeInputError
            ? {
                boxShadow: `inset 0 0 0 1px ${PICKER_ACCENT}`,
              }
            : {}),
        }}
      >
        <BiTimeFive
          className="size-4 shrink-0 text-[#5f5f5f]"
          aria-hidden="true"
        />
        <input
          ref={timeInputRef}
          type="text"
          data-task-time-input
          value={typedTime}
          onChange={(event) => {
            setTypedTime(event.target.value);
            if (timeInputError) setTimeInputError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTypedTimeAndSave();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          placeholder="Type a time — 9, 930, 6pm"
          aria-invalid={timeInputError}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400"
          style={{
            color:
              draftMinutes != null && !timeInputError
                ? PICKER_ACCENT
                : PICKER_FOREGROUND,
          }}
        />
      </div>
      {timeInputError ? (
        <p className="text-[14px] text-red-500">
          Enter a valid time, e.g. 9, 930, 6pm, or 09:00
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {TIME_PRESETS.map((preset) => {
          const isSelected = draftMinutes === preset.minutes;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectTime(preset.minutes)}
              className="rounded-xl border px-2.5 py-1.5 text-left transition-colors cursor-pointer"
              style={
                isSelected
                  ? {
                      borderColor: PICKER_BORDER,
                      backgroundColor: PICKER_ACCENT_SOFT,
                    }
                  : { borderColor: PICKER_BORDER }
              }
            >
              <span className="block text-[13.5px] font-medium text-zinc-800">
                {preset.label}
              </span>
              <span
                className="block text-[12.5px]"
                style={{ color: PICKER_MUTED_FG }}
              >
                {formatTime24Hour(preset.minutes)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={listRef}
        className="max-h-36 overflow-y-auto rounded-xl border"
        style={{ borderColor: PICKER_BORDER }}
      >
        {timeOptions.map((minutes) => {
          const isSelected = draftMinutes === minutes;

          return (
            <button
              key={minutes}
              type="button"
              data-minutes={minutes}
              onClick={() => selectTime(minutes)}
              className={`block w-full px-3 py-1 text-left text-[13px] transition-colors cursor-pointer ${
                isSelected ? "font-semibold" : "hover:bg-zinc-50"
              }`}
              style={
                isSelected
                  ? { backgroundColor: PICKER_ACCENT_SOFT, color: PICKER_ACCENT }
                  : { color: PICKER_FOREGROUND }
              }
            >
              {formatTime24Hour(minutes)}
            </button>
          );
        })}
      </div>

      <div>
        <span
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
          style={{ color: PICKER_MUTED_FG }}
        >
          Duration
        </span>
        <div
          className="task-picker-duration-scroll mt-2 flex flex-nowrap gap-2 pb-1"
          style={
            {
              "--duration-scroll-thumb": PICKER_DURATION_SCROLL_THUMB,
              "--duration-scroll-thumb-hover": PICKER_DURATION_SCROLL_THUMB_HOVER,
              "--duration-scroll-track": PICKER_DURATION_SCROLL_TRACK,
              "--duration-scroll-thumb-dark": PICKER_DURATION_SCROLL_THUMB_DARK,
              "--duration-scroll-track-dark": PICKER_DURATION_SCROLL_TRACK_DARK,
            } as CSSProperties
          }
        >
          {TIME_PICKER_DURATION_OPTIONS.map((option) => {
            const isSelected = durationMinutes === option.value;

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => selectDuration(option.value)}
                className="shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition-colors cursor-pointer border-[#d5d5d5]"
                style={
                  isSelected
                    ? {
                        backgroundColor: PICKER_ACCENT_SOFT,
                        color: PICKER_ACCENT,
                      }
                    : {
                        borderColor: PICKER_BORDER,
                        color: PICKER_FOREGROUND,
                      }
                }
              >
                {option.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={openCustomDuration}
            className="shrink-0 rounded-full border px-2.5 py-1 text-[12px] transition-colors cursor-pointer border-[#d5d5d5]"
            style={
              isCustomDurationSelected
                ? {
                    backgroundColor: PICKER_ACCENT_SOFT,
                    color: PICKER_ACCENT,
                  }
                : {
                    borderColor: PICKER_BORDER,
                    color: PICKER_FOREGROUND,
                  }
            }
          >
            Custom
          </button>
        </div>
        {isCustomDurationOpen ? (
          <div className="mt-2">
            <input
              ref={customDurationInputRef}
              type="text"
              value={typedDuration}
              onChange={(event) => {
                setTypedDuration(event.target.value);
                if (durationInputError) setDurationInputError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTypedDuration();
                }
              }}
              onBlur={() => {
                if (typedDuration.trim()) {
                  commitTypedDuration();
                }
              }}
              onPointerDown={(event) => event.stopPropagation()}
              placeholder="Type a duration — e.g. 45m, 1h"
              aria-invalid={durationInputError}
              className="w-full rounded-xl border bg-white px-3 py-1.5 text-[13px] outline-none placeholder:text-zinc-400"
              style={{
                borderColor: durationInputError ? "#ef4444" : PICKER_BORDER,
                color: durationInputError ? "#ef4444" : PICKER_FOREGROUND,
              }}
            />
            {durationInputError ? (
              <p className="mt-1 text-[12px] text-red-500">
                Enter a valid duration, e.g. 45m or 1h
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className="border-t pt-2"
        style={{ borderColor: PICKER_BORDER }}
      >
        <button
          type="button"
          onClick={handleClearTime}
          className="text-[12px] font-medium transition-colors hover:opacity-80 cursor-pointer ml-2"
          style={{ color: PICKER_MUTED_FG }}
        >
          Clear time
        </button>
      </div>
    </div>
  );
}

export function TaskDatePicker({
  dueDate,
  dueTimeMinutes = null,
  dueDurationMinutes = null,
  dueTimeZone = "floating",
  recurrenceRule = null,
  onSelectDate,
  onSaveDueTime,
  onSaveRecurrence,
  onRecurrenceMenuOpenChange,
  onReminderMenuOpenChange,
  reminderOptionId = null,
  onSaveReminder,
  className,
}: TaskDatePickerProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const selectedDate = fromDateValue(dueDate);
  const todayMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0),
    [today],
  );
  const [typedDate, setTypedDate] = useState("");
  const [dateInputError, setDateInputError] = useState(false);
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);
  const [dateInputFormat, setDateInputFormat] =
    useState<DateInputFormat>("european");
  const activeFormat = getDateFormatConfig(dateInputFormat);
  const [viewMonth, setViewMonth] = useState(todayMonth);
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [displayReminder, setDisplayReminder] =
    useState<TaskReminderOptionId | null>(reminderOptionId);
  const [openFooterSubmenu, setOpenFooterSubmenu] = useState<
    "reminder" | "recurrence" | null
  >(null);
  const activeRecurrence = parseRecurrenceRule(recurrenceRule);
  const [displayRecurrence, setDisplayRecurrence] =
    useState<TaskRecurrenceRule | null>(activeRecurrence);
  const timeButtonLabel =
    formatDueTimeLabel(dueTimeMinutes) ?? "Add time";
  const dateInputRef = useRef<HTMLInputElement>(null);
  const hasAutoFocusedDateInputRef = useRef(false);

  useEffect(() => {
    if (hasAutoFocusedDateInputRef.current) return;

    const frame = requestAnimationFrame(() => {
      const pickerRoot = dateInputRef.current?.closest(
        "[data-task-date-picker-root]",
      );
      const activeElement = document.activeElement;
      if (
        pickerRoot instanceof Node &&
        activeElement instanceof Node &&
        pickerRoot.contains(activeElement) &&
        activeElement !== dateInputRef.current
      ) {
        hasAutoFocusedDateInputRef.current = true;
        return;
      }

      dateInputRef.current?.focus();
      hasAutoFocusedDateInputRef.current = true;
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    setDisplayRecurrence(activeRecurrence);
  }, [recurrenceRule]);

  useEffect(() => {
    setDisplayReminder(reminderOptionId);
  }, [reminderOptionId]);

  function handleReminderMenuOpenChange(open: boolean) {
    if (open) {
      setIsTimeMenuOpen(false);
      setOpenFooterSubmenu("reminder");
    } else {
      setOpenFooterSubmenu((current) =>
        current === "reminder" ? null : current,
      );
    }
    onReminderMenuOpenChange?.(open);
  }

  function handleRecurrenceMenuOpenChange(open: boolean) {
    if (open) {
      setIsTimeMenuOpen(false);
      setOpenFooterSubmenu("recurrence");
    } else {
      setOpenFooterSubmenu((current) =>
        current === "recurrence" ? null : current,
      );
    }
    onRecurrenceMenuOpenChange?.(open);
  }

  const tomorrow = addDays(today, 1);
  const nextMonth = useMemo(
    () => new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1, 12, 0, 0, 0),
    [viewMonth],
  );

  const anchorDateKey =
    dueDate?.slice(0, 10) ??
    (selectedDate ? toDateValue(selectedDate) : null);
  const recurringDateKeys = useMemo(() => {
    if (!displayRecurrence || !anchorDateKey) {
      return new Set<string>();
    }

    const { start, end } = getVisiblePickerCalendarRange(
      viewMonth,
      nextMonth,
      today,
    );

    return new Set(
      getRecurringOccurrenceDateKeys(
        anchorDateKey,
        displayRecurrence,
        start,
        end,
      ),
    );
  }, [displayRecurrence, anchorDateKey, viewMonth, nextMonth, today, selectedDate]);

  const canGoToPreviousMonth = viewMonth > todayMonth;

  function selectDate(date: Date) {
    onSelectDate(toDateValue(date));
  }

  function handleTypedDateSubmit() {
    const parsed = parseTypedDate(typedDate, today, dateInputFormat);
    if (!parsed) {
      setDateInputError(true);
      return;
    }

    setDateInputError(false);
    setTypedDate(parsed.normalized);
    selectDate(parsed.date);
  }

  function shiftMonth(offset: number) {
    if (offset < 0 && !canGoToPreviousMonth) return;

    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + offset, 1, 12, 0, 0, 0),
    );
  }

  const quickOptions = [
    {
      key: "today",
      label: "Today",
      hint: formatWeekdayShort(today),
      icon: <TodayIcon />,
      date: today,
    },
    {
      key: "tomorrow",
      label: "Tomorrow",
      hint: formatWeekdayShort(tomorrow),
      icon: <BiSun className="size-6 text-amber-500" />,
      date: tomorrow,
    },
  ];

  function handleRemoveDate(event: SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    onSelectDate(null);
    setTypedDate("");
    setDateInputError(false);
  }

  return (
    <div
      data-task-date-picker-root
      className={`relative z-50 overflow-visible bg-white ${
        className ?? "rounded-2xl border"
      }`}
      style={{
        width: TASK_DATE_PICKER_WIDTH,
        borderColor: className ? undefined : PICKER_BORDER,
        boxShadow: className ? undefined : PICKER_POPOVER_SHADOW,
      }}
    >
      <div
        className="border-b p-2"
        style={{ borderColor: PICKER_BORDER }}
      >
        <input
          ref={dateInputRef}
          type="text"
          data-task-date-picker-date-input
          value={typedDate}
          onChange={(event) => {
            setTypedDate(event.target.value);
            if (dateInputError) {
              setDateInputError(false);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleTypedDateSubmit();
            }
          }}
          onFocus={() => setIsDateInputFocused(true)}
          onBlur={() => setIsDateInputFocused(false)}
          placeholder={
            isDateInputFocused
              ? activeFormat.placeholder
              : "Type a date — e.g. next friday"
          }
          aria-invalid={dateInputError}
          className={`w-full rounded-[12px] px-3.5 py-[6px] text-[13px] outline-none ${
            dateInputError
              ? "text-red-600 placeholder:text-red-300"
              : "text-zinc-900 placeholder:text-zinc-400"
          }`}
          style={{ backgroundColor: PICKER_MUTED }}
        />
        {dateInputError && (
          <p className="mt-1.5 text-[14px] text-red-500">
            Enter a valid future date, e.g. {activeFormat.example}
          </p>
        )}
      </div>

      <div
        className="flex gap-2 overflow-visible p-2"
        style={{ borderColor: PICKER_BORDER }}
      >
        {quickOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => selectDate(option.date)}
            className="flex-1 rounded-xl border px-3 py-[5px] text-left transition-colors hover:border-[#d5d5d5] hover:bg-[#f0f0f0] cursor-pointer"
            style={{ borderColor: PICKER_BORDER }}
          >
            <span className="block text-[13px] leading-[1.3] font-medium text-zinc-700">
              {option.label}
            </span>
            <span
              className="block text-[12px] text-zinc-450"
            >
              {option.hint}
            </span>
          </button>
        ))}
        {dueDate ? (
          <div className="group/no-date relative shrink-0">
            <button
              type="button"
              onPointerDown={handleRemoveDate}
              aria-label="Remove date"
              aria-describedby="task-date-picker-remove-date-tooltip"
              className="flex shrink-0 items-center justify-center rounded-xl border px-3 py-2 h-[46px]! transition-colors hover:border-red-300 hover:text-red-600 cursor-pointer"
              style={{ borderColor: PICKER_BORDER, color: PICKER_MUTED_FG }}
            >
              <CalendarOff
                className="pointer-events-none size-4 text-zinc-500"
                strokeWidth={2}
                aria-hidden="true"
              />
            </button>
            <span
              id="task-date-picker-remove-date-tooltip"
              role="tooltip"
              className="task-date-picker-remove-tooltip add-task-date-tooltip pointer-events-none absolute right-0 bottom-[calc(100%+10px)] z-40 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/no-date:opacity-100"
            >
              Remove date
            </span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-[11px] py-[6px]">
          <h4 className="text-sm font-semibold text-zinc-750 dark:text-zinc-50">
            {formatMonthYear(viewMonth)}
          </h4>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoToPreviousMonth}
              onClick={() => shiftMonth(-1)}
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 cursor-pointer disabled:opacity-30 dark:hover:bg-zinc-800 "
            >
              <BiChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="flex size-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <BiChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[220px] overflow-y-auto pb-2">
          <MonthGrid
            monthDate={viewMonth}
            today={today}
            selectedDate={selectedDate}
            recurringDateKeys={recurringDateKeys}
            onSelectDate={selectDate}
            showHeading={false}
          />
          <MonthGrid
            monthDate={nextMonth}
            today={today}
            selectedDate={selectedDate}
            recurringDateKeys={recurringDateKeys}
            onSelectDate={selectDate}
            showHeading={false}
          />
        </div>
      </div>

      <div
        className="space-y-3 border-t p-3"
        style={{ borderColor: PICKER_BORDER }}
      >
        <button
          type="button"
          onClick={() => {
            setOpenFooterSubmenu(null);
            setIsTimeMenuOpen((open) => !open);
          }}
          className="flex w-full items-center justify-center mb-2 h-[37px]! gap-2 rounded-full border bg-white py-1 text-[13px] border-[#dedede] text-zinc-600 font-medium transition-colors cursor-pointer"
          style={
            isTimeMenuOpen || dueTimeMinutes !== null
              ? {
                  color: PICKER_ACCENT,
                }
              : {
                  borderColor: PICKER_BORDER,
                  color: PICKER_MUTED_FG,
                }
          }
        >
          <BiTimeFive className="size-4" />
          {timeButtonLabel}
          <BiChevronDown
            className={`size-4 transition-transform ${
              isTimeMenuOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
        {isTimeMenuOpen && onSaveDueTime ? (
          <TaskTimeMenu
            initialDueTime={{
              dueTimeMinutes: normalizeDueTimeMinutes(dueTimeMinutes),
              dueDurationMinutes: dueDurationMinutes ?? null,
              dueTimeZone: normalizeDueTimeZone(dueTimeZone),
            }}
            onSave={(dueTime, options) => {
              onSaveDueTime(dueTime, options);
            }}
          />
        ) : null}
        <TaskReminderMenu
          activeReminder={displayReminder}
          isOpen={openFooterSubmenu === "reminder"}
          onOpenChange={handleReminderMenuOpenChange}
          onSelectReminder={(optionId) => {
            setIsTimeMenuOpen(false);
            setDisplayReminder(optionId);
            onSaveReminder?.(optionId);
          }}
        />
        <TaskRecurrenceMenu
          activeRecurrence={displayRecurrence}
          disabled={!onSaveRecurrence}
          isOpen={openFooterSubmenu === "recurrence"}
          onOpenChange={handleRecurrenceMenuOpenChange}
          onSaveRecurrence={(rule) => {
            setIsTimeMenuOpen(false);
            const previousRecurrence = displayRecurrence;
            setDisplayRecurrence(rule);

            void Promise.resolve(onSaveRecurrence?.(rule)).catch(() => {
              setDisplayRecurrence(previousRecurrence);
            });
          }}
        />
      </div>
    </div>
  );
}
