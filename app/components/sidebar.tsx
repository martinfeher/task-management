"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BiCheckboxChecked, BiChevronDown } from "react-icons/bi";
import { BiSolidCheckboxChecked } from "react-icons/bi";

import { BsArchiveFill, BsFolder2Open } from "react-icons/bs";
import { IoIosSearch } from "react-icons/io";
import { LABEL_PRESET_COLORS } from "@/lib/label-colors";
import { getInboxListId } from "@/lib/inbox-list";
import { FiSettings } from "react-icons/fi";
import { getLabelDotColor } from "@/lib/label-colors";
import { IoMdPricetag } from "react-icons/io";

import { AiFillTag } from "react-icons/ai";

import { LuFolder, LuInbox, LuList, LuPlus, LuStar } from "react-icons/lu";
import { PiCalendarDots, PiDotsThreeBold } from "react-icons/pi";
import { LuCalendarDays } from "react-icons/lu";
import { useSidebarBackground } from "@/lib/sidebar-background";
import { useImportantEnabled } from "@/lib/important-settings";

import type {
  CompletedTask,
  ListFolder,
  SearchTask,
  SidebarHoverPreview,
  TaskLabel,
  TaskListItem,
  TodoList,
} from "./todo-app";
import {
  buildSidebarTopLevelEntries,
  computeNestedListMoveToTopLevel,
  computeSidebarTopLevelAfterReorder,
  getListsForFolder,
} from "@/lib/sidebar-list-layout";
import {
  getFolderDropTargetFromPoint,
  getListDropIndex,
  getSidebarTopLevelRowElements,
} from "./list-reorder";
import {
  applyLabelRowShifts,
  getLabelDropIndex,
  getLabelRowElements,
  reorderLabelIds,
} from "./label-reorder";
import { getReorderTargetIndex } from "./task-reorder";
import { ConfirmModal } from "./confirm-modal";
import { MacCmdIcon } from "./mac-cmd-icon";
import { EditListModal } from "./edit-list-modal";
import { RenameListModal } from "./rename-list-modal";
import { getListColor } from "@/lib/list-colors";
import { LabelContextMenu, clampLabelContextMenuPosition } from "./label-context-menu";
import {
  ListContextMenu,
  clampListContextMenuPosition,
} from "./list-context-menu";
import {
  FolderContextMenu,
  clampFolderContextMenuPosition,
} from "./folder-context-menu";
import { TodayCalendarIcon } from "./today-calendar-icon";


const SearchModal = dynamic(
  () => import("./search-modal").then((module) => module.SearchModal),
  { ssr: false },
);

const SettingsModal = dynamic(
  () => import("./settings-modal").then((module) => module.SettingsModal),
  { ssr: false },
);

const ArchiveModal = dynamic(
  () => import("./archive-modal").then((module) => module.ArchiveModal),
  { ssr: false },
);

const NAV_ITEM_TEXT_CLASS = {
  today: "ptxt-list-nav-today",
  inbox: "ptxt-list-nav-inbox",
  important: "ptxt-list-nav-important",
  calendar: "ptxt-list-nav-calendar",
} as const;

const NAV_ITEM_ICON_CLASS = {
  today: "ptxt-list-nav-today-icon",
  inbox: "ptxt-list-nav-inbox-icon",
  important: "ptxt-list-nav-important-icon",
  calendar: "ptxt-list-nav-calendar-icon",
} as const;

const NAV_ITEMS = [
  { label: "Search", action: "search" as const },
  { label: "Today", action: "today" as const },
  { label: "Inbox", action: "inbox" as const },
  // { label: "Next 7 days", action: "next7days" as const },
  { label: "Important", action: "important" as const },
  { label: "Calendar", action: "calendar" as const },
];

const EXPANDED_FOLDERS_STORAGE_KEY = "sidebar-expanded-list-folders";

function readExpandedFolderIds() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(EXPANDED_FOLDERS_STORAGE_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === "string"))
      : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function writeExpandedFolderIds(folderIds: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    EXPANDED_FOLDERS_STORAGE_KEY,
    JSON.stringify([...folderIds]),
  );
}

