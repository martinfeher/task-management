"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type TaskDetailImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

/** Above calendar task modal (`z-[10050]`) and detail date menus (`z-[10060]`). */
const TASK_DETAIL_IMAGE_LIGHTBOX_Z_CLASS = "z-[10070]";

export function TaskDetailImageLightbox({
  src,
  alt,
  onClose,
}: TaskDetailImageLightboxProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

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
      aria-label={alt || "Image preview"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded task detail URLs */}
      <img
        src={src}
        alt={alt}
        className="task-detail-image-lightbox-image max-h-[min(88vh,1600px)] max-w-[min(92vw,1400px)] select-none rounded-lg object-contain shadow-[0_18px_50px_rgba(15,23,42,0.18)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
        onMouseDown={(event) => event.stopPropagation()}
        draggable={false}
      />
    </div>,
    document.body,
  );
}
