export type TaskVersionSource = "auto" | "manual" | "revert";

export type TaskVersionListItem = {
  id: string;
  createdAt: string;
  source: TaskVersionSource;
  name: string;
  preview: string;
  isCurrent?: boolean;
};

export function formatTaskVersionTimestamp(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function getTaskVersionSourceLabel(source: TaskVersionSource) {
  switch (source) {
    case "manual":
      return "Manual snapshot";
    case "revert":
      return "Before restore";
    default:
      return "Auto save";
  }
}

export function getTaskVersionSourceBadgeClass(source: TaskVersionSource) {
  switch (source) {
    case "manual":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
    case "revert":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}