type SidebarProps = {
  lists: TodoList[];
  folders: ListFolder[];
  labels: TaskLabel[];
  taskCountByListId: Record<string, number>;
  taskCountByLabelId: Record<string, number>;
  navTaskCounts: {
    today: number;
    inbox: number;
    important: number;
  };
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
  onAddFolder: (name: string) => void;
  onAddLabel: (name: string, color: string) => void;
  onRenameList: (listId: string, name: string) => void;
  onUpdateList: (
    listId: string,
    input: { name: string; folderId: string | null; color: string | null },
  ) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onRemoveList: (listId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onMoveListToFolder: (listId: string, folderId: string | null) => void;
  onRenameLabel: (labelId: string, name: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onUpdateLabelColor: (labelId: string, color: string) => void;
  onReorderLists?: (payload: {
    lists: TodoList[];
    folders: ListFolder[];
  }) => void;
  onReorderLabels?: (labelIds: string[]) => void;
  onArchivedTasksRestored?: (
    tasks: import("@/app/actions/todo").RestoredTaskItem[],
  ) => void;
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

const SIDEBAR_ROW_COUNT_CLASS =
  "pointer-events-none absolute right-[var(--sidebar-row-trailing-inset)] top-1/2 -translate-y-1/2 text-xs tabular-nums ptxt-400 transition-opacity group-hover:opacity-0 dark:ptxt-500";

const SIDEBAR_ROW_COUNT_STATIC_CLASS =
  "pointer-events-none absolute right-[var(--sidebar-row-trailing-inset)] top-1/2 -translate-y-1/2 text-xs tabular-nums ptxt-400 dark:ptxt-500";

const SIDEBAR_ROW_MENU_WRAPPER_CLASS =
  "absolute right-[var(--sidebar-row-trailing-inset)] top-1/2 -translate-y-1/2";

function getSidebarRowMenuButtonClass(menuOpen: boolean) {
  return `flex size-[22px] items-center justify-center rounded-full ptxt-500 text-[12px] transition-opacity hover:bg-zinc-200/80 hover:ptxt-900 dark:ptxt-400 dark:hover:bg-zinc-700 dark:hover:ptxt-50 cursor-pointer ${
    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
  }`;
}

function shouldStartListDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return true;

  return !target.closest(
    "input, button, textarea, select, a, [role='menu'], [role='menuitem']",
  );
}

const itemClassName =
  "flex ml-[2px] gap-[6px]! mb-px w-[230px] pl-[14px]! items-center rounded-r-[6px]! rounded-l-[7px] text-left text-sm transition-colors cursor-pointer";

const completedItemClassName =
  "flex mx-[4px] mb-px min-h-[44px] w-auto flex-col items-start justify-center gap-0 rounded-[3px] px-4 py-1 text-left text-sm transition-colors";

function getItemClassName(isSelected: boolean, baseClassName = itemClassName) {
  const heightClass =
    baseClassName === completedItemClassName ? "" : "h-[35px]";

  return `${baseClassName} ${heightClass} ${
    isSelected
      ? "bg-[#e9ebee] font-medium ptxt-950 dark:bg-zinc-800 dark:ptxt-50"
      : "ptxt-900 hover:bg-zinc-200/60 dark:ptxt-50 dark:hover:bg-zinc-800/60"
  }`;
}

export function Sidebar({
  lists,
  folders,
  labels,
  taskCountByListId,
  taskCountByLabelId,
  navTaskCounts,
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
  onAddFolder,
  onAddLabel,
  onRenameList,
  onUpdateList,
  onRenameFolder,
  onRemoveList,
  onRemoveFolder,
  onMoveListToFolder,
  onRenameLabel,
  onRemoveLabel,
  onUpdateLabelColor,
  onReorderLists,
  onReorderLabels,
  onArchivedTasksRestored,
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
  const [orderedFolders, setOrderedFolders] = useState(folders);
  const [orderedLabels, setOrderedLabels] = useState(labels);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [dropIndicatorTop, setDropIndicatorTop] = useState<number | null>(null);
  const [listDragOverFolderId, setListDragOverFolderId] = useState<string | null>(
    null,
  );
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
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveRevealOrigin, setArchiveRevealOrigin] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const completedFooterRef = useRef<HTMLDivElement>(null);
  const [openMenuListId, setOpenMenuListId] = useState<string | null>(null);
  const [listMenuPosition, setListMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [openMenuFolderId, setOpenMenuFolderId] = useState<string | null>(null);
  const [folderMenuPosition, setFolderMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [openMenuLabelId, setOpenMenuLabelId] = useState<string | null>(null);
  const [labelMenuPosition, setLabelMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [renameList, setRenameList] = useState<TodoList | null>(null);
  const [editList, setEditList] = useState<TodoList | null>(null);
  const [removeList, setRemoveList] = useState<TodoList | null>(null);
  const [renameFolder, setRenameFolder] = useState<ListFolder | null>(null);
  const [removeFolder, setRemoveFolder] = useState<ListFolder | null>(null);
  const [renameLabel, setRenameLabel] = useState<TaskLabel | null>(null);
  const [removeLabel, setRemoveLabel] = useState<TaskLabel | null>(null);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [isBottomAddMenuOpen, setIsBottomAddMenuOpen] = useState(false);
  const bottomAddMenuRef = useRef<HTMLDivElement>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [listNameDraft, setListNameDraft] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const labelMenuRef = useRef<HTMLDivElement>(null);
  const listPanelScrollRef = useRef<HTMLElement>(null);
  const [hasVerticalScroll, setHasVerticalScroll] = useState(false);
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
    dragMode: "top-level" | "nested-list";
    sourceIndex: number;
    dropIndex: number;
    pointerId: number;
    startClientY: number;
    rowHeight: number;
    appliedTargetIndex: number | null;
    folderDropTargetId: string | null;
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
  const suppressFolderClickRef = useRef(false);
  const suppressLabelClickRef = useRef(false);
  const expandedFoldersHydratedRef = useRef(false);


  useEffect(() => {
    const element = listPanelScrollRef.current;
    if (!element) return;

    function updateVerticalScrollState() {
      const scrollElement = listPanelScrollRef.current;
      if (!scrollElement) return;
      setHasVerticalScroll(scrollElement.scrollHeight > scrollElement.clientHeight);
    }

    updateVerticalScrollState();

    const resizeObserver = new ResizeObserver(updateVerticalScrollState);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    isCompletedOpen,
    isLabelsOpen,
    labels.length,
    folders.length,
    lists.length,
    orderedFolders.length,
    orderedLabels.length,
    orderedLists.length,
  ]);

  useEffect(() => {
    setOrderedLists(lists);
  }, [lists]);

  useEffect(() => {
    setOrderedFolders(folders);
  }, [folders]);

  useEffect(() => {
    setOrderedLabels(labels);
  }, [labels]);

  useEffect(() => {
    if (expandedFoldersHydratedRef.current) return;
    expandedFoldersHydratedRef.current = true;
    setExpandedFolderIds(readExpandedFolderIds());
  }, []);

  useEffect(() => {
    if (!expandedFoldersHydratedRef.current) return;
    writeExpandedFolderIds(expandedFolderIds);
  }, [expandedFolderIds]);

  useEffect(() => {
    if (!selectedListId) return;

    const selectedList = orderedLists.find((list) => list.id === selectedListId);
    if (!selectedList?.folderId) return;

    setExpandedFolderIds((current) => {
      if (current.has(selectedList.folderId!)) return current;
      return new Set([...current, selectedList.folderId!]);
    });
  }, [orderedLists, selectedListId]);

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

  function openArchiveModal(origin: { x: number; y: number }) {
    setArchiveRevealOrigin(origin);
    setIsArchiveOpen(true);
    setIsCompletedOpen(false);
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
      if (
        isCompletedOpen &&
        completedFooterRef.current &&
        !completedFooterRef.current.contains(event.target as Node)
      ) {
        setIsCompletedOpen(false);
      }
      if (!menuRef.current?.contains(event.target as Node)) {
        closeListMenu();
      }
      if (!folderMenuRef.current?.contains(event.target as Node)) {
        closeFolderMenu();
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
  }, [isCompletedOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (
        isSearchOpen ||
        renameList ||
        editList ||
        removeList ||
        renameFolder ||
        removeFolder ||
        isAddListOpen ||
        isAddFolderOpen ||
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

      if (openMenuFolderId) {
        event.preventDefault();
        closeFolderMenu();
        return;
      }

      if (openMenuListId) {
        event.preventDefault();
        closeListMenu();
      }
    }

    if (!openMenuLabelId && !openMenuListId && !openMenuFolderId) return;

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [
    openMenuLabelId,
    openMenuListId,
    openMenuFolderId,
    isSearchOpen,
    renameList,
    editList,
    removeList,
    renameFolder,
    removeFolder,
    isAddListOpen,
    isAddFolderOpen,
    isAddLabelOpen,
    renameLabel,
    removeLabel,
  ]);

  useEffect(() => {
    if (!isBottomAddMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (bottomAddMenuRef.current?.contains(target)) return;
      setIsBottomAddMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isBottomAddMenuOpen]);

  const inboxListId = getInboxListId(lists);
  const sidebarTopLevelEntries = buildSidebarTopLevelEntries(
    orderedFolders,
    orderedLists,
    inboxListId,
  );

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

    if (isTaskDropTarget) {
      return "sidebar-list-item-drop-target bg-blue-100 ring-2 ring-inset ring-blue-400 dark:bg-blue-950/70 dark:ring-blue-500";
    }

    if (isSelected) {
      return "sidebar-list-item-selected dark:bg-zinc-800/60";
    }

    return "sidebar-list-item";
  }

  function getNavItemClassName(
    isSelected: boolean,
  ) {
    if (isSelected) {
      return `${itemClassName} sidebar-list-nav-item sidebar-list-nav-item-selected group h-[35px] font-normal ptxt-950 dark:bg-zinc-800 dark:ptxt-50`;
    }

    return `${itemClassName} sidebar-list-nav-item group h-[35px] ptxt-900 dark:ptxt-50`;
  }

  function closeListMenu() {
    setOpenMenuListId(null);
    setListMenuPosition(null);
  }

  function closeFolderMenu() {
    setOpenMenuFolderId(null);
    setFolderMenuPosition(null);
  }

  function toggleFolderExpanded(folderId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function handleFolderClick(folderId: string) {
    if (suppressFolderClickRef.current) {
      suppressFolderClickRef.current = false;
      return;
    }

    toggleFolderExpanded(folderId);
  }

  function openFolderMenu(
    folderId: string,
    position: { top: number; left: number },
  ) {
    setOpenMenuFolderId(folderId);
    setFolderMenuPosition(
      clampFolderContextMenuPosition(position.top, position.left),
    );
  }

  function toggleFolderMenuFromButton(
    folderId: string,
    button: HTMLButtonElement,
  ) {
    if (openMenuFolderId === folderId) {
      closeFolderMenu();
      return;
    }

    const rect = button.getBoundingClientRect();
    openFolderMenu(folderId, {
      top: rect.bottom + 4,
      left: rect.right - 144,
    });
  }

  function openRenameFolderModal(folder: ListFolder) {
    closeFolderMenu();
    setRenameFolder(folder);
  }

  function openRemoveFolderModal(folder: ListFolder) {
    closeFolderMenu();
    setRemoveFolder(folder);
  }

  function openListMenu(
    listId: string,
    position: { top: number; left: number },
  ) {
    setOpenMenuListId(listId);
    setListMenuPosition(
      clampListContextMenuPosition(position.top, position.left),
    );
  }

  function toggleListMenuFromButton(
    listId: string,
    button: HTMLButtonElement,
  ) {
    if (openMenuListId === listId) {
      closeListMenu();
      return;
    }

    const rect = button.getBoundingClientRect();
    openListMenu(listId, {
      top: rect.bottom + 4,
      left: rect.right - 144,
    });
  }

  function openEditListModal(list: TodoList) {
    closeListMenu();
    setEditList(list);
  }

  function openRenameModal(list: TodoList) {
    closeListMenu();
    setRenameList(list);
  }

  function openRemoveModal(list: TodoList) {
    closeListMenu();
    setRemoveList(list);
  }

  function startListNameEdit(list: TodoList) {
    closeListMenu();
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

  function resetSidebarTopLevelRowShifts(
    container: HTMLElement,
    sourceRow: HTMLElement,
  ) {
    getSidebarTopLevelRowElements(container).forEach((row) => {
      row.classList.remove("task-row-shifting");
      if (row !== sourceRow) {
        row.style.transform = "";
      }
    });
  }

  function handleSidebarTopLevelDragMove(event: PointerEvent) {
    const dragState = dragStateRef.current;
    const container = listContainerRef.current;
    if (!dragState || !container) return;

    const deltaY = event.clientY - dragState.startClientY;
    dragState.sourceRow.style.translate = `0px ${deltaY}px`;

    const sourceRowKind = dragState.sourceRow.dataset.sidebarReorderRow;
    const draggedListId =
      dragState.dragMode === "nested-list"
        ? dragState.sourceRow.dataset.sidebarNestedListId
        : sourceRowKind === "list"
          ? dragState.sourceRow.dataset.sidebarReorderId
          : null;
    const draggedList = draggedListId
      ? orderedLists.find((list) => list.id === draggedListId)
      : null;
    const isListFolderDropDrag =
      Boolean(draggedList) &&
      (dragState.dragMode === "nested-list" || sourceRowKind === "list");

    if (isListFolderDropDrag && draggedList && draggedListId) {
      const folderDropTargetId = getFolderDropTargetFromPoint(
        event.clientX,
        event.clientY,
        container,
      );
      const canDropOnFolder =
        folderDropTargetId !== null &&
        draggedList.folderId !== folderDropTargetId;

      if (canDropOnFolder) {
        if (dragState.folderDropTargetId !== folderDropTargetId) {
          dragState.folderDropTargetId = folderDropTargetId;
          setListDragOverFolderId(folderDropTargetId);
          setDropIndicatorTop(null);
          resetSidebarTopLevelRowShifts(container, dragState.sourceRow);
          dragState.appliedTargetIndex = null;
        }
        return;
      }
    }

    if (dragState.folderDropTargetId) {
      dragState.folderDropTargetId = null;
      setListDragOverFolderId(null);
      if (dragState.dragMode === "top-level") {
        getSidebarTopLevelRowElements(container).forEach((row) => {
          if (row !== dragState.sourceRow) {
            row.classList.add("task-row-shifting");
          }
        });
      }
    }

    const rows = getSidebarTopLevelRowElements(container);
    const draggingIndex =
      dragState.dragMode === "nested-list" ? null : dragState.sourceIndex;
    const dropIndex = getListDropIndex(event.clientY, rows, draggingIndex);
    dragState.dropIndex = dropIndex;

    if (dragState.dragMode === "top-level") {
      const targetIndex = getReorderTargetIndex(
        dragState.sourceIndex,
        dropIndex,
      );
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

    setDropIndicatorTop(indicatorTop);
  }

  function handleSidebarTopLevelDragEnd() {
    const dragState = dragStateRef.current;
    const wasDragging = dragState !== null;

    document.removeEventListener("pointermove", handleSidebarTopLevelDragMove);
    document.removeEventListener("pointerup", handleSidebarTopLevelDragEnd);
    document.removeEventListener("pointercancel", handleSidebarTopLevelDragEnd);
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

      const container = listContainerRef.current;
      if (container) {
        getSidebarTopLevelRowElements(container).forEach((row) => {
          row.classList.remove("task-row-shifting");
          if (row !== dragState.sourceRow) {
            row.style.transform = "";
          }
        });
      }
    }

    setDropIndicatorTop(null);
    setListDragOverFolderId(null);

    if (dragState) {
      const sourceRowKind = dragState.sourceRow.dataset.sidebarReorderRow;
      const draggedListId =
        dragState.dragMode === "nested-list"
          ? dragState.sourceRow.dataset.sidebarNestedListId
          : sourceRowKind === "list"
            ? dragState.sourceRow.dataset.sidebarReorderId
            : null;
      const draggedList = draggedListId
        ? orderedLists.find((list) => list.id === draggedListId)
        : null;

      if (draggedList && dragState.folderDropTargetId) {
        onMoveListToFolder(draggedList.id, dragState.folderDropTargetId);
        setExpandedFolderIds((current) =>
          new Set([...current, dragState.folderDropTargetId!]),
        );
      } else if (
        dragState.dragMode === "nested-list" &&
        draggedListId &&
        onReorderLists
      ) {
        const listsWithUngrouped = orderedLists.map((list) =>
          list.id === draggedListId ? { ...list, folderId: null } : list,
        );
        const nextState = computeNestedListMoveToTopLevel(
          orderedFolders,
          listsWithUngrouped,
          inboxListId,
          draggedListId,
          dragState.dropIndex,
        );

        setOrderedLists(nextState.lists);
        setOrderedFolders(nextState.folders);
        onMoveListToFolder(draggedListId, null);
        onReorderLists({
          lists: nextState.lists,
          folders: nextState.folders,
        });
      }
    }

    if (
      dragState &&
      onReorderLists &&
      !dragState.folderDropTargetId &&
      dragState.dragMode === "top-level"
    ) {
      const nextState = computeSidebarTopLevelAfterReorder(
        orderedFolders,
        orderedLists,
        inboxListId,
        dragState.sourceIndex,
        dragState.dropIndex,
      );

      if (nextState.changed) {
        setOrderedLists(nextState.lists);
        setOrderedFolders(nextState.folders);
        onReorderLists({
          lists: nextState.lists,
          folders: nextState.folders,
        });
      }
    }

    if (wasDragging && dragState) {
      if (dragState.sourceRow.dataset.sidebarReorderRow === "folder") {
        suppressFolderClickRef.current = true;
      } else {
        suppressListClickRef.current = true;
      }
    }

    dragStateRef.current = null;
  }

  function beginSidebarTopLevelDrag(
    sourceRow: HTMLElement,
    pointerId: number,
    sourceIndex: number,
    startClientY: number,
    dragMode: "top-level" | "nested-list" = "top-level",
  ) {
    const rowHeight = sourceRow.getBoundingClientRect().height;

    dragStateRef.current = {
      sourceRow,
      captureTarget: sourceRow,
      dragMode,
      sourceIndex,
      dropIndex: dragMode === "nested-list" ? 0 : sourceIndex,
      pointerId,
      startClientY,
      rowHeight,
      appliedTargetIndex: null,
      folderDropTargetId: null,
    };

    const container = listContainerRef.current;
    if (container && dragMode === "top-level") {
      getSidebarTopLevelRowElements(container).forEach((row) => {
        if (row !== sourceRow) row.classList.add("task-row-shifting");
      });
    }

    sourceRow.classList.add("task-row-dragging");
    sourceRow.style.scale = "1.02";
    sourceRow.setPointerCapture(pointerId);
    sourceRow.style.cursor = "grabbing";
    document.body.style.cursor = "grabbing";
    document.addEventListener("pointermove", handleSidebarTopLevelDragMove);
    document.addEventListener("pointerup", handleSidebarTopLevelDragEnd);
    document.addEventListener("pointercancel", handleSidebarTopLevelDragEnd);
  }

  function handleNestedListPointerDown(
    event: React.PointerEvent<HTMLElement>,
    listId: string,
  ) {
    if (editingListId === listId) return;
    if (!onMoveListToFolder || event.button !== 0) return;
    if (!shouldStartListDrag(event.target)) return;

    const dragRow = event.currentTarget;

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    dragRow.style.cursor = "move";
    document.body.style.cursor = "move";
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
      beginSidebarTopLevelDrag(dragRow, pointerId, -1, startY, "nested-list");
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

  function handleSidebarTopLevelPointerDown(
    event: React.PointerEvent<HTMLElement>,
    rowKind: "list" | "folder",
    rowId: string,
  ) {
    if (rowKind === "list" && editingListId === rowId) return;
    if (!onReorderLists || event.button !== 0) return;
    if (!shouldStartListDrag(event.target)) return;

    const container = listContainerRef.current;
    if (!container) return;

    const rows = getSidebarTopLevelRowElements(container);
    const sourceRow = rows.find(
      (row) =>
        row.dataset.sidebarReorderRow === rowKind &&
        row.dataset.sidebarReorderId === rowId,
    );
    if (!sourceRow) return;

    const dragRow = sourceRow;
    const sourceIndex = rows.indexOf(dragRow);
    if (sourceIndex < 0) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let dragStarted = false;

    dragRow.style.cursor = "move";
    document.body.style.cursor = "move";
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
      beginSidebarTopLevelDrag(dragRow, pointerId, sourceIndex, startY);
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

  const openListMenuItem =
    openMenuListId !== null
      ? (orderedLists.find((item) => item.id === openMenuListId) ?? null)
      : null;

  const openFolderMenuItem =
    openMenuFolderId !== null
      ? (orderedFolders.find((item) => item.id === openMenuFolderId) ?? null)
      : null;

  const openLabelMenuItem =
    openMenuLabelId !== null
      ? (orderedLabels.find((item) => item.id === openMenuLabelId) ?? null)
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

  function renderListRow(list: TodoList, nested = false) {
    const isNameHovered =
      sidebarHoverPreview?.kind === "list" &&
      sidebarHoverPreview.listId === list.id;
    const allowReorder = Boolean(onReorderLists) && !nested && !list.folderId;
    const allowNestedDrag = nested && Boolean(onMoveListToFolder);
    const isDraggable = allowReorder || allowNestedDrag;

    return (
      <div
        key={list.id}
        {...(allowReorder
          ? {
              "data-list-id": list.id,
              "data-sidebar-reorder-row": "list",
              "data-sidebar-reorder-id": list.id,
            }
          : allowNestedDrag
            ? {
                "data-sidebar-nested-list-id": list.id,
              }
            : {})}
        onPointerDown={(event) => {
          if (allowReorder) {
            handleSidebarTopLevelPointerDown(event, "list", list.id);
            return;
          }
          if (allowNestedDrag) {
            handleNestedListPointerDown(event, list.id);
          }
        }}
        onClick={() => handleListClick(list.id)}
        onContextMenu={(event) => {
          if (editingListId === list.id) return;

          event.preventDefault();
          event.stopPropagation();
          openListMenu(list.id, {
            top: event.clientY,
            left: event.clientX,
          });
        }}
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onSidebarHoverStart?.({
            kind: "list",
            listId: list.id,
            anchorTop: rect.top,
            anchorLeft: rect.left,
            anchorWidth: rect.width,
            anchorHeight: rect.height,
          });
        }}
        onMouseLeave={() => {
          if (isNameHovered) {
            onSidebarHoverEnd?.();
          }
        }}
        className={`group relative mb-1 flex h-[34px] cursor-pointer items-center gap-2 rounded-md px-3 transition-[background-color] duration-200 ${
          nested ? "ml-[13px]" : "ml-[3px]"
        } ${isNameHovered ? "bg-zinc-200/70 dark:bg-zinc-800/70" : ""} ${getListRowClassName(list.id)} ${
          isDraggable ? "touch-none" : ""
        }`}
      >
        <LuList
          className="size-[14px] shrink-0"
          style={{ color: getListColor(list) }}
          aria-hidden="true"
        />
        <div className="group min-w-0 flex-1 pr-8 text-left">
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
              className="min-w-0 w-full bg-transparent text-sm ptxt-list-items outline-none cursor-text"
            />
          ) : (
            <span
              className="block truncate text-sm ptxt-list-items"
              onDoubleClick={(event) => {
                event.stopPropagation();
                startListNameEdit(list);
              }}
            >
              {list.name}
            </span>
          )}
        </div>
        <span
          className={`${SIDEBAR_ROW_COUNT_CLASS} ${
            openMenuListId === list.id ? "opacity-0" : ""
          }`}
        >
          {taskCountByListId[list.id] ?? 0}
        </span>
        <div className={SIDEBAR_ROW_MENU_WRAPPER_CLASS}>
          <button
            type="button"
            aria-label={`Open menu for ${list.name}`}
            aria-expanded={openMenuListId === list.id}
            aria-haspopup="menu"
            className={`${getSidebarRowMenuButtonClass(openMenuListId === list.id)} -mr-[6px]`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              toggleListMenuFromButton(list.id, event.currentTarget);
            }}
          >
            <PiDotsThreeBold className="size-[15px] ptxt-500" />
          </button>
        </div>
      </div>
    );
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
        className={`panel-text-scope flex h-full min-h-0 w-[244px] shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 ${sidebarBackground.className} ${
          compactDrawer
            ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
                drawerOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : ""
        }`}
        style={sidebarBackground.style}
      >
        <nav
          ref={listPanelScrollRef}
          data-has-vertical-scroll={hasVerticalScroll ? "true" : undefined}
          className="list-panel-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
        >
          {visibleNavItems.map((item) => {
            const isNavItemSelected =
              (item.action === "today" && isTodaySelected) ||
              (item.action === "inbox" && isInboxSelected) ||
              // (item.action === "next7days" && isNext7DaysSelected) ||
              (item.action === "important" && isImportantSelected) ||
              (item.action === "calendar" && isCalendarSelected);
            const navTextClass =
              item.action === "today" ||
              item.action === "inbox" ||
              item.action === "important" ||
              item.action === "calendar"
                ? NAV_ITEM_TEXT_CLASS[item.action]
                : null;
            const navIconClass =
              item.action === "today" ||
              item.action === "inbox" ||
              item.action === "important" ||
              item.action === "calendar"
                ? NAV_ITEM_ICON_CLASS[item.action]
                : null;
            const navIconColor = isNavItemSelected
              ? "text-[#7474bb]"
              : navIconClass ?? "ptxt-400";

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
              className={`${getNavItemClassName(isNavItemSelected)} relative gap-[8px] px-4 rounded-r-[9px] ${
                showNavAccentBorder
                  ? "border-l-[2px] border-l-[#dadfdf]"
                  : "border-l-[2px] border-l-transparent"
              }`}
            >
              {item.action === "today" ? (
                <TodayCalendarIcon
                  className={`size-[19px] -ml-[2px] shrink-0 ${navIconColor}`}
                  strokeWidth={1}
                  // strokeWidth={0.875}
                />
              ) : item.action === "inbox" ? (
                <LuInbox
                  className={`size-[15px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                  strokeWidth={1}
                />
              ) : item.action === "important" ? (
                <LuStar
                  className={`size-[15px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                  strokeWidth={1}
                />
              ) : (
                <LuCalendarDays
                  className={`size-[16px] shrink-0 ${navIconColor}`}
                  aria-hidden="true"
                  strokeWidth={1.2}
                />
              )}
              <span
                className={`inline-block min-w-0 max-w-full flex-1 truncate rounded-full pl-0 pr-8 py-[3.5px] ${navTextClass} transition-all duration-300 cursor-pointer`}
              >
                {item.label}
              </span>
              {item.action === "today" ? (
                <span className={SIDEBAR_ROW_COUNT_STATIC_CLASS}>
                  {navTaskCounts.today}
                </span>
              ) : item.action === "inbox" ? (
                <span className={SIDEBAR_ROW_COUNT_STATIC_CLASS}>
                  {navTaskCounts.inbox}
                </span>
              ) : item.action === "important" ? (
                <span className={SIDEBAR_ROW_COUNT_STATIC_CLASS}>
                  {navTaskCounts.important}
                </span>
              ) : null}
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
                  ? "ml-[14px] my-2 flex py-[3px] h-[35px]! w-auto bg-[#fcfbff] cursor-pointer items-center gap-2 self-stretch rounded-[7px] border border-[#e3e3e9] py-0 pl-[8px] pr-[3px] text-left text-sm ptxt-list-search transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
                  : `${getItemClassName(isNavItemSelected)} gap-1 px-4 h-[35px]!`
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
                  <div className="flex items-center gap-px text-zinc-400/80">
                    <MacCmdIcon className="size-[9px] shrink-0" />
                    <span className="text-[10px] font-bold leading-none text-zinc-400/80">
                      +K
                    </span>
                  </div>
                </div>
              ) : null}
            </button>
            )
            );
          })}
          
          <div className="flex flex-col overflow-visible">
            <div className="group/lists-header relative z-[200] flex items-center overflow-visible px-4">
              <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.06em] ptxt-400 dark:ptxt-500">
                Lists
              </span>
              <button
                type="button"
                aria-label="Add list"
                className="group/add-list relative -mr-[9px] flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md ptxt-400 opacity-0 transition-[opacity,colors] hover:bg-zinc-200/60 hover:ptxt-600 focus-visible:opacity-100 group-hover/lists-header:opacity-100 dark:hover:bg-zinc-800/60 dark:hover:ptxt-300"
                onClick={() => setIsAddListOpen(true)}
              >
                <LuPlus className="size-3.5 text-[#acadb2]" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="task-date-picker-remove-tooltip add-task-date-tooltip pointer-events-none absolute right-0 bottom-[calc(100%+8px)] z-[200] whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/add-list:opacity-100"
                >
                  Add List
                </span>
              </button>
            </div>
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
            {sidebarTopLevelEntries.map((entry) => {
              if (entry.kind === "list") {
                return renderListRow(entry.list);
              }

              const folder = entry.folder;
              const isExpanded = expandedFolderIds.has(folder.id);
              const isListDragOver = listDragOverFolderId === folder.id;
              const showChevronOpen = isExpanded || isListDragOver;
              const folderLists = getListsForFolder(orderedLists, folder.id);

              return (
                <div key={folder.id} className="flex flex-col">
                  <div
                    data-folder-id={folder.id}
                    data-sidebar-reorder-row="folder"
                    data-sidebar-reorder-id={folder.id}
                    onPointerDown={(event) => {
                      if (!onReorderLists) return;
                      handleSidebarTopLevelPointerDown(event, "folder", folder.id);
                    }}
                    onClick={() => handleFolderClick(folder.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openFolderMenu(folder.id, {
                        top: event.clientY,
                        left: event.clientX,
                      });
                    }}
                    className={`group relative ml-[3px] mb-1 flex h-[34px] cursor-pointer items-center rounded-md pr-3 pl-1.5 transition-[background-color] duration-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 ${
                      isListDragOver
                        ? "bg-zinc-200/70 ring-2 ring-inset ring-blue-400 dark:bg-zinc-800/70 dark:ring-blue-500"
                        : ""
                    } ${onReorderLists ? "touch-none" : ""}`}
                  >
                    <BiChevronDown
                      className={`size-4 shrink-0 text-[#acadb7] transition-transform duration-200 ${
                        showChevronOpen ? "" : "-rotate-90"
                      }`}
                      aria-hidden="true"
                    />
                    {isExpanded ? (
                      <BsFolder2Open
                        className="size-[15px] mr-1 shrink-0 text-[#acadb7]"
                        aria-hidden="true"
                      />
                    ) : (
                      <LuFolder
                        className="size-[15px] mr-1 shrink-0 text-[#acadb7]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate pr-8 text-left text-sm ptxt-list-items">
                      {folder.name}
                    </span>
                    <div className={SIDEBAR_ROW_MENU_WRAPPER_CLASS}>
                      <button
                        type="button"
                        aria-label={`Open menu for ${folder.name}`}
                        aria-expanded={openMenuFolderId === folder.id}
                        aria-haspopup="menu"
                        className={`${getSidebarRowMenuButtonClass(openMenuFolderId === folder.id)} -mr-[6px]`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleFolderMenuFromButton(
                            folder.id,
                            event.currentTarget,
                          );
                        }}
                      >
                        <PiDotsThreeBold className="size-[15px] ptxt-500" />
                      </button>
                    </div>
                  </div>
                  {isExpanded
                    ? folderLists.map((list) => renderListRow(list, true))
                    : null}
                </div>
              );
            })}
            <div
              ref={bottomAddMenuRef}
              className="relative ml-[3px] w-fit"
              onMouseEnter={() => setIsBottomAddMenuOpen(true)}
              onMouseLeave={() => setIsBottomAddMenuOpen(false)}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isBottomAddMenuOpen}
                aria-label="Add list or folder"
                onClick={() => setIsBottomAddMenuOpen((open) => !open)}
                className="flex ml-[2px] cursor-pointer items-center -mt-[10px] px-3 py-2 text-left text-[13px] text-[#afafaf] transition-colors hover:text-[#77797e] dark:hover:text-zinc-300"
              >
                <div className="text-[15px] mr-[5px] mb-[3px] leading-none" aria-hidden="true">
                  +
                </div>
                Add
              </button>
              {isBottomAddMenuOpen ? (
                <div className="absolute left-full top-1/2 z-[1000] flex -translate-y-1/2 items-stretch -ml-4">
                  <div className="w-3 shrink-0" aria-hidden="true" />
                  <div
                    role="menu"
                    aria-label="Add list or folder"
                    className="w-[152px] overflow-hidden border border-zinc-200 bg-white py-1 rounded-[20px]! shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                  >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex h-[35px] w-full cursor-pointer items-center gap-2.5 px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setIsBottomAddMenuOpen(false);
                      setIsAddListOpen(true);
                    }}
                  >
                    <LuList className="size-[14px] shrink-0 text-[#acadb7]" aria-hidden="true" />
                    List
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex h-[35px] w-full cursor-pointer items-center gap-2.5 px-3 text-left text-sm ptxt-900 hover:bg-zinc-100 dark:ptxt-50 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setIsBottomAddMenuOpen(false);
                      setIsAddFolderOpen(true);
                    }}
                  >
                    <LuFolder className="size-[14px] shrink-0 text-[#acadb7]" aria-hidden="true" />
                    Folder
                  </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          </div>

          <div
            className="group/labels-section flex flex-col overflow-visible"
            onMouseLeave={() => onSidebarHoverEnd?.()}
          >
            <div className="relative z-[200] flex items-center overflow-visible px-4 pb-1.5">
              <button
                type="button"
                onClick={() => setIsLabelsOpen((open) => !open)}
                aria-expanded={isLabelsOpen}
                className="min-w-0 flex-1 text-left cursor-pointer"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] ptxt-400 dark:ptxt-500">
                  Labels
                </span>
              </button>
              <button
                type="button"
                aria-label="Add label"
                className="group/add-label relative -mr-[3px] flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md ptxt-400 opacity-0 transition-[opacity,colors] hover:bg-zinc-200/60 hover:ptxt-600 focus-visible:opacity-100 group-hover/labels-section:opacity-100 dark:hover:bg-zinc-800/60 dark:hover:ptxt-300"
                onClick={() => setIsAddLabelOpen(true)}
              >
                <LuPlus className="size-3.5 text-[#acadb2]" />
                <span
                  aria-hidden="true"
                  className="task-date-picker-remove-tooltip add-task-date-tooltip pointer-events-none absolute right-0 bottom-[calc(100%+8px)] z-[200] whitespace-nowrap px-3 py-1.5 text-[11px] font-medium opacity-0 transition-opacity group-hover/add-label:opacity-100"
                >
                  Add Label
                </span>
              </button>
              <button
                type="button"
                aria-label={isLabelsOpen ? "Collapse labels" : "Expand labels"}
                aria-expanded={isLabelsOpen}
                className="-mr-[12px] flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md ptxt-400 transition-colors hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60"
                onClick={() => setIsLabelsOpen((open) => !open)}
              >
                <BiChevronDown
                  className={`size-4 text-[#c0c5e0] transition-transform ${
                    isLabelsOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>

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
                  <p className="px-4 pb-1 text-xs ptxt-400 dark:ptxt-500">
                    No labels
                  </p>
                ) : (
                  orderedLabels.map((item) => {
                    const isSelected = selectedLabelId === item.id;
                    const showLabelAccentBorder =
                      isSelected && sidebarHoverPreview === null;

                    return (
                      <div
                        key={item.id}
                        data-label-id={item.id}
                        onPointerDown={(event) =>
                          handleLabelPointerDown(event, item.id)
                        }
                        onClick={() => handleLabelClick(item.id)}
                        className={`group relative ml-[3px] mb-px flex h-[31px] w-[230px] cursor-pointer items-center gap-2 rounded-[3px] pl-3 pr-1 transition-colors ${
                          isSelected
                            ? "sidebar-label-item-selected font-medium dark:bg-zinc-800/60"
                            : "sidebar-label-item"
                        } ${
                          showLabelAccentBorder
                            ? "border-l-[2px] border-l-[#dadfdf]"
                            : "border-l-[2px] border-l-transparent"
                        } ${onReorderLabels ? "touch-none" : ""}`}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openLabelMenu(item.id, {
                            top: event.clientY,
                            left: event.clientX,
                          });
                        }}
                      >
                        <div className="group flex min-w-0 flex-1 items-center gap-1.5">
                          <span className="inline-flex shrink-0 items-center justify-center">
                            <IoMdPricetag
                              className="size-[12.5px] mb-[1px] text-[#d4d4ea]"
                              aria-hidden="true"
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate pr-14 text-[14px] leading-none ptxt-label-items">
                            {item.label}
                          </span>
                        </div>
                        <div className="absolute right-[var(--sidebar-row-trailing-inset)] top-1/2 flex -translate-y-1/2 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-flex size-[6px] shrink-0 items-center justify-center rounded-full mr-[6px]"
                            style={{ backgroundColor: getLabelDotColor(item) }}
                          />
                          <span
                            className={`pointer-events-none inline-flex items-center text-[11px] leading-none tabular-nums transition-opacity ${
                              openMenuLabelId === item.id
                                ? "opacity-0"
                                : "group-hover:opacity-0"
                            }`}
                            style={{ color: getLabelDotColor(item) }}
                          >
                            {taskCountByLabelId[item.id] ?? 0}
                          </span>
                        </div>
                        <div className={SIDEBAR_ROW_MENU_WRAPPER_CLASS}>
                          <button
                            type="button"
                            aria-label={`Open menu for ${item.label}`}
                            aria-expanded={openMenuLabelId === item.id}
                            className={`${getSidebarRowMenuButtonClass(
                              openMenuLabelId === item.id,
                            )} -mr-[7px]`}
                       
                            
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleLabelMenuFromButton(item.id, event.currentTarget);
                            }}
                          >
                            <PiDotsThreeBold className="size-[16px] text-[#a1a1af]" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

        </nav>

        <div
          ref={completedFooterRef}
          className="relative shrink-0 border-t border-zinc-200 dark:border-zinc-800"
        >
          {isCompletedOpen ? (
            <div className="absolute bottom-full left-0 right-0 z-10 border-t border-zinc-200 bg-inherit shadow-[0_-8px_24px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
              {completedTasks.length === 0 ? (
                <p className="px-4 py-3 text-xs ptxt-400 dark:ptxt-500">
                  No completed tasks
                </p>
              ) : (
                <div className="list-panel-scroll max-h-[280px] overflow-x-hidden overflow-y-auto py-1">
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
                      <span className="w-full truncate ptxt-400 line-through dark:ptxt-500">
                        {task.name}
                      </span>
                      <span className="w-full truncate text-xs ptxt-400 dark:ptxt-500">
                        {task.listName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex flex-col items-center">
              <button
                type="button"
                aria-expanded={isCompletedOpen}
                className="group flex items-center gap-1 text-sm ptxt-550 transition-colors hover:ptxt-900 dark:hover:ptxt-50 cursor-pointer"
                onClick={() => {
                  setIsCompletedOpen((open) => !open);
                  setIsArchiveOpen(false);
                }}
              >
                <BiSolidCheckboxChecked
                  className={`size-[15px] shrink-0 ${
                    isCompletedOpen ? "ptxt-950" : "ptxt-400"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-[#9d9da3] group-hover:text-[#747479] text-[14px]">Completed</span>
              </button>
              <button
                type="button"
                className="group -ml-[26px]! flex items-center gap-1 text-sm ptxt-550 transition-colors hover:ptxt-900 dark:hover:ptxt-50 cursor-pointer"
                onClick={(event) => {
                  openArchiveModal({
                    x: event.clientX,
                    y: event.clientY,
                  });
                  closeDrawer();
                }}
              >
                <BsArchiveFill
                  className="size-[11px] shrink-0 text-[#b5b5bb] "
                  aria-hidden="true"
                />
                <span className="text-[#9d9da3] group-hover:text-[#747479] text-[13px]">
                  Archive
                </span>
              </button>
            </div>
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
              className="flex size-8 items-center justify-center rounded-full ptxt-400 transition-colors hover:bg-zinc-200/60 hover:ptxt-900 dark:hover:bg-zinc-800/60 dark:hover:ptxt-50 cursor-pointer"
            >
              <FiSettings className="size-[18px]" aria-hidden="true" />
            </button>
          </div>
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

      <ArchiveModal
        open={isArchiveOpen}
        revealOrigin={archiveRevealOrigin}
        onClose={() => setIsArchiveOpen(false)}
        onTasksRestored={onArchivedTasksRestored}
      />

      {openListMenuItem && listMenuPosition ? (
        <ListContextMenu
          listName={openListMenuItem.name}
          fixedPosition={listMenuPosition}
          menuRef={menuRef}
          folders={orderedFolders}
          currentFolderId={openListMenuItem.folderId ?? null}
          onEdit={() => openEditListModal(openListMenuItem)}
          onRename={() => openRenameModal(openListMenuItem)}
          onRemove={() => openRemoveModal(openListMenuItem)}
          onMoveToFolder={(folderId) => {
            onMoveListToFolder(openListMenuItem.id, folderId);
            if (folderId) {
              setExpandedFolderIds((current) => new Set([...current, folderId]));
            }
            closeListMenu();
          }}
        />
      ) : null}

      {openFolderMenuItem && folderMenuPosition ? (
        <FolderContextMenu
          folderName={openFolderMenuItem.name}
          fixedPosition={folderMenuPosition}
          menuRef={folderMenuRef}
          onRename={() => openRenameFolderModal(openFolderMenuItem)}
          onRemove={() => openRemoveFolderModal(openFolderMenuItem)}
        />
      ) : null}

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
        open={isAddFolderOpen}
        title="New folder"
        initialName=""
        placeholder="Folder name"
        confirmLabel="Add"
        onConfirm={(name) => {
          onAddFolder(name);
          setIsAddFolderOpen(false);
        }}
        onCancel={() => setIsAddFolderOpen(false)}
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

      <EditListModal
        open={editList !== null}
        list={editList}
        folders={orderedFolders}
        onConfirm={(values) => {
          if (editList) {
            onUpdateList(editList.id, values);
            setOrderedLists((current) =>
              current.map((item) =>
                item.id === editList.id
                  ? {
                      ...item,
                      name: values.name,
                      folderId: values.folderId,
                      color: values.color,
                    }
                  : item,
              ),
            );
            if (values.folderId) {
              setExpandedFolderIds((current) =>
                new Set([...current, values.folderId as string]),
              );
            }
          }
          setEditList(null);
        }}
        onCancel={() => setEditList(null)}
      />

      <RenameListModal
        open={renameList !== null}
        initialName={renameList?.name ?? ""}
        onConfirm={(name) => {
          if (renameList) {
            onRenameList(renameList.id, name);
            setOrderedLists((current) =>
              current.map((item) =>
                item.id === renameList.id ? { ...item, name } : item,
              ),
            );
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
        open={renameFolder !== null}
        title="Rename folder"
        initialName={renameFolder?.name ?? ""}
        placeholder="Folder name"
        onConfirm={(name) => {
          if (renameFolder) {
            onRenameFolder(renameFolder.id, name);
            setOrderedFolders((current) =>
              current.map((item) =>
                item.id === renameFolder.id ? { ...item, name } : item,
              ),
            );
          }
          setRenameFolder(null);
        }}
        onCancel={() => setRenameFolder(null)}
      />

      <ConfirmModal
        open={removeFolder !== null}
        title="Delete folder"
        message={`Are you sure you want to delete "${removeFolder?.name}"? Lists in this folder will be moved to the top level.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (removeFolder) {
            onRemoveFolder(removeFolder.id);
          }
          setRemoveFolder(null);
        }}
        onCancel={() => setRemoveFolder(null)}
      />

      <RenameListModal
        open={renameLabel !== null}
        title="Edit label title"
        initialName={renameLabel?.label ?? ""}
        placeholder="Label name"
        onConfirm={(name) => {
          if (renameLabel) {
            onRenameLabel(renameLabel.id, name);
            setOrderedLabels((current) =>
              current.map((item) =>
                item.id === renameLabel.id ? { ...item, label: name } : item,
              ),
            );
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
