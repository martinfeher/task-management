import { useMemo, useState } from "react";
import {
  Calendar,
  CalendarOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Repeat,
  Sun,
  Sunrise,
  Sunset,
  Moon,
} from "lucide-react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

function buildMonth(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const days: (Date | null)[] = Array.from({ length: offset }, () => null);
  const total = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= total; i++) days.push(new Date(year, month, i));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const PRESET_TIMES = [
  { label: "Morning", value: "09:00", Icon: Sunrise },
  { label: "Midday", value: "12:00", Icon: Sun },
  { label: "Afternoon", value: "15:00", Icon: Sunset },
  { label: "Evening", value: "18:00", Icon: Moon },
];

const DURATIONS = ["None", "15m", "30m", "1h", "2h"];
const REPEATS = ["Does not repeat", "Daily", "Weekly", "Monthly", "Yearly"];

const SLOTS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);

function formatDate(d: Date | null) {
  if (!d) return "No date";
  return `${d.getDate()} ${(MONTHS[d.getMonth()] ?? "").slice(0, 3)} ${d.getFullYear()}`;
}

function to12h(t: string) {
  const parts = t.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${suffix}`;
}


export function DateTimePicker() {
  const today = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(true);
  const [date, setDate] = useState<Date | null>(today);
  const [time, setTime] = useState<string | null>("22:30");
  const [duration, setDuration] = useState("None");
  const [repeat, setRepeat] = useState(REPEATS[0]);
  const [timeOpen, setTimeOpen] = useState(false);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [query, setQuery] = useState("");

  const days = useMemo(() => buildMonth(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const shiftMonth = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="relative w-full max-w-[26rem]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 text-left shadow-soft transition hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Calendar className="size-4 text-accent" strokeWidth={2.2} />
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Date
        </span>
        <span className="text-sm font-medium text-foreground">{formatDate(date)}</span>
        {time && (
          <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            {to12h(time)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover shadow-float">
          <div className="border-b border-border p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a date — e.g. next friday"
              className="w-full rounded-xl bg-muted px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          <div className="flex gap-2 border-b border-border p-3">
            {[
              { label: "Today", sub: "Thu", onClick: () => setDate(today) },
              { label: "Tomorrow", sub: "Fri", onClick: () => setDate(addDays(today, 1)) },
            ].map((q) => (
              <button
                key={q.label}
                onClick={q.onClick}
                className="flex-1 rounded-xl border border-border px-3 py-2 text-left transition hover:border-accent hover:bg-accent-soft"
              >
                <span className="block text-sm font-medium text-foreground">{q.label}</span>
                <span className="block text-xs text-muted-foreground">{q.sub}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setDate(null);
                setTime(null);
              }}
              className="rounded-xl border border-border px-3 text-muted-foreground transition hover:border-destructive hover:text-destructive"
              aria-label="No date"
            >
              <CalendarOff className="size-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  onClick={() => shiftMonth(1)}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Next month"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </span>
              ))}
              {days.map((d, i) => {
                if (!d) return <span key={i} />;
                const selected = date && sameDay(d, date);
                const isToday = sameDay(d, today);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <button
                    key={i}
                    onClick={() => setDate(d)}
                    className={[
                      "relative mx-auto my-0.5 flex size-9 items-center justify-center rounded-full text-sm transition",
                      selected
                        ? "bg-accent font-semibold text-accent-foreground"
                        : weekend
                          ? "text-destructive hover:bg-muted"
                          : "text-foreground hover:bg-muted",
                    ].join(" ")}
                  >
                    {d.getDate()}
                    {isToday && !selected && (
                      <span className="absolute bottom-1 size-1 rounded-full bg-accent" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <button
              onClick={() => setTimeOpen((t) => !t)}
              className={[
                "flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition",
                time
                  ? "border-accent bg-[#dfdfdf] text-accent"
                  : "border-border text-muted-foreground hover:border-accent hover:text-accent",
              ].join(" ")}
            >
              <Clock className="size-4" />
              {time ? to12h(time) : "Add time"}
              <ChevronDown
                className={`size-4 transition-transform ${timeOpen ? "rotate-180" : ""}`}
              />
            </button>

            {timeOpen && (
              <div className="mt-3 space-y-3 rounded-2xl border border-border bg-card p-3">
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_TIMES.map(({ label, value, Icon }) => (
                    <button
                      key={label}
                      onClick={() => setTime(value)}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition",
                        time === value
                          ? "border-accent bg-accent-soft"
                          : "border-border hover:border-accent",
                      ].join(" ")}
                    >
                      <Icon className="size-4 text-accent" />
                      <span className="text-sm text-foreground">{label}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{value}</span>
                    </button>
                  ))}
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-border">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTime(s)}
                      className={[
                        "block w-full px-3 py-1.5 text-left text-sm transition",
                        time === s
                          ? "bg-accent-soft font-semibold text-accent"
                          : "text-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div>
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Duration
                  </span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          duration === d
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-border text-foreground hover:border-accent",
                        ].join(" ")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 rounded-full border border-border px-3 py-2">
              <Repeat className="size-4 text-muted-foreground" />
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground focus:outline-none"
              >
                {REPEATS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border bg-muted/60 p-3">
            <button
              onClick={() => setTime(null)}
              className="text-xs font-medium text-muted-foreground transition hover:text-destructive"
            >
              Clear time
            </button>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground shadow-soft transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
