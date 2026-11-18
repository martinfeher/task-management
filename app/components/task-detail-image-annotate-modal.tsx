"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuCheck,
  LuMinus,
  LuPlus,
  LuTrash2,
  LuType,
  LuX,
} from "react-icons/lu";
import { getCropOutputMimeType } from "@/lib/image-crop";
import {
  ANNOTATION_COLORS,
  ANNOTATION_FONT_FAMILY,
  ANNOTATION_FONT_SIZES,
  ANNOTATION_FONT_WEIGHT,
  ANNOTATION_LINE_HEIGHT,
  DEFAULT_ANNOTATION_COLOR,
  DEFAULT_ANNOTATION_FONT_SIZE,
  annotationFontPx,
  renderAnnotatedImage,
  type RenderedAnnotation,
  type TextAnnotation,
} from "@/lib/image-annotate";
import { TASK_DETAILS_HEADER_ICON_HOVER_CLASS } from "@/lib/task-details-header-icon-hover";

/** Above the image lightbox (`z-[10070]`) and calendar task modal. */
const TASK_DETAIL_IMAGE_ANNOTATE_Z_CLASS = "z-[10080]";
const STAGE_PADDING_PX = 28;
const MAX_UPSCALE = 3;
/** Zoom is relative to the "fit in window" size (1 = fit). */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type DragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  startItemX: number;
  startItemY: number;
};

