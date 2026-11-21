"use client";

import { useState } from "react";

type CalendarTaskImageThumbsProps = {
  srcs: string[];
  thumbSizePx: number;
  maxVisible?: number;
  className?: string;
  gapPx?: number;
};

export function CalendarTaskImageThumbs({
  srcs,
  thumbSizePx,
  maxVisible = 3,
  className = "",
  gapPx = 4,
}: CalendarTaskImageThumbsProps) {
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const availableSrcs = srcs.filter((src) => !failedSrcs.has(src));

  if (availableSrcs.length === 0) return null;

  const visible = availableSrcs.slice(0, maxVisible);
  const extraCount = availableSrcs.length - visible.length;

  return (
    <span
      className={`calendar-task-image-thumbs flex min-w-0 shrink-0 items-center ${className}`}
      style={{ gap: gapPx }}
      title={
        availableSrcs.length === 1
          ? "1 image in task"
          : `${availableSrcs.length} images in task`
      }
    >
      {visible.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded task image URLs
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() =>
            setFailedSrcs((current) => new Set(current).add(src))
          }
          className="calendar-task-image-thumb shrink-0 rounded-[8px] bg-white/90 object-cover ring-1 ring-black/10"
          style={{
            width: thumbSizePx,
            height: thumbSizePx,
          }}
        />
      ))}
      {extraCount > 0 ? (
        <span
          className="flex shrink-0 items-center justify-center rounded-[8px] bg-white/85 px-0.5 text-[10px] font-medium leading-none text-zinc-700 ring-1 ring-black/10"
          style={{
            width: thumbSizePx,
            height: thumbSizePx,
          }}
        >
          +{extraCount}
        </span>
      ) : null}
    </span>
  );
}

export function getCalendarTimedTaskImageThumbLayout(availableHeight: number) {
  if (availableHeight < 46) return null;

  if (availableHeight >= 76) {
    return { thumbSizePx: 28, maxVisible: 4 };
  }

  if (availableHeight >= 58) {
    return { thumbSizePx: 22, maxVisible: 3 };
  }

  return { thumbSizePx: 20, maxVisible: 2 };
}

type CalendarAllDayTaskImageThumbsProps = {
  imageSrcs?: string[];
};

export function CalendarAllDayTaskImageThumbs({
  imageSrcs,
}: CalendarAllDayTaskImageThumbsProps) {
  if (!imageSrcs?.length) return null;

  return (
    <CalendarTaskImageThumbs
      srcs={imageSrcs}
      thumbSizePx={18}
      maxVisible={2}
      gapPx={3}
      className="shrink-0"
    />
  );
}