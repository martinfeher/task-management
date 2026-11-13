"use client";

import type { ReactNode } from "react";

export const SEARCH_MODAL_HIGHLIGHT_CLASS =
  "rounded-[2px] bg-[#f5fcd0] dark:bg-zinc-700";

export const CALENDAR_SIDEBAR_SEARCH_HIGHLIGHT_CLASS =
  "rounded-[2px] bg-zinc-200 dark:bg-zinc-600";

export function highlightSearchMatch(
  text: string,
  query: string,
  highlightClassName: string = SEARCH_MODAL_HIGHLIGHT_CLASS,
): ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);

  while (matchIndex !== -1) {
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    parts.push(
      <span
        key={matchIndex}
        className={highlightClassName}
      >
        {text.slice(matchIndex, matchIndex + lowerQuery.length)}
      </span>,
    );

    lastIndex = matchIndex + lowerQuery.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
