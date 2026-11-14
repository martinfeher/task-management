"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuCheck, LuCrop, LuRotateCcw, LuX } from "react-icons/lu";
import {
  fitCropToRatio,
  fullCrop,
  getCropOutputMimeType,
  isFullCrop,
  moveCrop,
  renderCroppedImage,
  resizeCrop,
  type CropHandle,
  type CropRect,
  type RenderedCrop,
} from "@/lib/image-crop";
import { TASK_DETAILS_HEADER_ICON_HOVER_CLASS } from "@/lib/task-details-header-icon-hover";

/** Above the image lightbox (`z-[10070]`) and calendar task modal. */
const TASK_DETAIL_IMAGE_CROP_Z_CLASS = "z-[10080]";
const STAGE_PADDING_PX = 28;
const MAX_UPSCALE = 3;

type AspectId =
  | "free"
  | "original"
  | "1:1"
  | "4:3"
  | "3:2"
  | "16:9"
  | "9:16";

const ASPECT_OPTIONS: Array<{ id: AspectId; label: string; ratio?: number }> = [
  { id: "free", label: "Free" },
  { id: "original", label: "Original" },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

const CORNER_HANDLES: Array<{
  id: CropHandle;
  hitClassName: string;
  bracketClassName: string;
}> = [
  {
    id: "nw",
    hitClassName: "-left-3.5 -top-3.5 cursor-nwse-resize",
    bracketClassName: "left-[12px] top-[12px] border-l-[3px] border-t-[3px]",
  },
  {
    id: "ne",
    hitClassName: "-right-3.5 -top-3.5 cursor-nesw-resize",
    bracketClassName: "right-[12px] top-[12px] border-r-[3px] border-t-[3px]",
  },
  {
    id: "sw",
    hitClassName: "-bottom-3.5 -left-3.5 cursor-nesw-resize",
    bracketClassName: "bottom-[12px] left-[12px] border-b-[3px] border-l-[3px]",
  },
  {
    id: "se",
    hitClassName: "-bottom-3.5 -right-3.5 cursor-nwse-resize",
    bracketClassName: "bottom-[12px] right-[12px] border-b-[3px] border-r-[3px]",
  },
];

const EDGE_HANDLES: Array<{
  id: CropHandle;
  hitClassName: string;
  barClassName: string;
}> = [
  {
    id: "n",
    hitClassName: "left-3.5 right-3.5 -top-2.5 h-5 cursor-ns-resize",
    barClassName: "h-[3px] w-6",
  },
  {
    id: "s",
    hitClassName: "left-3.5 right-3.5 -bottom-2.5 h-5 cursor-ns-resize",
    barClassName: "h-[3px] w-6",
  },
  {
    id: "w",
    hitClassName: "top-3.5 bottom-3.5 -left-2.5 w-5 cursor-ew-resize",
    barClassName: "h-6 w-[3px]",
  },
  {
    id: "e",
    hitClassName: "top-3.5 bottom-3.5 -right-2.5 w-5 cursor-ew-resize",
    barClassName: "h-6 w-[3px]",
  },
];

type DragState = {
  mode: "move" | CropHandle;
  pointerId: number;
  startX: number;
  startY: number;
  startCrop: CropRect;
};

type TaskDetailImageCropModalProps = {
  src: string;
  onCancel: () => void;
  /** Resolve once the cropped image has been stored; the parent then closes the modal. */
  onApply: (result: RenderedCrop) => Promise<void>;
};

export function TaskDetailImageCropModal({
  src,
  onCancel,
  onApply,
}: TaskDetailImageCropModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [aspect, setAspect] = useState<AspectId>("free");
  const [drag, setDrag] = useState<DragState | null>(null);
  const isDragging = drag !== null;
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scale =
    natural && stageSize.w > 0 && stageSize.h > 0
      ? Math.min(stageSize.w / natural.w, stageSize.h / natural.h, MAX_UPSCALE)
      : 1;
  const displayWidth = natural ? natural.w * scale : 0;
  const displayHeight = natural ? natural.h * scale : 0;

  const getRatio = useCallback(
    (id: AspectId) => {
      if (id === "free") return null;
      if (id === "original") return natural ? natural.w / natural.h : null;
      return ASPECT_OPTIONS.find((option) => option.id === id)?.ratio ?? null;
    },
    [natural],
  );
  const ratio = getRatio(aspect);

  const canApply =
    Boolean(natural && crop) &&
    !isFullCrop(crop ?? { x: 0, y: 0, w: 0, h: 0 }, natural ?? { w: 0, h: 0 });

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

  const handleApply = useCallback(async () => {
    const image = imageRef.current;
    if (!image || !crop || !natural || isApplying || !canApply) return;

    setIsApplying(true);
    setErrorMessage(null);

    try {
      const result = await renderCroppedImage(
        image,
        crop,
        getCropOutputMimeType(src),
      );
      await onApply(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not crop this image.",
      );
      setIsApplying(false);
    }
  }, [canApply, crop, isApplying, natural, onApply, src]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!isApplying) onCancel();
        return;
      }

      if (isApplying) return;

      if (event.key === "Enter") {
        if (event.target instanceof HTMLButtonElement) return;
        event.preventDefault();
        event.stopPropagation();
        void handleApply();
        return;
      }

      if (
        !natural ||
        !crop ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const step = (event.shiftKey ? 10 : 1) / scale;
      const dx =
        event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy =
        event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;

      setCrop(moveCrop(crop, dx, dy, natural));
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [crop, handleApply, isApplying, natural, onCancel, scale]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) {
      setErrorMessage("Could not load this image.");
      return;
    }

    const bounds = { w: naturalWidth, h: naturalHeight };
    setNatural(bounds);
    setCrop(fullCrop(bounds));
  }

  function handleAspectChange(id: AspectId) {
    setAspect(id);
    if (!natural || !crop) return;

    const nextRatio = getRatio(id);
    if (nextRatio !== null) {
      setCrop(fitCropToRatio(crop, nextRatio, natural));
    }
  }

  function handleReset() {
    if (!natural) return;
    setAspect("free");
    setCrop(fullCrop(natural));
    setErrorMessage(null);
  }

  function getDragProps(mode: DragState["mode"]) {
    return {
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || !crop || isApplying) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        setDrag({
          mode,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startCrop: crop,
        });
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (!drag || drag.pointerId !== event.pointerId || !natural) return;

        const dx = (event.clientX - drag.startX) / scale;
        const dy = (event.clientY - drag.startY) / scale;

        setCrop(
          drag.mode === "move"
            ? moveCrop(drag.startCrop, dx, dy, natural)
            : resizeCrop(drag.startCrop, drag.mode, dx, dy, natural, ratio),
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

  const box = crop
    ? {
        left: crop.x * scale,
        top: crop.y * scale,
        width: crop.w * scale,
        height: crop.h * scale,
      }
    : null;

  return createPortal(
    <div
      className={`task-detail-image-crop-overlay fixed inset-0 ${TASK_DETAIL_IMAGE_CROP_Z_CLASS} flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-[3px]`}
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[920px] flex-col overflow-hidden rounded-[22px] border border-zinc-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <LuCrop className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                Crop image
              </h2>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                Drag the handles to choose what to keep. Arrow keys nudge the
                selection.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close crop dialog"
            onClick={onCancel}
            disabled={isApplying}
            className={`flex size-[29px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-zinc-200/30 text-zinc-500 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100 ${TASK_DETAILS_HEADER_ICON_HOVER_CLASS}`}
          >
            <LuX className="size-[15px]" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={stageRef}
          className="relative flex h-[min(58vh,520px)] min-h-[240px] shrink-0 select-none items-center justify-center overflow-hidden bg-[#1c1c20]"
          style={{ padding: STAGE_PADDING_PX }}
        >
          <div
            className="group/crop relative shrink-0"
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

            {box ? (
              <>
                <div
                  className="pointer-events-none absolute left-0 top-0 bg-zinc-950/65"
                  style={{ width: displayWidth, height: box.top }}
                />
                <div
                  className="pointer-events-none absolute left-0 bg-zinc-950/65"
                  style={{
                    top: box.top + box.height,
                    width: displayWidth,
                    height: Math.max(0, displayHeight - box.top - box.height),
                  }}
                />
                <div
                  className="pointer-events-none absolute left-0 bg-zinc-950/65"
                  style={{ top: box.top, width: box.left, height: box.height }}
                />
                <div
                  className="pointer-events-none absolute bg-zinc-950/65"
                  style={{
                    top: box.top,
                    left: box.left + box.width,
                    width: Math.max(0, displayWidth - box.left - box.width),
                    height: box.height,
                  }}
                />

                <div
                  className="absolute shadow-[0_0_0_1px_rgba(0,0,0,0.35)] outline outline-[1.5px] outline-white/95"
                  style={box}
                >
                  <div
                    className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
                      isDragging ? "opacity-100" : "opacity-0 group-hover/crop:opacity-100"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
                    <span className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
                    <span className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                    <span className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
                  </div>

                  <div
                    className="absolute inset-0 cursor-move touch-none"
                    {...getDragProps("move")}
                  />

                  {EDGE_HANDLES.map((handle) => (
                    <div
                      key={handle.id}
                      className={`absolute touch-none ${handle.hitClassName}`}
                      {...getDragProps(handle.id)}
                    >
                      <span
                        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] ${handle.barClassName}`}
                      />
                    </div>
                  ))}

                  {CORNER_HANDLES.map((handle) => (
                    <div
                      key={handle.id}
                      className={`absolute size-7 touch-none ${handle.hitClassName}`}
                      {...getDragProps(handle.id)}
                    >
                      <span
                        className={`pointer-events-none absolute size-4 border-white drop-shadow-[0_0_1px_rgba(0,0,0,0.5)] ${handle.bracketClassName}`}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {!natural && !errorMessage ? (
            <p className="absolute text-sm text-zinc-400">Loading image…</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Aspect
          </span>
          {ASPECT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={aspect === option.id}
              disabled={!natural || isApplying}
              onClick={() => handleAspectChange(option.id)}
              className={`cursor-pointer rounded-full px-[13px] py-[5px] text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                aspect === option.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {errorMessage ? (
          <p
            role="alert"
            className="shrink-0 px-5 pb-1 text-xs text-red-600 dark:text-red-400"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
          <span className="min-w-0 truncate text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {crop && natural ? (
              <>
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {Math.round(crop.w)} × {Math.round(crop.h)} px
                </span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  {" "}
                  · original {natural.w} × {natural.h}
                </span>
              </>
            ) : null}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!natural || isApplying || !canApply}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-[7px] text-[13px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <LuRotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isApplying}
              className="cursor-pointer rounded-full border border-zinc-200 bg-white px-4 py-[7px] text-[13px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!canApply || isApplying}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-[7px] text-[13px] font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              <LuCheck className="size-3.5" aria-hidden="true" />
              {isApplying ? "Applying…" : "Apply crop"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
