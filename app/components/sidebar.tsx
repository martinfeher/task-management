"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BiCheckboxChecked, BiChevronDown } from "react-icons/bi";
import { IoIosSearch } from "react-icons/io";
import {
  getLabelColor,
  LABEL_PRESET_COLORS,
} from "@/lib/label-colors";
import { getInboxListId } from "@/lib/inbox-list";
import { FiSettings } from "react-icons/fi";
import { LuArrowRight, LuInbox, LuPlus, LuStar } from "react-icons/lu";
import { PiDotsThreeBold } from "react-icons/pi";
import { BsCalendar3 } from "react-icons/bs";
import { useSidebarBackground } from "@/lib/sidebar-background";
import { useImportantEnabled } from "@/lib/important-settings";

import type {
  CompletedTask,
  SearchTask,
  SidebarHoverPreview,
  TaskLabel,
  TaskListItem,
  TodoList,
} from "./todo-app";
import {
  getListDropIndex,
  getListRowElements,
  mergeReorderedSidebarListIds,
  reorderListIds,
} from "./list-reorder";
import { InteractIcon } from "./line-control-icons";
import {
  applyLabelRowShifts,
  getLabelDropIndex,
  getLabelRowElements,
  reorderLabelIds,
} from "./label-reorder";
import { getReorderTargetIndex } from "./task-reorder";
import { ConfirmModal } from "./confirm-modal";
import { MacCmdIcon } from "./mac-cmd-icon";
import { RenameListModal } from "./rename-list-modal";
import { LabelContextMenu, clampLabelContextMenuPosition } from "./label-context-menu";
import { TodayCalendarIcon } from "./today-calendar-icon";


const SearchModal = dynamic(
  () => import("./search-modal").then((module) => module.SearchModal),
  { ssr: false },
);

const SettingsModal = dynamic(
  () => import("./settings-modal").then((module) => module.SettingsModal),
  { ssr: false },
);

const NAV_ITEMS = [
  { label: "Search", action: "search" as const },
  { label: "Today", action: "today" as const },
  { label: "Inbox", action: "inbox" as const },
  // { label: "Next 7 days", action: "next7days" as const },
  { label: "Important", action: "important" as const },
  { label: "Calendar", action: "calendar" as const },
];

type SidebarProps = {
  lists: TodoList[];
  labels: TaskLabel[];
  taskCountByListId: Record<string, number>;
  taskCountByLabelId: Record<string, number>;
  completedTasks: CompletedTask[];
  searchTasks: SearchTask[];
  completingTaskIds?: Set<string>;
  checkAnimatingTaskIds?: Set<string>;
  calendarTasks: TaskListItem[];
  selectedListId: string | null;
  suppressListSelectionHighlightId?: string | null;
  selectedLabelId: string | null;
  isTodaySelected: boolean;
  isInboxSelected: boolean;
  // isNext7DaysSelected: boolean;
  isImportantSelected: boolean;
  isCalendarSelected: boolean;
  selectedTaskId: string | null;
  onSelectList: (listId: string) => void;
  onSelectLabel: (labelId: string) => void;
  onSelectToday: () => void;
  onSelectInbox: () => void;
  // onSelectNext7Days: () => void;
  onSelectImportant: () => void;
  onSelectCalendar: () => void;
  onSelectCompletedTask: (taskId: string, listId: string) => void;
  onSelectSearchTask: (taskId: string, listId: string) => void;
  onToggleTask: (taskId: string) => void;
  onAddList: (name: string) => void;
  onAddLabel: (name: string, color: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onRemoveList: (listId: string) => void;
  onRenameLabel: (labelId: string, name: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onUpdateLabelColor: (labelId: string, color: string) => void;
  onReorderLists?: (listIds: string[]) => void;
  onReorderLabels?: (labelIds: string[]) => void;
  onSidebarHoverStart?: (preview: SidebarHoverPreview) => void;
  onSidebarHoverEnd?: () => void;
  sidebarHoverPreview?: SidebarHoverPreview | null;
  compactDrawer?: boolean;
  drawerOpen?: boolean;
  onDrawerClose?: () => void;
  taskDropHighlightListId?: string | null;
};

const LIST_DRAG_THRESHOLD_PX = 5;
const LABEL_DRAG_THRESHOLD_PX = 5;

function shouldStartListDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem']",
  );
}

const itemClassName =
  "flex mx-[6px] mb-px w-[236px] items-center rounded-[3px]  text-left text-sm transition-colors cursor-pointer";

const completedItemClassName =
  "flex mx-[4px] mb-px min-h-[44px] w-auto flex-col items-start justify-center gap-0 rounded-[3px] px-4 py-1 text-left text-sm transition-colors";

