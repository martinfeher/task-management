"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { LuChevronLeft, LuChevronRight, LuCrop, LuX } from "react-icons/lu";

type TaskDetailImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
  onCrop?: () => void;
  imageIndex?: number;
  imageCount?: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
};

/** Above calendar task modal (`z-[10050]`) and detail date menus (`z-[10060]`). */
const TASK_DETAIL_IMAGE_LIGHTBOX_Z_CLASS = "z-[10070]";

const LIGHTBOX_CONTROL_BUTTON_CLASS =
  "flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-zinc-900/75 text-white shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition-colors hover:bg-zinc-900/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-35";

const LIGHTBOX_GALLERY_NAV_BUTTON_CLASS =
  "flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-zinc-900/65 text-white shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-colors hover:bg-zinc-900/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-30";

export function TaskDetailImageLightbox({
  src,
  alt,
  onClose,
  onCrop,
  imageIndex = 0,
  imageCount = 1,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
}: TaskDetailImageLightboxProps) {
  const showGalleryNav = imageCount > 1;

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
      className={`task-detail-image-lightbox fixed inset-0 ${TASK_DETAIL_IMAGE_LIGHTBOX_Z_CLASS} flex cursor-zoom-out items-center justify-center p-6`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div
        className="task-detail-image-lightbox-frame relative w-fit max-h-[85vh] max-w-[92vw] overflow-visible"
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
            <LuChevronLeft className="size-6" aria-hidden="true" />
          </button>
        ) : null}
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-end gap-2">
          {onCrop ? (
            <button
              type="button"
              aria-label="Crop image"
              title="Crop image"
              onClick={(event) => {
                event.stopPropagation();
                onCrop();
              }}
              className={LIGHTBOX_CONTROL_BUTTON_CLASS}
            >
              <LuCrop className="size-[15px]" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Close preview"
            title="Close preview"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className={LIGHTBOX_CONTROL_BUTTON_CLASS}
          >
            <LuX className="size-[15px]" aria-hidden="true" />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded task detail URLs */}
        <img
          src={src}
          alt={alt}
          className="task-detail-image-lightbox-image h-auto max-h-[85vh] w-auto max-w-[92vw] select-none rounded-lg object-contain shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
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
    </div>,
    document.body,
  );
}