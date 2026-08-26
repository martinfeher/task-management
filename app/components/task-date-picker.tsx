"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BiBlock,
  BiChevronDown,
  BiChevronLeft,
  BiChevronRight,
  BiRevision,
  BiSun,
  BiTimeFive,
} from "react-icons/bi";
import { LuCheck } from "react-icons/lu";
import {
  formatDueTimeLabel,
  formatTime24Hour,
  generateTimeListOptions,
  normalizeDueTimeMinutes,
  normalizeDueTimeZone,
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

type TaskDatePickerProps = {
  dueDate: string | null;
  dueTimeMinutes?: number | null;
  dueDurationMinutes?: number | null;
  dueTimeZone?: string | null;
  recurrenceRule?: string | null;
  onSelectDate: (dateValue: string | null) => void;
  onSaveDueTime?: (dueTime: TaskDueTime) => void;
  onSaveRecurrence?: (rule: TaskRecurrenceRule | null) => void;
  className?: string;
};

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
    <span className="relative flex size-6 items-center justify-center rounded-md bg-emerald-500 text-[11px] font-semibold text-white">
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
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {formatMonthYear(monthDate)}
          </h4>
        </div>
      )}

      {!showHeading && (
        <h4 className="mb-2 px-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {new Intl.DateTimeFormat(undefined, { month: "short" }).format(monthDate)}
        </h4>
      )}

      <div className="grid grid-cols-7 px-2">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="flex h-8 items-center justify-center text-xs font-medium text-zinc-400"
          >
            {label}
          </div>
        ))}

        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-9" />;
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
              className="relative flex h-9 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm ${
                  isSelected
                    ? "bg-zinc-400 font-semibold text-white"
                    : isSunday
                      ? "font-medium text-orange-700"
                      : "text-zinc-600 dark:text-zinc-100"
                }`}
              >
                {day.getDate()}
              </span>
              {isToday && !isSelected ? (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-zinc-400" />
              ) : null}
              {isRecurring && !isSelected ? (
                <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[#4873c7]" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskRecurrenceMenu({
  activeRecurrence,
  disabled,
  onSaveRecurrence,
  onOpenChange,
}: {
  activeRecurrence: TaskRecurrenceRule | null;
  disabled?: boolean;
  onSaveRecurrence: (rule: TaskRecurrenceRule | null) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeOptionId = getRecurrenceMenuSelectionId(activeRecurrence) ?? "none";
  const [draftOptionId, setDraftOptionId] = useState(activeOptionId);
  const triggerLabel = formatRecurrenceLabel(activeRecurrence);
  const hasDraftChanges = draftOptionId !== activeOptionId;
  const showSaveButton = hasDraftChanges && draftOptionId !== "none";

  useEffect(() => {
    setDraftOptionId(activeOptionId);
  }, [activeOptionId]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
    onOpenChange?.(false);
  }

  function handleSelectOption(optionId: string, rule: TaskRecurrenceRule | null) {
    if (optionId === "none") {
      onSaveRecurrence(null);
      setDraftOptionId("none");
      closeMenu();
      return;
    }

    setDraftOptionId(optionId);
    closeMenu();
  }

  function handleSaveDraft() {
    const option = RECURRENCE_MENU_OPTIONS.find(
      (entry) => entry.id === draftOptionId,
    );
    if (!option?.rule) return;

    onSaveRecurrence(option.rule);
    closeMenu();
  }

  return (
    <div ref={menuRef} className="relative space-y-2">
      <button
        type="button"
        disabled={disabled}
        aria-label="Repeat"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (disabled) return;
          setIsOpen((open) => {
            const nextOpen = !open;
            onOpenChange?.(nextOpen);
            return nextOpen;
          });
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          disabled
            ? "cursor-not-allowed border-zinc-200 text-zinc-400 dark:border-zinc-700"
            : isOpen || activeRecurrence || hasDraftChanges
              ? "cursor-pointer border-zinc-200 bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700/80"
              : "cursor-pointer border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <BiRevision
            className="size-4 shrink-0 text-zinc-500"
            aria-hidden="true"
          />
          <span className="truncate">{triggerLabel}</span>
        </span>
        <BiChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label="Repeat options"
          className="absolute bottom-full left-0 right-0 z-30 mb-2 overflow-hidden rounded-[18px] border border-zinc-200/80 bg-white p-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.14)] dark:border-zinc-700 dark:bg-zinc-900"
        >
          {RECURRENCE_MENU_OPTIONS.map((option) => {
            const isSelected = option.id === draftOptionId;

            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelectOption(option.id, option.rule)}
                className={`flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[15px] transition-colors ${
                  isSelected
                    ? "bg-[#bf572b] font-medium text-white"
                    : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                }`}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {isSelected ? (
                    <LuCheck className="size-3.5" aria-hidden="true" />
                  ) : null}
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showSaveButton ? (
        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full rounded-full bg-[#b2b2b2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#a5a5a5] cursor-pointer"
        >
          Save
        </button>
      ) : null}
    </div>
  );
}

function TaskTimeMenu({
  initialDueTime,
  onCancel,
  onSave,
}: {
  initialDueTime: TaskDueTime;
  onCancel: () => void;
  onSave: (dueTime: TaskDueTime) => void;
}) {
  const initialMinutes = normalizeDueTimeMinutes(initialDueTime.dueTimeMinutes);
  const [draftMinutes, setDraftMinutes] = useState<number | null>(initialMinutes);
  const [typedTime, setTypedTime] = useState(() =>
    initialMinutes != null ? formatTime24Hour(initialMinutes) : "",
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialDueTime.dueDurationMinutes,
  );
  const [timeInputError, setTimeInputError] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const timeOptions = useMemo(() => generateTimeListOptions(), []);

  useEffect(() => {
    if (draftMinutes == null || !listRef.current) return;

    const selectedRow = listRef.current.querySelector(
      `[data-minutes="${draftMinutes}"]`,
    );
    selectedRow?.scrollIntoView({ block: "center" });
  }, [draftMinutes]);

  function selectTime(minutes: number) {
    setDraftMinutes(minutes);
    setTypedTime(formatTime24Hour(minutes));
    setTimeInputError(false);
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

  function handleSave() {
    if (typedTime.trim() && !commitTypedTime()) {
      return;
    }

    const minutes = resolveDraftMinutes();
    if (minutes === null) return;

    onSave({
      dueTimeMinutes: minutes,
      dueDurationMinutes: durationMinutes,
      dueTimeZone: initialDueTime.dueTimeZone,
    });
  }

  function handleClearTime() {
    onSave({
      dueTimeMinutes: null,
      dueDurationMinutes: null,
      dueTimeZone: initialDueTime.dueTimeZone,
    });
  }

  const canSave = resolveDraftMinutes() !== null;

  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-700">
        <div
          className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-2 dark:bg-zinc-900 ${
            timeInputError
              ? "border-red-300 dark:border-red-700"
              : "border-zinc-200 dark:border-zinc-700"
          }`}
        >
          <BiTimeFive
            className="size-4 shrink-0 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={typedTime}
            onChange={(event) => {
              setTypedTime(event.target.value);
              if (timeInputError) setTimeInputError(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitTypedTime();
              }
            }}
            onBlur={() => {
              commitTypedTime();
            }}
            placeholder="Type a time — 9, 930, 6pm"
            aria-invalid={timeInputError}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
          />
        </div>
        {timeInputError ? (
          <p className="mt-1.5 text-xs text-red-500">
            Enter a valid time, e.g. 9, 930, 6pm, or 09:00
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-zinc-200 px-3 py-3 dark:border-zinc-700">
        {TIME_PRESETS.map((preset) => {
          const isSelected = draftMinutes === preset.minutes;

          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectTime(preset.minutes)}
              className={`rounded-full border px-3 py-1.5 text-left text-[11.5px] transition-colors cursor-pointer ${
                isSelected
                  ? "border-[#4873c7] bg-[#eef3fc] text-zinc-900 dark:border-[#7da2ff] dark:bg-[#1e293b] dark:text-zinc-50"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
              }`}
            >
              <span className="font-medium">{preset.label}</span>{" "}
              <span className="text-zinc-500 dark:text-zinc-400">
                {formatTime24Hour(preset.minutes)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        ref={listRef}
        className="max-h-[148px] overflow-y-auto border-b border-zinc-200 dark:border-zinc-700"
      >
        {timeOptions.map((minutes) => {
          const isSelected = draftMinutes === minutes;

          return (
            <button
              key={minutes}
              type="button"
              data-minutes={minutes}
              onClick={() => selectTime(minutes)}
              className={`flex w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#eef3fc] font-medium text-zinc-900 dark:bg-[#1e293b] dark:text-zinc-50"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
              }`}
            >
              {formatTime24Hour(minutes)}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 border-b border-zinc-200 px-3 py-3 dark:border-zinc-700">
        <p className="text-sm font-semibold text-[#6b7f99] dark:text-zinc-400">
          Duration
        </p>
        <div className="flex flex-wrap gap-2">
          {TIME_PICKER_DURATION_OPTIONS.map((option) => {
            const isSelected = durationMinutes === option.value;

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => setDurationMinutes(option.value)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                  isSelected
                    ? "border-[#4873c7] bg-[#eef3fc] text-zinc-900 dark:border-[#7da2ff] dark:bg-[#1e293b] dark:text-zinc-50"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <button
          type="button"
          onClick={handleClearTime}
          className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
        >
          Clear time
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-lg bg-[#dc4c3e] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#c53727] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
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
  const activeRecurrence = parseRecurrenceRule(recurrenceRule);
  const [displayRecurrence, setDisplayRecurrence] =
    useState<TaskRecurrenceRule | null>(activeRecurrence);
  const timeButtonLabel =
    formatDueTimeLabel(dueTimeMinutes) ?? "Time";

  useEffect(() => {
    setDisplayRecurrence(activeRecurrence);
  }, [recurrenceRule]);

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

  return (
    <div
      className={`relative z-50 w-[280px] overflow-visible bg-white dark:bg-zinc-900 ${
        className ??
        "rounded-xl border border-zinc-200 shadow-xl dark:border-zinc-700"
      } ${isTimeMenuOpen ? "min-h-[720px]" : ""}`}
    >
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <input
          type="text"
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
            isDateInputFocused ? activeFormat.placeholder : "Type a date"
          }
          aria-invalid={dateInputError}
          className={`w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-50 cursor-pointer ${
            dateInputError
              ? "text-red-600 placeholder:text-red-300"
              : "text-zinc-900"
          }`}
        />
        {dateInputError && (
          <p className="mt-1 text-xs text-red-500">
            Enter a valid future date, e.g. {activeFormat.example}
          </p>
        )}
      </div>

      <div className="py-1 text-[#444444]">
        {quickOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => selectDate(option.date)}
            className="flex w-full text-[12px] items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
          >
            {/* <span className="flex w-6 shrink-0 items-center justify-center">
              {option.icon}
            </span> */}
            <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">
              {option.label}
            </span>
            <span className="text-sm text-zinc-400">{option.hint}</span>
          </button>
        ))}

        {dueDate ? (
          <button
            type="button"
            onClick={() => {
              onSelectDate(null);
              setTypedDate("");
              setDateInputError(false);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer"
          >
            <BiBlock className="size-[18px] shrink-0 text-zinc-400" aria-hidden="true" />
            <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">
              No Date
            </span>
          </button>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
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

      <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-700">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTimeMenuOpen((open) => !open)}
            className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              isTimeMenuOpen || dueTimeMinutes !== null
                ? "border-zinc-300 bg-zinc-50 text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
            }`}
          >
            <BiTimeFive className="size-4" />
            {timeButtonLabel}
          </button>

          {isTimeMenuOpen && onSaveDueTime ? (
            <TaskTimeMenu
              initialDueTime={{
                dueTimeMinutes: normalizeDueTimeMinutes(dueTimeMinutes),
                dueDurationMinutes: dueDurationMinutes ?? null,
                dueTimeZone: normalizeDueTimeZone(dueTimeZone),
              }}
              onCancel={() => setIsTimeMenuOpen(false)}
              onSave={(dueTime) => {
                onSaveDueTime(dueTime);
                setIsTimeMenuOpen(false);
              }}
            />
          ) : null}
        </div>
        <TaskRecurrenceMenu
          activeRecurrence={displayRecurrence}
          disabled={!onSaveRecurrence}
          onOpenChange={(open) => {
            if (open) setIsTimeMenuOpen(false);
          }}
          onSaveRecurrence={(rule) => {
            setIsTimeMenuOpen(false);
            setDisplayRecurrence(rule);
            onSaveRecurrence?.(rule);
          }}
        />
      </div>
    </div>
  );
}
