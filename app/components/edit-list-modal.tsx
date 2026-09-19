"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LuChevronDown, LuList } from "react-icons/lu";
import {
  DEFAULT_LIST_COLOR,
  LIST_COLOR_PRESETS,
  getListColor,
  normalizeListColorHex,
} from "@/lib/list-colors";
import type { ListFolder, TodoList } from "./todo-app";

export type ListViewMode = "stack" | "kanban";

export type EditListModalValues = {
  name: string;
  folderId: string | null;
  color: string | null;
  viewMode: ListViewMode;
};

type EditListModalProps = {
  open: boolean;
  list: TodoList | null;
  folders: ListFolder[];
  onConfirm: (values: EditListModalValues) => void;
  onCancel: () => void;
};

const LIST_MODAL_ANIMATION_MS = 200;

const fieldControlClassName =
  "h-[35px] min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

export function EditListModal({
  open,
  list,
  folders,
  onConfirm,
  onCancel,
}: EditListModalProps) {
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ListViewMode>("stack");
  const [isMounted, setIsMounted] = useState(open);
  const [isEntered, setIsEntered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const selectedColor = color ? normalizeListColorHex(color) : DEFAULT_LIST_COLOR;

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
    const timeout = window.setTimeout(() => {
      setIsMounted(false);
    }, LIST_MODAL_ANIMATION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !list) return;

    setName(list.name);
    setFolderId(list.folderId ?? null);
    setColor(list.color ?? null);
    setViewMode(list.viewMode ?? "stack");

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open, list]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    onConfirm({
      name: name.trim(),
      folderId,
      color,
      viewMode,
    });
  }

  if (!isMounted || !list) return null;

  return (
    <div
      className={`list-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isEntered ? "is-entered" : ""
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-list-modal-title"
        onSubmit={handleSubmit}
        className="list-name-modal-panel w-full max-w-md bg-white p-5 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2">
          <LuList
            className="size-[18px] shrink-0"
            style={{ color: selectedColor }}
            aria-hidden="true"
          />
          <h2
            id="edit-list-modal-title"
            className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Edit list
          </h2>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex items-center gap-3">
            <span
              className="w-[72px] shrink-0 text-sm"
              style={{ color: selectedColor }}
            >
              List title
            </span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="List name"
              className={fieldControlClassName}
            />
          </label>

          <label className="flex items-center gap-3">
            <span
              className="w-[72px] shrink-0 text-sm"
              style={{ color: selectedColor }}
            >
              Folder
            </span>
            <div className="relative min-w-0 flex-1">
              <select
                value={folderId ?? ""}
                onChange={(event) =>
                  setFolderId(event.target.value ? event.target.value : null)
                }
                className={`${fieldControlClassName} appearance-none pr-8`}
              >
                <option value="">None</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <LuChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
            </div>
          </label>

          <div>
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">View</p>
            <div className="flex gap-2 w-[220px]">
              <button
                type="button"
                aria-pressed={viewMode === "stack"}
                onClick={() => setViewMode("stack")}
                className={`h-[33px] flex-1 rounded-md border px-3 text-sm transition-colors cursor-pointer ${
                  viewMode === "stack"
                    ? "border-zinc-600 bg-zinc-500 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                Task stack
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "kanban"}
                onClick={() => setViewMode("kanban")}
                className={`h-[33px] flex-1 rounded-md border px-3 text-sm transition-colors cursor-pointer ${
                  viewMode === "kanban"
                    ? "border-zinc-900 bg-zinc-700 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                }`}
              >
                Kanban
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">Color</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Use default list color"
                className={`size-7 rounded-full border transition-transform hover:scale-110 ${
                  !color
                    ? "ring-2 ring-zinc-300 ring-offset-1 dark:ring-zinc-600"
                    : "border-zinc-200 dark:border-zinc-600"
                }`}
                style={{ backgroundColor: DEFAULT_LIST_COLOR }}
                onClick={() => setColor(null)}
              />
              {LIST_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Set list color ${preset}`}
                  className={`size-7 rounded-full border border-zinc-200 transition-transform hover:scale-110 dark:border-zinc-600 ${
                    color && normalizeListColorHex(color) === preset
                      ? "ring-2 ring-zinc-300 ring-offset-1 dark:ring-zinc-600"
                      : ""
                  }`}
                  style={{ backgroundColor: preset }}
                  onClick={() => setColor(preset)}
                />
              ))}
              <button
                type="button"
                aria-label="Pick custom list color"
                className="flex size-7 items-center justify-center rounded-full border border-dashed border-zinc-300 text-xs text-zinc-500 transition-transform hover:scale-110 dark:border-zinc-600 dark:text-zinc-400"
                onClick={() => colorInputRef.current?.click()}
              >
                +
              </button>
              <input
                ref={colorInputRef}
                type="color"
                aria-label="Pick custom list color"
                value={selectedColor}
                onChange={(event) => setColor(event.target.value)}
                className="sr-only"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-[35px] rounded-md px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer!"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-[35px] rounded-md bg-zinc-500 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer!"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
