"use client";

import { useState } from "react";

const MAX_VISIBLE_THUMBS = 3;

type TaskListImageThumbsProps = {
  srcs: string[];
  className?: string;
  style?: React.CSSProperties;
  /** Row is the active (selected / keyboard-focused) task; enlarges the previews like hover. */
  active?: boolean;
};

/** Small stacked previews shown in a task list row when the task content has images. */
export function TaskListImageThumbs({
  srcs,
  className = "",
  style,
  active = false,
}: TaskListImageThumbsProps) {
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const availableSrcs = srcs.filter((src) => !failedSrcs.has(src));

  if (availableSrcs.length === 0) return null;

  const visible = availableSrcs.slice(0, MAX_VISIBLE_THUMBS);
  const extraCount = availableSrcs.length - visible.length;

  return (
    <span
      className={`task-list-image-thumbs flex shrink-0 items-center ${className}`}
      style={style}
      title={
        availableSrcs.length === 1
          ? "1 image"
          : `${availableSrcs.length} images`
      }
    >
      {visible.map((src, index) => (
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
          data-active={active ? "true" : undefined}
          className={`task-list-image-thumb shrink-0 rounded-[6px] border-2 border-white bg-zinc-100 object-cover shadow-[0_3px_8px_rgba(0,0,0,0.01)] transition-[width,height,border-width,box-shadow] duration-[400ms] group-hover:border-0 group-hover:shadow-none data-[active=true]:border-0 data-[active=true]:shadow-none dark:border-zinc-900 dark:bg-zinc-800 dark:group-hover:border-0 dark:data-[active=true]:border-0 ${
            index > 0 ? "-ml-2" : ""
          }`}
        />
      ))}
      {extraCount > 0 ? (
        <span className="-ml-2 flex size-[20px] shrink-0 items-center justify-center rounded-[6px] border-2 border-white bg-zinc-200 px-0.5 text-[10px] font-medium leading-none text-zinc-600 dark:border-zinc-900 dark:bg-zinc-700 dark:text-zinc-300">
          +{extraCount}
        </span>
      ) : null}
    </span>
  );
}