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
