"use client";

import { useEffect, useMemo, useRef } from "react";
import { BiSearch } from "react-icons/bi";
import { LuCheck, LuInbox, LuList } from "react-icons/lu";
import type { TodoList } from "./todo-app";
import { taskContextMenuTextColor } from "@/lib/task-context-menu-colors";

type TaskMoveToSelectorProps = {
  lists: TodoList[];
  currentListId: string | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectList: (listId: string) => void;
  onCancel: () => void;
  showCurrentList?: boolean;
  autoFocus?: boolean;
  tone?: "default" | "contextMenu";
};

function getListIcon(name: string) {
  if (name.trim().toLowerCase() === "inbox") {
    return LuInbox;
  }

  return LuList;
}

export function TaskMoveToSelector({
  lists,
  currentListId,
  query,
  onQueryChange,
  onSelectList,
  onCancel,
  showCurrentList = false,
  autoFocus = true,
  tone = "default",
}: TaskMoveToSelectorProps) {
  const isContextMenuTone = tone === "contextMenu";
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!autoFocus) return;

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [autoFocus]);

  const filteredLists = useMemo(() => {
    const candidates = showCurrentList
      ? lists
      : lists.filter((list) => list.id !== currentListId);
    const normalized = trimmedQuery.toLowerCase();
    if (!normalized) return candidates;

    return candidates.filter((list) =>
      list.name.toLowerCase().includes(normalized),
    );
  }, [currentListId, lists, showCurrentList, trimmedQuery]);

  return (
    <div
      role="dialog"
      aria-label="Move to list"
      className="w-[240px] overflow-hidden rounded-3xl bg-white shadow-[0_12px_32px_rgba(0,0,0,0.12)] dark:bg-zinc-900 dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)]"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <BiSearch
            className={`size-4 shrink-0 ${isContextMenuTone ? "" : "text-zinc-400"}`}
            style={
              isContextMenuTone
                ? taskContextMenuTextColor("icon400")
                : undefined
            }
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search"
            aria-label="Search lists"
            className={`min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-zinc-50 ${
              isContextMenuTone
                ? "placeholder:text-[#acacb4]"
                : "text-zinc-900 placeholder:text-zinc-400"
            }`}
            style={
              isContextMenuTone
                ? taskContextMenuTextColor("textPrimary")
                : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
          />
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto py-1">
        {filteredLists.length === 0 ? (
          <p
            className={`px-4 py-3 text-sm dark:text-zinc-500 ${
              isContextMenuTone ? "" : "text-zinc-400"
            }`}
            style={
              isContextMenuTone
                ? taskContextMenuTextColor("icon400")
                : undefined
            }
          >
            {trimmedQuery ? "No matching lists" : "No lists"}
          </p>
        ) : (
          filteredLists.map((list) => {
            const Icon = getListIcon(list.name);
            const isCurrent = list.id === currentListId;

            return (
              <button
                key={list.id}
                type="button"
                disabled={showCurrentList && isCurrent}
                onClick={() => onSelectList(list.id)}
                className={`flex h-[38px] w-full items-center gap-2.5 px-4 text-left text-sm transition-colors ${
                  showCurrentList && isCurrent
                    ? "cursor-default text-[#4873c7] dark:text-[#7da2ff]"
                    : isContextMenuTone
                      ? "hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                      : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
                }`}
                style={
                  isContextMenuTone && !(showCurrentList && isCurrent)
                    ? taskContextMenuTextColor("textSecondary")
                    : undefined
                }
              >
                <Icon
                  className={`size-4 shrink-0 ${
                    showCurrentList && isCurrent
                      ? "text-[#4873c7] dark:text-[#7da2ff]"
                      : isContextMenuTone
                        ? "dark:text-zinc-400"
                        : "text-zinc-500 dark:text-zinc-400"
                  }`}
                  style={
                    isContextMenuTone && !(showCurrentList && isCurrent)
                      ? taskContextMenuTextColor("icon500")
                      : undefined
                  }
                />
                <span className="min-w-0 flex-1 truncate">{list.name}</span>
                {showCurrentList && isCurrent ? (
                  <LuCheck className="size-4 shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