type TaskDetailImageAnnotateModalProps = {
  src: string;
  onCancel: () => void;
  /** Resolve once the annotated image has been stored; the parent then closes the modal. */
  onApply: (result: RenderedAnnotation) => Promise<void>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFormField(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function TaskDetailImageAnnotateModal({
  src,
  onCancel,
  onApply,
}: TaskDetailImageAnnotateModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextIdRef = useRef(1);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [items, setItems] = useState<TextAnnotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [color, setColor] = useState<string>(DEFAULT_ANNOTATION_COLOR);
  const [fontSize, setFontSize] = useState<number>(
    DEFAULT_ANNOTATION_FONT_SIZE,
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [zoom, setZoom] = useState(1);

  const fitScale =
    natural && stageSize.w > 0 && stageSize.h > 0
      ? Math.min(stageSize.w / natural.w, stageSize.h / natural.h, MAX_UPSCALE)
      : 1;
  const scale = fitScale * zoom;

  const changeZoom = useCallback((delta: number) => {
    setZoom((current) =>
      clamp(Math.round((current + delta) * 100) / 100, MIN_ZOOM, MAX_ZOOM),
    );
  }, []);
  const displayWidth = natural ? natural.w * scale : 0;
  const displayHeight = natural ? natural.h * scale : 0;

  const filledItems = items.filter((item) => item.text.trim() !== "");
  const canApply = Boolean(natural) && filledItems.length > 0;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function measure() {
      if (!stage) return;
      setStageSize({
        w: Math.max(0, stage.clientWidth - STAGE_PADDING_PX * 2),
        h: Math.max(0, stage.clientHeight - STAGE_PADDING_PX * 2),
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingId === null) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.select();
  }, [editingId]);

  const stopEditing = useCallback(() => {
    if (editingId === null) return;

    const id = editingId;
    const item = items.find((candidate) => candidate.id === id);
    setEditingId(null);

    if (item && item.text.trim() === "") {
      setItems((prev) => prev.filter((candidate) => candidate.id !== id));
      setSelectedId((current) => (current === id ? null : current));
    }
  }, [editingId, items]);

  const startEditing = useCallback((id: string) => {
    setSelectedId(id);
    setEditingId(id);
  }, []);

  const selectItem = useCallback((item: TextAnnotation) => {
    setSelectedId(item.id);
    setColor(item.color);
    setFontSize(item.fontSize);
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<Pick<TextAnnotation, "color" | "fontSize">>) => {
      if (selectedId === null) return;
      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId ? { ...item, ...patch } : item,
        ),
      );
      if (editingId !== null) {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [editingId, selectedId],
  );

  const deleteSelected = useCallback(() => {
    if (selectedId === null) return;
    const id = selectedId;
    setEditingId((current) => (current === id ? null : current));
    setSelectedId(null);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, [selectedId]);

  const handleApply = useCallback(async () => {
    const image = imageRef.current;
    if (!image || !natural || isApplying) return;

    const toRender = items.filter((item) => item.text.trim() !== "");
    if (toRender.length === 0) return;

    setEditingId(null);
    setIsApplying(true);
    setErrorMessage(null);

    try {
      const result = await renderAnnotatedImage(
        image,
        toRender,
        getCropOutputMimeType(src),
      );
      await onApply(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not annotate this image.",
      );
      setIsApplying(false);
    }
  }, [isApplying, items, natural, onApply, src]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (editingId !== null) {
          stopEditing();
        } else if (!isApplying) {
          onCancel();
        }
        return;
      }

      if (isApplying) return;

      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        void handleApply();
        return;
      }

      if (editingId !== null) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          stopEditing();
        }
        return;
      }

      if (selectedId === null || isFormField(event.target)) return;

      if (event.key === "Enter") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        event.stopPropagation();
        startEditing(selectedId);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        deleteSelected();
        return;
      }

      if (
        !natural ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const step = (event.shiftKey ? 10 : 1) / scale;
      const dx =
        event.key === "ArrowLeft"
          ? -step
          : event.key === "ArrowRight"
            ? step
            : 0;
      const dy =
        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                x: clamp(item.x + dx, 0, natural.w - 4),
                y: clamp(item.y + dy, 0, natural.h - 4),
              }
            : item,
        ),
      );
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [
    deleteSelected,
    editingId,
    handleApply,
    isApplying,
    natural,
    onCancel,
    scale,
    selectedId,
    startEditing,
    stopEditing,
  ]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) {
      setErrorMessage("Could not load this image.");
      return;
    }

    setNatural({ w: naturalWidth, h: naturalHeight });
  }

  function handleOverlayPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !natural || isApplying) return;
    if (event.target !== event.currentTarget) return;

    // Keep focus where it is (prevents the textarea from blurring mid-click).
    event.preventDefault();

    if (editingId !== null) {
      stopEditing();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const fontPx = annotationFontPx(fontSize, natural.w);
    const id = `annotation-${nextIdRef.current++}`;
    const item: TextAnnotation = {
      id,
      text: "",
      x: clamp((event.clientX - rect.left) / scale, 0, natural.w - 4),
      y: clamp(
        (event.clientY - rect.top) / scale -
          (fontPx * ANNOTATION_LINE_HEIGHT) / 2,
        0,
        natural.h - 4,
      ),
      fontSize,
      color,
    };

    setItems((prev) => [...prev, item]);
    setSelectedId(id);
    setEditingId(id);
  }

  function getItemDragProps(item: TextAnnotation) {
    return {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || isApplying) return;
        event.preventDefault();
        event.stopPropagation();

        if (editingId !== null && editingId !== item.id) stopEditing();

        event.currentTarget.setPointerCapture(event.pointerId);
        selectItem(item);
        setDrag({
          id: item.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startItemX: item.x,
          startItemY: item.y,
        });
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (!drag || drag.pointerId !== event.pointerId || !natural) return;

        const dx = (event.clientX - drag.startX) / scale;
        const dy = (event.clientY - drag.startY) / scale;

        setItems((prev) =>
          prev.map((candidate) =>
            candidate.id === drag.id
              ? {
                  ...candidate,
                  x: clamp(drag.startItemX + dx, 0, natural.w - 4),
                  y: clamp(drag.startItemY + dy, 0, natural.h - 4),
                }
              : candidate,
          ),
        );
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        if (drag?.pointerId !== event.pointerId) return;
        setDrag(null);
      },
      onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
        if (drag?.pointerId !== event.pointerId) return;
        setDrag(null);
      },
    };
  }

  function getItemTextStyle(item: TextAnnotation): React.CSSProperties {
    return {
      fontSize: natural ? annotationFontPx(item.fontSize, displayWidth) : 0,
      color: item.color,
      lineHeight: ANNOTATION_LINE_HEIGHT,
      fontWeight: ANNOTATION_FONT_WEIGHT,
      fontFamily: ANNOTATION_FONT_FAMILY,
      whiteSpace: "pre",
    };
  }

  // Dialog events must not reach the editor (React bubbles through portals).
  const stopReactPropagation = (event: React.SyntheticEvent) =>
    event.stopPropagation();

  return createPortal(
    <div
      className={`task-detail-image-annotate-overlay fixed inset-0 ${TASK_DETAIL_IMAGE_ANNOTATE_Z_CLASS} flex items-center justify-center bg-zinc-950/55 px-4 py-[1.5vh] backdrop-blur-[3px]`}
      role="dialog"
      aria-modal="true"
      aria-label="Add text to image"
      onMouseDown={stopReactPropagation}
      onClick={stopReactPropagation}
      onDoubleClick={stopReactPropagation}
      onKeyDown={stopReactPropagation}
      onKeyUp={stopReactPropagation}
      onPaste={stopReactPropagation}
      onCopy={stopReactPropagation}
      onCut={stopReactPropagation}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex h-[97vh] max-h-[97vh] w-full max-w-[920px] flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-5 py-2 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <LuType className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                Add text
              </h2>
              <p className="truncate text-[11px] text-zinc-400 dark:text-zinc-400">
                Click the image to add text. Drag to move, double-click to edit.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close annotate dialog"
            onClick={onCancel}
            disabled={isApplying}
            className={`flex size-[29px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-200/30 text-zinc-500 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100 ${TASK_DETAILS_HEADER_ICON_HOVER_CLASS}`}
          >
            <LuX className="size-[15px]" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={stageRef}
          className="relative min-h-0 flex-1 select-none overflow-hidden bg-[#1c1c20]"
        >
          <div className="absolute inset-0 overflow-auto">
            <div
              className="flex min-h-full min-w-full"
              style={{ padding: STAGE_PADDING_PX }}
            >
              <div
                className="relative m-auto shrink-0"
                style={{
                  width: natural ? displayWidth : 1,
                  height: natural ? displayHeight : 1,
                  opacity: natural ? 1 : 0,
                  backgroundColor: "#2e2e33",
                  backgroundImage:
                    "conic-gradient(#3a3a40 25%, transparent 0 50%, #3a3a40 0 75%, transparent 0)",
                  backgroundSize: "16px 16px",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded task detail URLs */}
                <img
                  ref={imageRef}
                  src={src}
                  alt=""
                  draggable={false}
                  onLoad={handleImageLoad}
                  onError={() => setErrorMessage("Could not load this image.")}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />

                <div
                  ref={overlayRef}
                  className="absolute inset-0 cursor-crosshair touch-none overflow-hidden"
                  onPointerDown={handleOverlayPointerDown}
                >
                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    const positionStyle = {
                      left: item.x * scale,
                      top: item.y * scale,
                    };

                    if (item.id === editingId) {
                      return (
                        <div
                          key={item.id}
                          className="absolute inline-grid min-w-[1ch] outline outline-1 outline-offset-2 outline-white/90"
                          style={{
                            ...positionStyle,
                            ...getItemTextStyle(item),
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <div
                            aria-hidden="true"
                            className="invisible col-start-1 row-start-1"
                            style={{ whiteSpace: "pre" }}
                          >
                            {`${item.text}\u200b`}
                          </div>
                          <textarea
                            ref={textareaRef}
                            value={item.text}
                            rows={1}
                            spellCheck={false}
                            aria-label="Annotation text"
                            placeholder="Type…"
                            onChange={(event) => {
                              const text = event.target.value;
                              setItems((prev) =>
                                prev.map((candidate) =>
                                  candidate.id === item.id
                                    ? { ...candidate, text }
                                    : candidate,
                                ),
                              );
                            }}
                            className="col-start-1 row-start-1 m-0 w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none placeholder:text-white/50"
                            style={{
                              font: "inherit",
                              lineHeight: "inherit",
                              color: "inherit",
                              caretColor: item.color,
                              whiteSpace: "pre",
                            }}
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className={`absolute cursor-move touch-none ${
                          isSelected
                            ? "outline outline-1 outline-offset-2 outline-white/90"
                            : "hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-white/50"
                        }`}
                        style={{
                          ...positionStyle,
                          ...getItemTextStyle(item),
                        }}
                        onDoubleClick={() => startEditing(item.id)}
                        {...getItemDragProps(item)}
                      >
                        {item.text}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {!natural && !errorMessage ? (
            <p className="absolute text-sm text-zinc-400">Loading image…</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-zinc-200 px-5 py-[10.5px] dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Color
            </span>
            {ANNOTATION_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Text color ${swatch}`}
                aria-pressed={color.toLowerCase() === swatch}
                disabled={isApplying}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setColor(swatch);
                  updateSelected({ color: swatch });
                }}
                className={`size-[21px] cursor-pointer rounded-full border border-zinc-300 transition-shadow disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 ${
                  color.toLowerCase() === swatch
                    ? "ring-2 ring-zinc-900 ring-offset-1 dark:ring-zinc-100 dark:ring-offset-zinc-900"
                    : "hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-600"
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <label
              className="relative flex size-[21px] cursor-pointer items-center justify-center overflow-hidden rounded-full border border-zinc-300 dark:border-zinc-600"
              title="Custom color"
              style={{
                background:
                  "conic-gradient(#ef4444, #facc15, #22c55e, #3b82f6, #a855f7, #ef4444)",
              }}
            >
              <input
                type="color"
                aria-label="Custom text color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : "#000000"}
                disabled={isApplying}
                onChange={(event) => {
                  setColor(event.target.value);
                  updateSelected({ color: event.target.value });
                }}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="task-detail-image-annotate-size"
              className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400"
            >
              Size
            </label>
            <select
              id="task-detail-image-annotate-size"
              value={fontSize}
              disabled={isApplying}
              onChange={(event) => {
                const next = Number(event.target.value);
                setFontSize(next);
                updateSelected({ fontSize: next });
              }}
              className="cursor-pointer rounded-full border border-zinc-200 bg-white px-2.5 py-[4px] text-[10.5px] font-medium leading-none text-zinc-700 outline-none transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400/60 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {ANNOTATION_FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
              {ANNOTATION_FONT_SIZES.includes(
                fontSize as (typeof ANNOTATION_FONT_SIZES)[number],
              ) ? null : (
                <option value={fontSize}>{fontSize}</option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Zoom
            </span>
            <button
              type="button"
              aria-label="Zoom out"
              title="Zoom out"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => changeZoom(-ZOOM_STEP)}
              disabled={isApplying || zoom <= MIN_ZOOM}
              className="flex size-5 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LuMinus className="size-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Reset zoom to fit"
              title="Reset zoom to fit"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setZoom(1)}
              disabled={isApplying || zoom === 1}
              className="min-w-[38px] cursor-pointer rounded-full px-1 py-[3px] text-center text-[10.5px] font-medium tabular-nums text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-default disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              title="Zoom in"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => changeZoom(ZOOM_STEP)}
              disabled={isApplying || zoom >= MAX_ZOOM}
              className="flex size-5 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LuPlus className="size-3" aria-hidden="true" />
            </button>
          </div>

          <span className="min-w-0 flex-1 truncate text-[10.5px] tabular-nums text-zinc-500 dark:text-zinc-400">
            {filledItems.length === 0
              ? "No text added yet"
              : `${filledItems.length} text ${filledItems.length === 1 ? "label" : "labels"}`}
          </span>

          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={deleteSelected}
              disabled={!selectedItem || isApplying}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-[5px] text-[10.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LuTrash2 className="size-3" aria-hidden="true" />
              Delete text
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="cursor-pointer rounded-full border border-zinc-200 bg-white px-3.5 py-[6px] text-[11.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!canApply || isApplying}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-zinc-900 px-3.5 py-[6px] text-[11.5px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <LuCheck className="size-3" aria-hidden="true" />
              {isApplying ? "Applying…" : "Apply text"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="shrink-0 px-5 pb-1 text-xs text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