function getItemClassName(isSelected: boolean, baseClassName = itemClassName) {
  const heightClass =
    baseClassName === completedItemClassName ? "" : "h-[35px]";

  return `${baseClassName} ${heightClass} ${
    isSelected
      ? "bg-[#e9ebee] font-medium text-[#111111] dark:bg-zinc-800 dark:text-zinc-50"
      : "text-zinc-900 hover:bg-zinc-200/60 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({
  lists,
  labels,
  taskCountByListId,
  taskCountByLabelId,
  completedTasks,
  searchTasks,
  completingTaskIds,
  checkAnimatingTaskIds,
  calendarTasks,
  selectedListId,
  suppressListSelectionHighlightId = null,
  selectedLabelId,
  isTodaySelected,
  isInboxSelected,
  // isNext7DaysSelected,
  isImportantSelected,
  isCalendarSelected,
  selectedTaskId,
  onSelectList,
  onSelectLabel,
  onSelectToday,
  onSelectInbox,
  // onSelectNext7Days,
  onSelectImportant,
  onSelectCalendar,
  onSelectCompletedTask,
  onSelectSearchTask,
  onToggleTask,
  onAddList,
  onAddLabel,
  onRenameList,
  onRemoveList,
  onRenameLabel,
  onRemoveLabel,
  onUpdateLabelColor,
  onReorderLists,
  onReorderLabels,
  onSidebarHoverStart,
  onSidebarHoverEnd,
  sidebarHoverPreview = null,
  compactDrawer = false,
  drawerOpen = false,
  onDrawerClose,
  taskDropHighlightListId = null,
}: SidebarProps) {
  const { presentation: sidebarBackground } = useSidebarBackground();
  const { importantEnabled } = useImportantEnabled();
  const visibleNavItems = importantEnabled
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.action !== "important");
  const closeDrawer = () => onDrawerClose?.();
  const [orderedLists, setOrderedLists] = useState(lists);
  const [orderedLabels, setOrderedLabels] = useState(labels);
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [labelDropIndicatorTop, setLabelDropIndicatorTop] = useState<
    number | null
  >(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [isLabelsOpen, setIsLabelsOpen] = useState(true);
  const [isAddLabelOpen, setIsAddLabelOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchRevealOrigin, setSearchRevealOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsRevealOrigin, setSettingsRevealOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [openMenuLabelId, setOpenMenuLabelId] = useState<string | null>(null);
  const [labelMenuPosition, setLabelMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [renameList, setRenameList] = useState<TodoList | null>(null);
  const [removeList, setRemoveList] = useState<TodoList | null>(null);
  const [renameLabel, setRenameLabel] = useState<TaskLabel | null>(null);
  const [removeLabel, setRemoveLabel] = useState<TaskLabel | null>(null);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameDraft, setListNameDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const labelMenuRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const labelContainerRef = useRef<HTMLDivElement>(null);
  const listNameInputRef = useRef<HTMLInputElement>(null);
  const lastMousePositionRef = useRef({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
    y: typeof window !== "undefined" ? window.innerHeight * 0.12 : 0,
  });
  const dragStateRef = useRef<{
    sourceRow: HTMLElement;
    captureTarget: HTMLElement;
    sourceIndex: number;
    dropIndex: number;
    sidebarListIds: string[];
    fullListIds: string[];
    inboxListId: string | null;
    pointerId: number;
  } | null>(null);
  const labelDragStateRef = useRef<{
    sourceRow: HTMLElement;
    captureTarget: HTMLElement;
    sourceIndex: number;
    dropIndex: number;
    labelIds: string[];
    pointerId: number;
    startClientY: number;
    rowHeight: number;
    appliedTargetIndex: number | null;
  } | null>(null);
  const suppressListClickRef = useRef(false);
  const suppressLabelClickRef = useRef(false);

  const [activeText, setActiveText] = useState(false);

  useEffect(() => {
    setOrderedLists(lists);
  }, [lists]);

  useEffect(() => {
    setOrderedLabels(labels);
  }, [labels]);

  useEffect(() => {
    if (!editingListId) return;

    requestAnimationFrame(() => {
      const input = listNameInputRef.current;
      if (!input) return;

      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }, [editingListId]);

  useEffect(() => {
    function trackMousePosition(event: MouseEvent) {
      lastMousePositionRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }

    document.addEventListener("mousemove", trackMousePosition);
    return () => document.removeEventListener("mousemove", trackMousePosition);
  }, []);

  function openSearchModal(origin: { x: number; y: number }) {
    setSearchRevealOrigin(origin);
    setIsSearchOpen(true);
  }

  function openSettingsModal(origin: { x: number; y: number }) {
    setSettingsRevealOrigin(origin);
    setIsSettingsOpen(true);
  }

  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      if (event.altKey || event.shiftKey) return;

      event.preventDefault();
      openSearchModal(lastMousePositionRef.current);
    }

    document.addEventListener("keydown", handleSearchShortcut);
    return () => document.removeEventListener("keydown", handleSearchShortcut);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpenMenuListId(null);
      }
      if (!labelMenuRef.current?.contains(event.target as Node)) {
        setOpenMenuLabelId(null);
        setLabelMenuPosition(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (
        isSearchOpen ||
        renameList ||
        removeList ||
        isAddListOpen ||
        isAddLabelOpen ||
        renameLabel ||
        removeLabel
      ) {
        return;
      }

      if (openMenuLabelId) {
        event.preventDefault();
        setOpenMenuLabelId(null);
        setLabelMenuPosition(null);
        return;
      }

      if (openMenuListId) {
        event.preventDefault();
        setOpenMenuListId(null);
      }
    }

    if (!openMenuLabelId && !openMenuListId) return;

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    openMenuLabelId,
    openMenuListId,
    isSearchOpen,
    renameList,
    removeList,
    isAddListOpen,
    isAddLabelOpen,
    renameLabel,
    removeLabel,
  ]);

  const inboxListId = getInboxListId(lists);
  const sidebarLists = inboxListId
    ? orderedLists.filter((list) => list.id !== inboxListId)
    : orderedLists;

  function isListSelected(listId: string) {
    return (
      !isTodaySelected &&
      !isInboxSelected &&
      !isImportantSelected &&
      !isCalendarSelected &&
      !selectedLabelId &&
      listId === selectedListId
    );
  }

  function getListRowClassName(listId: string) {
    const isTaskDropTarget = taskDropHighlightListId === listId;
    const isSelected =
      isListSelected(listId) && listId !== suppressListSelectionHighlightId;
    const isHovered =
      sidebarHoverPreview?.kind === "list" &&
      sidebarHoverPreview.listId === listId;

    if (isTaskDropTarget) {
      return "border-r border-transparent bg-blue-100 ring-2 ring-inset ring-blue-400 dark:bg-blue-950/70 dark:ring-blue-500";
    }

    // Keep selected background even while previewing another list name.
    if (isSelected) {
      return "border-r border-transparent bg-[#e9ebee]/50 dark:bg-zinc-800";
    }

    if (isHovered) {
      return "bg-[#f0f0f0]";
    }

    return "border-r-2 border-transparent hover:bg-zinc-200/50 dark:hover:bg-zinc-800/60";
  }

  function getNavItemClassName(
    isSelected: boolean,
  ) {
    if (isSelected) {
      return `${itemClassName} group h-[35px] bg-[#e9ebee]/50 font-medium text-[#111111] dark:bg-zinc-800 dark:text-zinc-50`;
    }

    return `${itemClassName} group h-[35px] text-zinc-900 hover:bg-zinc-200/50 dark:text-zinc-50 dark:hover:bg-zinc-800/60`;
  }

  function openRenameModal(list: TodoList) {
    setOpenMenuListId(null);
    setRenameList(list);
  }

  function openRemoveModal(list: TodoList) {
    setOpenMenuListId(null);
    setRemoveList(list);
  }

  function startListNameEdit(list: TodoList) {
    setOpenMenuListId(null);
    setEditingListId(list.id);
    setListNameDraft(list.name);
  }

  function cancelListNameEdit(list: TodoList) {
    setListNameDraft(list.name);
    setEditingListId(null);
  }

  function commitListNameEdit(list: TodoList) {
    const trimmed = listNameDraft.trim();

    if (!trimmed) {
      cancelListNameEdit(list);
      return;
    }

    if (trimmed !== list.name) {
      onRenameList(list.id, trimmed);
      setOrderedLists((current) =>
        current.map((item) =>
          item.id === list.id ? { ...item, name: trimmed } : item,
        ),
      );
    }

    setEditingListId(null);
  }

  function handleListNameKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    list: TodoList,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitListNameEdit(list);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelListNameEdit(list);
    }
  }

  function handleListDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    const container = listContainerRef.current;
    if (!dragState || !container) return;

    const rows = getListRowElements(container);
    const dropIndex = getListDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );
    dragState.dropIndex = dropIndex;

    const containerRect = container.getBoundingClientRect();
    let indicatorTop: number;

    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const rect = lastRow.getBoundingClientRect();
      indicatorTop = rect.bottom - containerRect.top;
    } else {
      const targetRow = rows[dropIndex];
      const rect = targetRow.getBoundingClientRect();
      indicatorTop = rect.top - containerRect.top;
    }

    setDropIndicatorTop(indicatorTop);
  }

  function handleListDragEnd() {
    const dragState = dragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleListDragMove);
    document.removeEventListener("pointerup", handleListDragEnd);
    document.removeEventListener("pointercancel", handleListDragEnd);
    document.body.style.cursor = "";

    if (dragState) {
      if (dragState.captureTarget.hasPointerCapture(dragState.pointerId)) {
        dragState.captureTarget.releasePointerCapture(dragState.pointerId);
      }
      dragState.sourceRow.classList.remove("opacity-50");
      dragState.sourceRow.style.cursor = "";
    }

    setDropIndicatorTop(null);

    if (dragState && onReorderLists) {
      const reorderedSidebarIds = reorderListIds(
        dragState.sidebarListIds,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      const nextIds = mergeReorderedSidebarListIds(
        dragState.fullListIds,
        dragState.inboxListId,
        reorderedSidebarIds,
      );

      if (nextIds.join(",") !== dragState.fullListIds.join(",")) {
        const listMap = new Map(orderedLists.map((list) => [list.id, list]));
        setOrderedLists(
          nextIds
            .map((id) => listMap.get(id))
            .filter((list): list is TodoList => list !== undefined),
        );
        onReorderLists(nextIds);
      }
    }

    if (wasDragging) {
      suppressListClickRef.current = true;
    }

    dragStateRef.current = null;
  }

  function beginListDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    sidebarListIds: string[],
    fullListIds: string[],
  ) {
    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceIndex,
      dropIndex: sourceIndex,
      sidebarListIds,
      fullListIds,
      inboxListId,
      pointerId,
    };

    sourceRow.classList.add("opacity-50");
    sourceRow.setPointerCapture(pointerId);
    sourceRow.style.cursor = "move";
    document.body.style.cursor = "move";
    document.addEventListener("pointermove", handleListDragMove);
    document.addEventListener("pointerup", handleListDragEnd);
    document.addEventListener("pointercancel", handleListDragEnd);
  }

  function handleListPointerDown(
    event: React.PointerEvent<HTMLElement>,
    listId: string,
  ) {
    if (editingListId === listId) return;
    if (!onReorderLists || event.button !== 0) return;
    if (!shouldStartListDrag(event.target)) return;

    const container = listContainerRef.current;
    if (!container) return;

    const rows = getListRowElements(container);
    const sourceRow = rows.find((row) => row.dataset.listId === listId);
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const sidebarListIds = sidebarLists.map((list) => list.id);
    const fullListIds = orderedLists.map((list) => list.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    event.preventDefault();

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < LIST_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginListDrag(
        dragRow,
        pointerId,
        sourceIndex,
        sidebarListIds,
        fullListIds,
      );
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function handleLabelDragMove(event: PointerEvent) {
    const dragState = labelDragStateRef.current;
    const container = labelContainerRef.current;
    if (!dragState || !container) return;

    const deltaY = event.clientY - dragState.startClientY;
    dragState.sourceRow.style.translate = `0px ${deltaY}px`;

    const rows = getLabelRowElements(container);
    const dropIndex = getLabelDropIndex(
      event.clientY,
      rows,
      dragState.sourceIndex,
    );
    dragState.dropIndex = dropIndex;

    const targetIndex = getReorderTargetIndex(dragState.sourceIndex, dropIndex);
    if (targetIndex !== dragState.appliedTargetIndex) {
      applyLabelRowShifts(
        rows,
        dragState.sourceRow,
        dragState.sourceIndex,
        targetIndex,
        dragState.rowHeight,
      );
      dragState.appliedTargetIndex = targetIndex;
    }

    const containerRect = container.getBoundingClientRect();
    let indicatorTop: number;

    if (dropIndex >= rows.length) {
      const lastRow = rows[rows.length - 1];
      if (!lastRow) return;
      const rect = lastRow.getBoundingClientRect();
      indicatorTop = rect.bottom - containerRect.top;
    } else {
      const targetRow = rows[dropIndex];
      const rect = targetRow.getBoundingClientRect();
      indicatorTop = rect.top - containerRect.top;
    }

    setLabelDropIndicatorTop(indicatorTop);
  }

  function handleLabelDragEnd() {
    const dragState = labelDragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleLabelDragMove);
    document.removeEventListener("pointerup", handleLabelDragEnd);
    document.removeEventListener("pointercancel", handleLabelDragEnd);
    document.body.style.cursor = "";

    if (dragState) {
      if (dragState.captureTarget.hasPointerCapture(dragState.pointerId)) {
        dragState.captureTarget.releasePointerCapture(dragState.pointerId);
      }
      dragState.sourceRow.classList.remove("task-row-dragging");
      dragState.sourceRow.style.transform = "";
      dragState.sourceRow.style.translate = "";
      dragState.sourceRow.style.scale = "";
      dragState.sourceRow.style.cursor = "";

      const container = labelContainerRef.current;
      if (container) {
        getLabelRowElements(container).forEach((row) => {
          row.classList.remove("task-row-shifting");
          if (row !== dragState.sourceRow) {
            row.style.transform = "";
          }
        });
      }
    }

    setLabelDropIndicatorTop(null);

    if (dragState && onReorderLabels) {
      const nextIds = reorderLabelIds(
        dragState.labelIds,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (nextIds.join(",") !== dragState.labelIds.join(",")) {
        const labelMap = new Map(orderedLabels.map((label) => [label.id, label]));
        setOrderedLabels(
          nextIds
            .map((id) => labelMap.get(id))
            .filter((label): label is TaskLabel => label !== undefined),
        );
        onReorderLabels(nextIds);
      }
    }

    if (wasDragging) {
      suppressLabelClickRef.current = true;
    }

    labelDragStateRef.current = null;
  }

  function beginLabelDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    labelIds: string[],
    startClientY: number,
  ) {
    const rowHeight = sourceRow.getBoundingClientRect().height;

    labelDragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      sourceIndex,
      dropIndex: sourceIndex,
      labelIds,
      pointerId,
      startClientY,
      rowHeight,
      appliedTargetIndex: null,
    };

    const container = labelContainerRef.current;
    if (container) {
      getLabelRowElements(container).forEach((row) => {
        if (row !== sourceRow) row.classList.add("task-row-shifting");
      });
    }

    sourceRow.classList.add("task-row-dragging");
    sourceRow.style.scale = "1.02";
    sourceRow.setPointerCapture(pointerId);
    sourceRow.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleLabelDragMove);
    document.addEventListener("pointerup", handleLabelDragEnd);
    document.addEventListener("pointercancel", handleLabelDragEnd);
  }

  function handleLabelPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    labelId: string,
  ) {
    if (!onReorderLabels || event.button !== 0) return;
    if (!shouldStartListDrag(event.target)) return;

    const container = labelContainerRef.current;
    if (!container) return;

    const rows = getLabelRowElements(container);
    const sourceRow = rows.find((row) => row.dataset.labelId === labelId);
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const labelIds = orderedLabels.map((label) => label.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    dragRow.style.cursor = "move";
    document.body.style.cursor = "move";

    function clearPendingListeners() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      if (dragStarted) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.hypot(dx, dy) < LABEL_DRAG_THRESHOLD_PX) return;

      dragStarted = true;
      clearPendingListeners();
      beginLabelDrag(dragRow, pointerId, sourceIndex, labelIds, startY);
    }

    function onPointerUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      clearPendingListeners();
      if (!dragStarted) {
        dragRow.style.cursor = "";
        document.body.style.cursor = "";
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function handleLabelClick(labelId: string) {
    closeLabelMenu();
    if (suppressLabelClickRef.current) {
      suppressLabelClickRef.current = false;
      return;
    }
    onSelectLabel(labelId);
    closeDrawer();
  }

  function closeLabelMenu() {
    setOpenMenuLabelId(null);
    setLabelMenuPosition(null);
  }

  function openLabelMenu(
    labelId: string,
    position: { top: number; left: number },
  ) {
    setOpenMenuLabelId(labelId);
    setLabelMenuPosition(clampLabelContextMenuPosition(position.top, position.left));
  }

  function toggleLabelMenuFromButton(
    labelId: string,
    button: HTMLButtonElement,
  ) {
    if (openMenuLabelId === labelId) {
      closeLabelMenu();
      return;
    }

    const rect = button.getBoundingClientRect();
    openLabelMenu(labelId, { top: rect.top, left: rect.right + 4 });
  }

  const openLabelMenuItem =
    openMenuLabelId !== null
      ? (labels.find((item) => item.id === openMenuLabelId) ?? null)
      : null;

  function handleListClick(listId: string) {
    if (editingListId === listId) return;
    if (suppressListClickRef.current) {
      suppressListClickRef.current = false;
      return;
    }

    onSelectList(listId);
    closeDrawer();
  }

  return (
    <>
      {compactDrawer && drawerOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onDrawerClose}
        />
      ) : null}
      <aside
        className={`flex h-full min-h-0 w-[250px] shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 ${sidebarBackground.className} ${
          compactDrawer
            ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : ""
        }`}
        style={sidebarBackground.style}
      >
        <nav className="list-panel-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isNavItemSelected =
              (item.action === "today" && isTodaySelected) ||
              (item.action === "inbox" && isInboxSelected) ||
              // (item.action === "next7days" && isNext7DaysSelected) ||
              (item.action === "important" && isImportantSelected) ||
              (item.action === "calendar" && isCalendarSelected);
            const navIconColor = isNavItemSelected
              ? "text-[#111111]"
              : "text-[#7c92a0]";

            return (
            item.action === "today" ||
            item.action === "inbox" ||
            item.action === "important" ||
            item.action === "calendar" ? (
            (() => {
              const showNavAccentBorder =
                isNavItemSelected && sidebarHoverPreview === null;

              return (
            <div
              key={item.label}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (item.action === "today") onSelectToday();
                else if (item.action === "inbox") onSelectInbox();
                else if (item.action === "important") onSelectImportant();
                else onSelectCalendar();
                closeDrawer();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                if (item.action === "today") onSelectToday();
                else if (item.action === "inbox") onSelectInbox();
                else if (item.action === "important") onSelectImportant();
                else onSelectCalendar();
                closeDrawer();
              }}
              className={`${getNavItemClassName(isNavItemSelected)} gap-[8px] px-4 rounded-r-[9px] ${
                showNavAccentBorder
                  ? "border-l-[2px] border-l-[#dadfdf]"
                  : "border-l-[2px] border-l-transparent"
              }`}
            >
              {item.action === "today" ? (
                <TodayCalendarIcon
                  className={`size-[19px] -ml-[2px] shrink-0 ${navIconColor}`}
                />
              ) : item.action === "inbox" ? (
                <LuInbox
                  className={`size-[15px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                />
              ) : item.action === "important" ? (
                <LuStar
                  className={`size-[15px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                />
              ) : (
                <BsCalendar3
                  className={`size-[14px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                />
              )}
              <span className="inline-block max-w-full truncate rounded-full pl-0 pr-3 py-[3.5px] text-zinc-700 transition-all duration-300 cursor-pointer dark:bg-zinc-800/60 dark:hover:bg-zinc-800/80">
                {item.label}
              </span>
            </div>
              );
            })()
            ) : (
            <button
              key={item.label}
              type="button"
              onClick={
                item.action === "search"
                  ? (event) =>
                      openSearchModal({
                        x: event.clientX,
                        y: event.clientY,
                      })
                  : undefined
              }
              className={
                item.action === "search"
                  ? "mx-[6px] my-2 flex h-[35px] w-auto bg-[#fcfbff] cursor-pointer items-center gap-2 self-stretch rounded-[7px] border border-[#e3e3e9] py-0 pl-3 pr-[3px] text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800/60"
                  : `${getItemClassName(isNavItemSelected)} gap-1 px-4`
              }
            >
              {item.action === "search" ? (
                <IoIosSearch
                  className="size-[18px] shrink-0 cursor-pointer"
                  aria-hidden="true"
                />
              ) : null}
              {item.label}
              {item.action === "search" ? (
                <div
                  className="ml-auto flex h-[25px] w-[37px] shrink-0 items-center justify-center rounded-full bg-[#EcEcEf] mr-[1px] border border-[#eee8ef]"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-px text-[#a1a7be]/80">
                    <MacCmdIcon className="size-[9px] shrink-0" />
                    <span className="text-[10px] font-bold leading-none text-[#a1a7ae]/80">
                      +K
                    </span>
                  </div>
                </div>
              ) : null}
            </button>
            )
            );
          })}
          
          <hr className="mt-2 mb-1.5 border-zinc-200 dark:border-zinc-800" />
          <div className="flex flex-col gap-2 px-4 text-xs font-medium text-zinc-400 dark:text-zinc-500">Lists</div>
          <div
            ref={listContainerRef}
            className="relative flex flex-col"
            onMouseLeave={() => {
              onSidebarHoverEnd?.();
            }}
          >
            {dropIndicatorTop !== null && (
              <div
                className="pointer-events-none absolute right-2 left-2 z-20 h-0.5 bg-blue-500"
                style={{ top: dropIndicatorTop }}
              />
            )}
            {sidebarLists.map((list) => {
              const isNameHovered =
                sidebarHoverPreview?.kind === "list" &&
                sidebarHoverPreview.listId === list.id;
              const isSelectedRow =
                isListSelected(list.id) &&
                list.id !== suppressListSelectionHighlightId;
              const dimOtherLists =
                sidebarHoverPreview?.kind === "list" &&
                !isNameHovered &&
                !isSelectedRow;

              return (
            <div
              key={list.id}
              data-list-id={list.id}
              onClick={() => handleListClick(list.id)}
              onMouseLeave={() => {
                if (isNameHovered) {
                  onSidebarHoverEnd?.();
                }
              }}
              className={`group relative flex h-[35px] w-[241px] items-center cursor-pointer ml-[6px] mr-[1px] mb-px rounded-[3px] transition-[background-color,filter] ${
                dimOtherLists ? "duration-400" : "duration-500"
              } ${getListRowClassName(list.id)} ${
                dimOtherLists ? "blur-[0.5px] brightness-[1.25]" : ""
              } ${
                isNameHovered || (isSelectedRow && sidebarHoverPreview === null)
                  ? "border-l-[2px] border-l-[#dadfdf]"
                  : "border-l-[2px] border-l-transparent"
              } ${onReorderLists ? "touch-none" : ""}`}
            >
              {onReorderLists ? (
                <span
                  aria-hidden="true"
                  className="flex size-[19px] shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
                  onPointerDown={(event) => handleListPointerDown(event, list.id)}
                >
                  <InteractIcon className="size-3.5 text-[#aaabad] opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              ) : null}
              <div
                className={`flex min-w-0 flex-1 items-center pr-[40px] text-left text-sm text-zinc-800 dark:text-zinc-50 ${
                  onReorderLists ? "pl-0 -ml-[4px]!" : "pl-[11px]"
                }`}
              >
                {editingListId === list.id ? (
                  <input
                    ref={listNameInputRef}
                    type="text"
                    value={listNameDraft}
                    onChange={(event) => setListNameDraft(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onBlur={() => commitListNameEdit(list)}
                    onKeyDown={(event) => handleListNameKeyDown(event, list)}
                    aria-label={`Rename ${list.name}`}
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none cursor-text dark:text-zinc-50"
                  />
                ) : (
                  <div className="min-w-0 flex items-center">
                    <div
                      className="inline-block text-zinc-700 hover:text-[#404040] hover:bg-[#dfdfe6]/80 max-w-full truncate pl-[6px] pr-3 py-[3.5px] rounded-full cursor-pointer dark:bg-zinc-800/60 dark:hover:bg-zinc-800/80 transition-all duration-300"
                      onMouseEnter={() => {
                        onSidebarHoverStart?.({ kind: "list", listId: list.id });
                      }}
                      onMouseLeave={() => {
                        onSidebarHoverEnd?.();
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        startListNameEdit(list);
                      }}
                    >
                      {list.name}
                    </div>
                    {isNameHovered && openMenuListId !== list.id ? (
                      <span
                        key={`list-arrow-${list.id}`}
                        aria-hidden="true"
                        className="list-name-hover-arrow pointer-events-none inline-flex shrink-0"
                      >
                        <LuArrowRight
                          className="size-[13px] text-[#777777] ml-1"
                          strokeWidth={2.25}
                        />
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
              <span className="pointer-events-none absolute right-[27px] top-1/2 -translate-y-1/2 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
                {taskCountByListId[list.id] ?? 0}
              </span>

              {isNameHovered && activeText ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-[41px] -translate-y-1/2 whitespace-nowrap text-[10px] text-zinc-350 dark:text-zinc-500"
                >
                  active
                </div>
              ) : null}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2"
                ref={openMenuListId === list.id ? menuRef : null}
              >
                <button
                  type="button"
                  aria-label={`Open menu for ${list.name}`}
                  aria-expanded={openMenuListId === list.id}
                  className={`flex size-[22px] items-center justify-center rounded-full text-zinc-500 transition-opacity hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50 cursor-pointer ${
                    openMenuListId === list.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenMenuListId((current) =>
                      current === list.id ? null : list.id,
                    );
                  }}
                >
                  <PiDotsThreeBold className="size-[15px] text-[#777777]" />
                </button>

                {openMenuListId === list.id && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <button
                      type="button"
                      className="flex h-[35px] w-full items-center px-3 text-left text-sm text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      onClick={() => openRenameModal(list)}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="flex h-[35px] w-full items-center px-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={() => openRemoveModal(list)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

            </div>
              );
            })}
          </div>

          <button
            type="button"
            className={`${getItemClassName(false)} gap-2 pr-4 pl-[15px] group hover:text-zinc-900 hover:bg-[#ececee]`}
            onClick={() => setIsAddListOpen(true)}
          >
            <div className="pl-3 pr-3 py-1 rounded-lg flex items-center gap-1 duration-200">
            {/* <div className="hover:bg-[#e1ddda] pl-2 pr-3 py-1 rounded-lg flex items-center gap-1 duration-200"> */}
              <LuPlus className="size-3.5 text-gray-500 group-hover:text-zinc-600 shrink-0" aria-hidden="true" />
              {/* <LuPlus className="size-3.5 text-[#d0d5dc] group-hover:text-zinc-600 shrink-0" aria-hidden="true" /> */}
              <div className="text-gray-500 group-hover:text-gray-800 ">Create list</div>
            </div>
          </button>

          <div
            className="mt-3 flex flex-col"
            onMouseLeave={() => onSidebarHoverEnd?.()}
          >
            <button
              type="button"
              onClick={() => setIsLabelsOpen((open) => !open)}
              aria-expanded={isLabelsOpen}
              className="flex w-full items-center gap-1 px-4 pb-1 text-left"
            >
              <BiChevronDown
                className={`size-3.5 shrink-0 text-zinc-400 transition-transform ${
                  isLabelsOpen ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                Labels
              </span>
            </button>

            {isLabelsOpen ? (
              <div
                ref={labelContainerRef}
                className="relative flex flex-col overflow-visible"
              >
                {labelDropIndicatorTop !== null && (
                  <div
                    className="pointer-events-none absolute right-2 left-2 z-20 h-0.5 bg-blue-500"
                    style={{ top: labelDropIndicatorTop }}
                  />
                )}
                {orderedLabels.length === 0 ? (
                  <p className="px-4 pb-1 text-xs text-zinc-400 dark:text-zinc-500">
                    No labels
                  </p>
                ) : (
                  orderedLabels.map((item) => {
                    const isSelected = selectedLabelId === item.id;
                    const showLabelAccentBorder =
                      isSelected && sidebarHoverPreview === null;
                    const labelColor = getLabelColor(item);

                    return (
                      <div
                        key={item.id}
                        data-label-id={item.id}
                        onPointerDown={(event) =>
                          handleLabelPointerDown(event, item.id)
                        }
                        onClick={() => handleLabelClick(item.id)}
                        className={`group relative flex items-center ${getItemClassName(isSelected)} text-[#5b5b5b] rounded-r-[4px] ${
                          isSelected ? "" : "hover:text-[#777777]"
                        } ${
                          showLabelAccentBorder
                            ? "border-l-[2px] border-l-[#dadfdf]"
                            : "border-l-[2px] border-l-transparent"
                        } ${onReorderLabels ? "touch-none cursor-pointer" : ""}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openLabelMenu(item.id, {
                            top: event.clientY,
                            left: event.clientX,
                          });
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center pl-5 pr-[40px] text-left">
                          <span className="min-w-0 flex-1 truncate text-[#777777]">
                            {item.label}
                          </span>
                        </div>
                        <span className="pointer-events-none absolute right-[22px] top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: labelColor.dot }}
                          />
                          <span className="min-w-[1ch] text-xs tabular-nums text-[#777777]">
                            {taskCountByLabelId[item.id] ?? 0}
                          </span>
                        </span>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2">
                          <button
                            type="button"
                            aria-label={`Open menu for ${item.label}`}
                            aria-expanded={openMenuLabelId === item.id}
                            className={`flex size-[22px] items-center justify-center rounded-full text-zinc-500 transition-opacity hover:bg-zinc-200/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-50 cursor-pointer ${
                              openMenuLabelId === item.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            }`}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleLabelMenuFromButton(item.id, event.currentTarget);
                            }}
                          >
                            <PiDotsThreeBold className="size-[15px] text-[#777777]" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}

            <button
              type="button"
              className={`${getItemClassName(false)} gap-2 pr-4 pl-[15px] group hover:bg-[#ececee]`}
              onClick={() => setIsAddLabelOpen(true)}
            >
              <div className="flex items-center gap-1 rounded-lg py-1 pl-3 pr-3 duration-200">
                <LuPlus
                  className="size-3.5 shrink-0 text-[#e04545]"
                  aria-hidden="true"
                />
                <span className="text-[#777b7e] group-hover:text-gray-800">
                  Add label
                </span>
              </div>
            </button>
          </div>

          <div className="mt-3 flex flex-col border-t border-zinc-150">
            <button
              type="button"
              className={`${getItemClassName(isCompletedOpen)} gap-1 px-4 `}
              onClick={() => setIsCompletedOpen((open) => !open)}
            >
              <BiCheckboxChecked
                className={`size-[21px] shrink-0 ${
                  isCompletedOpen ? "text-[#111111]" : "text-[#b5bcc1]"
                }`}
                aria-hidden="true"
              />
              <span className="text-[#777b7e]">Completed</span>
            </button>

            {isCompletedOpen &&
              (completedTasks.length === 0 ? (
                <p className="px-4 pb-3 text-xs text-zinc-400 dark:text-zinc-500">
                  No completed tasks
                </p>
              ) : (
                <div className="list-panel-scroll max-h-[280px] overflow-x-hidden overflow-y-auto">
                  {completedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={getItemClassName(
                        task.id === selectedTaskId,
                        completedItemClassName,
                      )}
                      onClick={() => {
                        onSelectCompletedTask(task.id, task.listId);
                        closeDrawer();
                      }}
                    >
                      <span className="w-full truncate text-zinc-400 line-through dark:text-zinc-500">
                        {task.name}
                      </span>
                      <span className="w-full truncate text-xs text-zinc-400 dark:text-zinc-500">
                        {task.listName}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </nav>

        <div className="flex justify-end items-center shrink-0 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            type="button"
            aria-label="Open settings"
            onClick={(event) => {
              openSettingsModal({
                x: event.clientX,
                y: event.clientY,
              });
              closeDrawer();
            }}
            className="flex size-8 items-center justify-center rounded-full text-[#7c92a0] transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50 cursor-pointer"
          >
            <FiSettings className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </aside>

      <SearchModal
        open={isSearchOpen}
        revealOrigin={searchRevealOrigin}
        tasks={searchTasks}
        completingTaskIds={completingTaskIds}
        checkAnimatingTaskIds={checkAnimatingTaskIds}
        onClose={() => setIsSearchOpen(false)}
        onSelectTask={(taskId, listId) => {
          onSelectSearchTask(taskId, listId);
          closeDrawer();
        }}
        onToggleTask={onToggleTask}
      />

      <SettingsModal
        open={isSettingsOpen}
        revealOrigin={settingsRevealOrigin}
        onClose={() => setIsSettingsOpen(false)}
      />

      {openLabelMenuItem && labelMenuPosition ? (
        <LabelContextMenu
          label={openLabelMenuItem}
          fixedPosition={labelMenuPosition}
          menuRef={labelMenuRef}
          onEditTitle={() => {
            setRenameLabel(openLabelMenuItem);
            closeLabelMenu();
          }}
          onDelete={() => {
            setRemoveLabel(openLabelMenuItem);
            closeLabelMenu();
          }}
          onColorChange={(color) => {
            onUpdateLabelColor(openLabelMenuItem.id, color);
          }}
        />
      ) : null}

      <RenameListModal
        open={isAddListOpen}
        title="New list"
        initialName=""
        onConfirm={(name) => {
          onAddList(name);
          setIsAddListOpen(false);
        }}
        onCancel={() => setIsAddListOpen(false)}
      />

      <RenameListModal
        open={isAddLabelOpen}
        title="New label"
        initialName=""
        confirmLabel="Add"
        onConfirm={(name) => {
          onAddLabel(name, LABEL_PRESET_COLORS[0]?.dot ?? "#4873c7");
          setIsAddLabelOpen(false);
        }}
        onCancel={() => setIsAddLabelOpen(false)}
      />

      <RenameListModal
        open={renameList !== null}
        initialName={renameList?.name ?? ""}
        onConfirm={(name) => {
          if (renameList) {
            onRenameList(renameList.id, name);
          }
          setRenameList(null);
        }}
        onCancel={() => setRenameList(null)}
      />

      <ConfirmModal
        open={removeList !== null}
        title="Remove list"
        message={`Are you sure you want to remove "${removeList?.name}"? All tasks in this list will be deleted.`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (removeList) {
            onRemoveList(removeList.id);
          }
          setRemoveList(null);
        }}
        onCancel={() => setRemoveList(null)}
      />

      <RenameListModal
        open={renameLabel !== null}
        title="Edit label title"
        initialName={renameLabel?.label ?? ""}
        onConfirm={(name) => {
          if (renameLabel) {
            onRenameLabel(renameLabel.id, name);
          }
          setRenameLabel(null);
        }}
        onCancel={() => setRenameLabel(null)}
      />

      <ConfirmModal
        open={removeLabel !== null}
        title="Delete label"
        message={`Are you sure you want to delete "${removeLabel?.label}"? It will be removed from all tasks.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (removeLabel) {
            onRemoveLabel(removeLabel.id);
          }
          setRemoveLabel(null);
        }}
        onCancel={() => setRemoveLabel(null)}
      />
    </>
  );
}
