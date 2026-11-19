"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  LuChevronLeft,
  LuChevronRight,
  LuCrop,
  LuType,
  LuX,
} from "react-icons/lu";

type TaskDetailImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
  onCrop?: () => void;
  onAnnotate?: () => void;
  imageIndex?: number;
  imageCount?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  taskTitle?: string | null;
};

/** Above calendar task modal (`z-[10050]`) and detail date menus (`z-[10060]`). */
const TASK_DETAIL_IMAGE_LIGHTBOX_Z_CLASS = "z-[10070]";

/** Delay after the preview image loads before the top-right controls fade in. */
const CONTROLS_REVEAL_DELAY_MS = 250;

/** Max rendered height for the preview image (94% of the viewport). */
const LIGHTBOX_IMAGE_MAX_HEIGHT_CLASS = "max-h-[94vh]";

const LIGHTBOX_CONTROL_BUTTON_CLASS =
  "task-detail-image-control-surface flex size-[calc(1.75rem-1.5px)] cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35";

const LIGHTBOX_IMAGE_CONTROL_TOOLTIP_CLASS =
  "add-task-date-tooltip app-hover-tooltip app-hover-tooltip-above-center pointer-events-none absolute bottom-[calc(100%+8px)] z-[10080] whitespace-nowrap px-3 py-1.5 text-[11px] font-medium";

type LightboxImageControlButtonProps = {
  label: string;
  tooltipId: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "children">;

function LightboxImageControlButton({
  label,
  tooltipId,
  children,
  className,
  ...buttonProps
}: LightboxImageControlButtonProps) {
  return (
    <div className="group/lightbox-control relative">
      <button
        type="button"
        aria-describedby={tooltipId}
        className={[LIGHTBOX_CONTROL_BUTTON_CLASS, className]
          .filter(Boolean)
          .join(" ")}
        {...buttonProps}
      >
        {children}
      </button>
      <span id={tooltipId} role="tooltip" className={LIGHTBOX_IMAGE_CONTROL_TOOLTIP_CLASS}>
        {label}
      </span>
    </div>
  );
}

const LIGHTBOX_GALLERY_NAV_BUTTON_CLASS =
  "flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-zinc-900/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.1)] transition-colors hover:bg-zinc-900/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30";

export function TaskDetailImageLightbox({
  src,
  alt,
  onClose,
  onCrop,
  onAnnotate,
  imageIndex = 0,
  imageCount = 1,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  taskTitle,
}: TaskDetailImageLightboxProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [revealedSrc, setRevealedSrc] = useState<string | null>(null);
  const controlsVisible = revealedSrc === src;

  // Image may already be cached/complete before React attaches onLoad.
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setLoadedSrc(src);
    }
  }, [src]);

  // Reveal the controls a beat after the image has loaded.
  useEffect(() => {
    if (loadedSrc !== src) return;

    const timer = window.setTimeout(() => {
      setRevealedSrc(src);
    }, CONTROLS_REVEAL_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [loadedSrc, src]);

  const showGalleryNav = imageCount > 1;
  const galleryTitleTrimmed = taskTitle?.trim() ?? "";
  const galleryTitle =
    galleryTitleTrimmed.length > 0
      ? galleryTitleTrimmed.charAt(0).toLocaleUpperCase() +
        galleryTitleTrimmed.slice(1)
      : "";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && hasPrevious && onPrevious) {
        event.preventDefault();
        event.stopPropagation();
        onPrevious();
        return;
      }

      if (event.key === "ArrowRight" && hasNext && onNext) {
        event.preventDefault();
        event.stopPropagation();
        onNext();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hasNext, hasPrevious, onClose, onNext, onPrevious]);

  const ariaLabel =
    imageCount > 1
      ? `${alt || "Image preview"}, ${imageIndex + 1} of ${imageCount}`
      : alt || "Image preview";

  return createPortal(
    <div
      className={`task-detail-image-lightbox fixed inset-0 ${TASK_DETAIL_IMAGE_LIGHTBOX_Z_CLASS} flex cursor-zoom-out flex-col`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={galleryTitle && showGalleryNav ? undefined : ariaLabel}
      aria-labelledby={
        showGalleryNav && galleryTitle
          ? "task-detail-image-lightbox-title"
          : undefined
      }
    >
      {showGalleryNav && galleryTitle ? (
        <header className="shrink-0 px-6 pt-2 pb-2">
          <h2
            id="task-detail-image-lightbox-title"
            className="w-fit max-w-[min(92vw,48rem)] rounded-[17px] bg-[#ffffff]/70 px-[16px] py-[6px] text-[14px] font-semibold leading-snug text-zinc-700 backdrop-blur-[4px] dark:bg-zinc-900/55 dark:text-zinc-100"
            title={galleryTitle}
          >
            {galleryTitle}
          </h2>
        </header>
      ) : null}
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`task-detail-image-lightbox-frame relative flex w-fit max-w-[92vw] items-center justify-center overflow-visible ${LIGHTBOX_IMAGE_MAX_HEIGHT_CLASS}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
        {showGalleryNav ? (
          <button
            type="button"
            aria-label="Previous image"
            title="Previous image"
            disabled={!hasPrevious}
            onClick={(event) => {
              event.stopPropagation();
              onPrevious?.();
            }}
            className={`absolute top-1/2 left-0 z-20 -translate-x-[calc(100%+10px)] -translate-y-1/2 ${LIGHTBOX_GALLERY_NAV_BUTTON_CLASS}`}
          >
            <LuChevronLeft className="size-6" />
          </button>
        ) : null}
        <div
          className={`absolute top-[6px] right-[6px] z-10 flex items-center justify-end gap-2 transition-opacity duration-300 ease-out ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-hidden={controlsVisible ? undefined : true}
        >
          {onAnnotate ? (
            <LightboxImageControlButton
              tooltipId="task-detail-image-lightbox-annotate-tooltip"
              label="Annotate"
              aria-label="Add text to image"
              onClick={(event) => {
                event.stopPropagation();
                onAnnotate();
              }}
            >
              <LuType className="size-[12px]" aria-hidden="true" />
            </LightboxImageControlButton>
          ) : null}
          {onCrop ? (
            <LightboxImageControlButton
              tooltipId="task-detail-image-lightbox-crop-tooltip"
              label="Crop"
              aria-label="Crop image"
              onClick={(event) => {
                event.stopPropagation();
                onCrop();
              }}
            >
              <LuCrop className="size-[12px]" aria-hidden="true" />
            </LightboxImageControlButton>
          ) : null}
          <LightboxImageControlButton
            tooltipId="task-detail-image-lightbox-close-tooltip"
            label="Close"
            aria-label="Close preview"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <LuX className="size-[12px]" aria-hidden="true" />
          </LightboxImageControlButton>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded task detail URLs */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onLoad={() => setLoadedSrc(src)}
          className={`task-detail-image-lightbox-image h-auto w-auto max-w-[92vw] select-none rounded-[8px] object-contain shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)] ${LIGHTBOX_IMAGE_MAX_HEIGHT_CLASS}`}
          draggable={false}
        />
        {showGalleryNav ? (
          <button
            type="button"
            aria-label="Next image"
            title="Next image"
            disabled={!hasNext}
            onClick={(event) => {
              event.stopPropagation();
              onNext?.();
            }}
            className={`absolute top-1/2 right-0 z-20 translate-x-[calc(100%+10px)] -translate-y-1/2 ${LIGHTBOX_GALLERY_NAV_BUTTON_CLASS}`}
          >
            <LuChevronRight className="size-6" aria-hidden="true" />
          </button>
        ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}