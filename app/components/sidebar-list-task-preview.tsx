"use client";

import { createPortal } from "react-dom";

import { useTaskListBackground } from "@/lib/task-list-background";

import type { TaskListItem, TodoList } from "./todo-app";
import { TaskListPanel } from "./task-list-panel";

export type SidebarListPreviewRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type SidebarListTaskPreviewProps = {
  listId: string;
  listName: string;
  tasks: TaskListItem[];
  completedTasks: TaskListItem[];
  lists: TodoList[];
  panelRect: SidebarListPreviewRect;
  subtasksEnabled: boolean;
};

export const LIST_TASK_PREVIEW_HEIGHT_PX = 1200;
const PREVIEW_FRAME_SIDE_PADDING_PX = 5;
const PREVIEW_FRAME_BOTTOM_PADDING_PX = 15;
const PREVIEW_FRAME_BORDER_PX = 1;
const PREVIEW_OUTER_RADIUS_PX = 14;
const PREVIEW_INNER_RADIUS_PX =
  PREVIEW_OUTER_RADIUS_PX - PREVIEW_FRAME_SIDE_PADDING_PX;

function noop() {}

export function SidebarListTaskPreview({
  listId,
  listName,
  tasks,
  completedTasks,
  lists,
  panelRect,
  subtasksEnabled,
}: SidebarListTaskPreviewProps) {
  const { presentation: taskListBackground } = useTaskListBackground();

  if (typeof document === "undefined") return null;

  const panelContentWidth = Math.max(
    280,
    panelRect.width -
      PREVIEW_FRAME_BORDER_PX * 2 -
      PREVIEW_FRAME_SIDE_PADDING_PX * 2,
  );

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[120]"
      style={{
        top: panelRect.top,
        left: panelRect.left,
        width: panelRect.width,
        height: LIST_TASK_PREVIEW_HEIGHT_PX,
      }}
    >
      <div
        className="box-border flex h-full flex-col overflow-hidden border border-[#67679b] bg-[#75758f] p-5 shadow-[0_10px_28px_rgba(0,0,0,0.22)]"
        style={{
          borderRadius: PREVIEW_OUTER_RADIUS_PX,
          paddingTop: PREVIEW_FRAME_SIDE_PADDING_PX,
          paddingRight: PREVIEW_FRAME_SIDE_PADDING_PX,
          paddingBottom: PREVIEW_FRAME_BOTTOM_PADDING_PX,
          paddingLeft: PREVIEW_FRAME_SIDE_PADDING_PX,
        }}
      >
        <div
          className={`min-h-0 w-full flex-1 overflow-hidden ${taskListBackground.className}`}
          style={{
            borderRadius: PREVIEW_INNER_RADIUS_PX,
            ...taskListBackground.style,
          }}
        >
          <div className="sidebar-list-task-preview h-full w-full overflow-hidden [&>section]:box-border [&>section]:h-full [&>section]:max-w-full [&>section]:min-h-0 [&>section]:w-full">
            <TaskListPanel
              title={listName}
              titleIconKind="list"
              viewResetKey={`preview:${listId}`}
              tasks={tasks}
              completedTasks={completedTasks}
              lists={lists}
              completingTaskIds={new Set()}
              completingWithoutBackgroundTaskIds={new Set()}
              checkAnimatingTaskIds={new Set()}
              selectedTaskId={null}
              panelWidth={panelContentWidth}
              showAddTask={false}
              showSortButton={false}
              listId={listId}
              onAddTask={async () => {}}
              onToggleTask={noop}
              onSelectTask={noop}
              onRenameTask={noop}
              subtasksEnabled={subtasksEnabled}
              embedded
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
