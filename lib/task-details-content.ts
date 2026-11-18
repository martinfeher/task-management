const EMPTY_DETAILS_HTML = new Set([
  "",
  "<br>",
  "<div><br></div>",
  "<p><br></p>",
]);

export function taskDetailsToPlainText(details: string) {
  if (!details.trim()) return "";

  return details
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\u00a0|\u200B/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToTaskDetails(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  return trimmed
    .split("\n")
    .map(
      (line) =>
        `<div class="detail-line" data-line-type="text">${line ? escapeHtml(line) : "<br>"}</div>`,
    )
    .join("");
}

const TASK_IMAGE_URL_PATTERN =
  /\/api\/task-images\/[a-z0-9]+\/[a-z0-9-]+\.(?:jpe?g|png|gif|webp|svg)/gi;

/** Stored task image URLs referenced in details HTML, in document order (unique). */
export function extractTaskDetailImageSrcs(details: string): string[] {
  if (!details || !details.includes("/api/task-images/")) return [];

  const srcs: string[] = [];
  const seen = new Set<string>();

  for (const match of details.matchAll(TASK_IMAGE_URL_PATTERN)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    srcs.push(match[0]);
  }

  return srcs;
}

export function taskDetailsHasContent(details: string) {
  const trimmed = details.trim();
  if (!trimmed || EMPTY_DETAILS_HTML.has(trimmed)) {
    return false;
  }

  if (
    trimmed.includes("detail-image-wrapper") ||
    /<img[\s>]/i.test(trimmed)
  ) {
    return true;
  }

  const text = trimmed
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0|\u200B/g, " ")
    .trim();

  return text.length > 0;
}

type ResolveTaskDetailsForSaveOptions = {
  /** When true, an intentional clear (empty body) is persisted. */
  allowClear?: boolean;
};

/** Avoid overwriting meaningful saved details with an empty snapshot during load. */
export function shouldPersistTaskDetails(
  nextDetails: string,
  savedDetails: string,
  options?: ResolveTaskDetailsForSaveOptions,
) {
  if (nextDetails === savedDetails) return false;

  if (
    !options?.allowClear &&
    !taskDetailsHasContent(nextDetails) &&
    taskDetailsHasContent(savedDetails)
  ) {
    return false;
  }

  return true;
}

export function resolveTaskDetailsForSave(
  nextDetails: string,
  savedDetails: string,
  options?: ResolveTaskDetailsForSaveOptions,
) {
  return shouldPersistTaskDetails(nextDetails, savedDetails, options)
    ? nextDetails
    : savedDetails;
}
