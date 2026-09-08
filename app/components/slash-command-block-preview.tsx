"use client";

import type { LineBlockType } from "./detail-lines";

export type SlashCommandPreviewBlockType = Extract<
  LineBlockType,
  "h1" | "h2" | "h3" | "bullet" | "numbered" | "checklist"
>;

const SLASH_COMMAND_PREVIEW_BLOCK_TYPES = new Set<SlashCommandPreviewBlockType>([
  "h1",
  "h2",
  "h3",
  "bullet",
  "numbered",
  "checklist",
]);

export function isSlashCommandPreviewBlockType(
  type: LineBlockType,
): type is SlashCommandPreviewBlockType {
  return SLASH_COMMAND_PREVIEW_BLOCK_TYPES.has(
    type as SlashCommandPreviewBlockType,
  );
}

const PREVIEW_CAPTIONS: Record<SlashCommandPreviewBlockType, string> = {
  h1: "Large section heading",
  h2: "Medium section heading",
  h3: "Small section heading",
  bullet: "Bulleted list",
  numbered: "Numbered list",
  checklist: "Checklist",
};

const SLASH_COMMAND_MENU_ROW_HEIGHT = 36;
const SLASH_COMMAND_MENU_SEPARATOR_HEIGHT = 9;
const TEXT_BLOCK_OPTION_COUNT = 4;

export function getSlashCommandPreviewTopOffset(
  selectedIndex: number,
  options: Array<{ kind: "block" | "link" }>,
  showSeparators: boolean,
) {
  let offset = 0;

  for (let index = 0; index < selectedIndex; index += 1) {
    offset += SLASH_COMMAND_MENU_ROW_HEIGHT;

    if (!showSeparators) continue;

    if (index === TEXT_BLOCK_OPTION_COUNT - 1) {
      offset += SLASH_COMMAND_MENU_SEPARATOR_HEIGHT;
    }

    if (
      options[index + 1]?.kind === "link" &&
      options.some((option) => option.kind === "block")
    ) {
      offset += SLASH_COMMAND_MENU_SEPARATOR_HEIGHT;
    }
  }

  return offset;
}

function PreviewEditorContent({ type }: { type: SlashCommandPreviewBlockType }) {
  switch (type) {
    case "h1":
      return (
        <div
          className="detail-line font-bold leading-tight text-[#4B4B4B] dark:text-[#F5F5F5]"
          data-line-type="h1"
        >
          Project roadmap
        </div>
      );
    case "h2":
      return (
        <>
          <div
            className="detail-line font-semibold leading-tight text-[#4B4B4B] dark:text-[#F5F5F5]"
            data-line-type="h2"
          >
            Our values
          </div>
          <div className="detail-line pl-1 text-[#555555] dark:text-zinc-300" data-line-type="bullet">
            Ownership
          </div>
          <div className="detail-line pl-1 text-[#555555] dark:text-zinc-300" data-line-type="bullet">
            Altruism
          </div>
        </>
      );
    case "h3":
      return (
        <div
          className="detail-line font-semibold leading-tight text-[#4B4B4B] dark:text-[#F5F5F5]"
          data-line-type="h3"
        >
          Key milestones
        </div>
      );
    case "bullet":
      return (
        <>
          <div className="detail-line pl-1 text-[#555555] dark:text-zinc-300" data-line-type="bullet">
            First item
          </div>
          <div className="detail-line pl-1 text-[#555555] dark:text-zinc-300" data-line-type="bullet">
            Second item
          </div>
        </>
      );
    case "numbered":
      return (
        <>
          <div
            className="detail-line pl-1 text-[#555555] dark:text-zinc-300"
            data-line-type="numbered"
            data-list-number="1"
          >
            First item
          </div>
          <div
            className="detail-line pl-1 text-[#555555] dark:text-zinc-300"
            data-line-type="numbered"
            data-list-number="2"
          >
            Second item
          </div>
        </>
      );
    case "checklist":
      return (
        <>
          <div
            className="detail-line pl-1 text-[#555555] dark:text-zinc-300"
            data-line-type="checklist"
          >
            <span className="detail-checklist-text">Task one</span>
          </div>
          <div
            className="detail-line pl-1 text-[#555555] dark:text-zinc-300"
            data-line-type="checklist"
          >
            <span className="detail-checklist-text">Task two</span>
          </div>
        </>
      );
    default:
      return null;
  }
}

export function SlashCommandBlockPreview({
  type,
}: {
  type: SlashCommandPreviewBlockType;
}) {
  return (
    <div
      aria-hidden="true"
      className="w-[196px] shrink-0 overflow-hidden rounded-[14px] border-2 border-zinc-800 bg-zinc-900 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.22)] dark:border-zinc-600"
    >
      <div className="rounded-[10px] bg-white px-3 py-2.5 dark:bg-zinc-950">
        <div
          className="task-details-editor pointer-events-none text-[13px] leading-snug [&_.detail-line[data-line-type=h1]]:text-[18px] [&_.detail-line[data-line-type=h1]]:leading-[24px] [&_.detail-line[data-line-type=h2]]:text-[15px] [&_.detail-line[data-line-type=h2]]:leading-[20px] [&_.detail-line[data-line-type=h3]]:text-[14px] [&_.detail-line[data-line-type=h3]]:leading-[18px]"
          data-hide-body-placeholder="true"
        >
          <PreviewEditorContent type={type} />
        </div>
      </div>
      <p className="px-1 pb-0.5 pt-1.5 text-[11px] leading-tight text-white">
        {PREVIEW_CAPTIONS[type]}
      </p>
    </div>
  );
}
