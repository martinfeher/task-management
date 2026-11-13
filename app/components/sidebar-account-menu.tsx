"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  LuBell,
  LuCheck,
  LuChevronsUpDown,
  LuCircleHelp,
  LuCircleUser,
  LuKeyboard,
  LuLogOut,
  LuPlus,
  LuSparkles,
} from "react-icons/lu";
import { FiSettings } from "react-icons/fi";
import { MacCmdIcon } from "./mac-cmd-icon";

const USER_AVATAR_COLOR = "#7c3aed";
const TASK_USAGE_LIMIT = 200;

/** Account popover button/shell spacing scaled to 88% (12% tighter). */
const ACCOUNT_MENU_BTN_X = "px-[8.8px]";
const ACCOUNT_MENU_BTN_Y = "py-[7px]";
const ACCOUNT_MENU_SECTION_X = "px-[7px]";
const ACCOUNT_MENU_SECTION_Y = "py-[7px]";
const ACCOUNT_MENU_ROW_GAP = "gap-[8.8px]";
const ACCOUNT_MENU_HOVER_CLOSE_MS = 160;

type AccountUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ModalPointer = { x: number; y: number };

type SidebarAccountMenuProps = {
  user: AccountUser;
  isOpen: boolean;
  onToggle: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  activeTaskCount: number;
  onOpenSettings: (
    section: "account" | "general",
    pointer: ModalPointer,
  ) => void;
  onOpenKeyboardShortcuts: (pointer: ModalPointer) => void;
  onSignOut: () => void;
  onCloseDrawer: () => void;
  onCloseMenu: () => void;
  /** Open the menu on hover over the account row (default true). */
  openOnHover?: boolean;
};

function getAccountUserFirstName(
  name: string | undefined | null,
  email: string | undefined | null,
) {
  const trimmedName = name?.trim();
  if (trimmedName) {
    return trimmedName.split(/\s+/).filter(Boolean)[0] ?? "";
  }
  const trimmedEmail = email?.trim();
  if (!trimmedEmail) return "";
  return trimmedEmail.split("@")[0]?.split(/[._-]+/).filter(Boolean)[0] ?? "";
}

function getAccountUserInitial(
  name: string | undefined | null,
  email: string | undefined | null,
) {
  const firstName = getAccountUserFirstName(name, email);
  if (!firstName) return "?";
  return firstName.slice(0, 1).toUpperCase();
}

type WorkspaceRow = {
  id: string;
  name: string;
  initial: string;
  color: string;
  taskCount: number;
  isActive: boolean;
};

function UserAvatar({
  user,
  sizeClass,
  roundedClass = "rounded-full",
}: {
  user: AccountUser;
  sizeClass: string;
  roundedClass?: string;
}) {
  const firstName = getAccountUserFirstName(user.name, user.email);
  const initial = getAccountUserInitial(user.name, user.email);

  return (
    <div
      className={`flex shrink-0 items-center justify-center font-semibold text-white ${sizeClass} ${roundedClass}`}
      style={{ backgroundColor: USER_AVATAR_COLOR }}
      aria-hidden={!firstName}
      title={firstName || undefined}
    >
      {initial}
    </div>
  );
}

function AccountMenuRow({
  icon,
  label,
  trailing,
  onClick,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center ${ACCOUNT_MENU_ROW_GAP} rounded-lg ${ACCOUNT_MENU_BTN_X} ${ACCOUNT_MENU_BTN_Y} text-left text-[13px] text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800/80 ${className}`}
      onClick={onClick}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center text-zinc-500 dark:text-zinc-400">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {trailing ? (
        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

export function SidebarAccountMenu({
  user,
  isOpen,
  onToggle,
  menuRef,
  activeTaskCount,
  onOpenSettings,
  onOpenKeyboardShortcuts,
  onSignOut,
  onCloseDrawer,
  onCloseMenu,
  openOnHover = true,
}: SidebarAccountMenuProps) {
  const hoverCloseTimerRef = useRef<number | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (hoverCloseTimerRef.current !== null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      onCloseMenu();
    }, ACCOUNT_MENU_HOVER_CLOSE_MS);
  }, [cancelHoverClose, onCloseMenu]);

  useEffect(() => {
    return () => cancelHoverClose();
  }, [cancelHoverClose]);

  const handleAccountAreaPointerEnter = useCallback(() => {
    if (!openOnHover) return;
    cancelHoverClose();
    if (!isOpen) {
      onToggle();
    }
  }, [cancelHoverClose, isOpen, onToggle, openOnHover]);

  const handleAccountAreaPointerLeave = useCallback(() => {
    if (!openOnHover) return;
    scheduleHoverClose();
  }, [openOnHover, scheduleHoverClose]);

  const displayName = user.name?.trim() || "Account";
  const usagePercent = Math.min(
    100,
    Math.round((activeTaskCount / TASK_USAGE_LIMIT) * 100),
  );

  const workspaces: WorkspaceRow[] = [
    {
      id: "personal",
      name: "Personal",
      initial: getAccountUserInitial(user.name, user.email),
      color: USER_AVATAR_COLOR,
      taskCount: activeTaskCount,
      isActive: true,
    },
    {
      id: "work",
      name: "Práca",
      initial: "P",
      color: "#22c55e",
      taskCount: 38,
      isActive: false,
    },
  ];

  function runMenuAction(action: () => void) {
    action();
    onCloseMenu();
    onCloseDrawer();
  }

  return (
    <div
      ref={menuRef}
      className="relative"
      onMouseEnter={handleAccountAreaPointerEnter}
      onMouseLeave={handleAccountAreaPointerLeave}
    >
      {isOpen ? (
        <div className="absolute bottom-full left-0 right-0 z-20 pb-2">
          <div
            className="overflow-hidden rounded-[20px] border border-[#e3e3e3] bg-white text-left shadow-[0_10px_40px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
            role="menu"
            aria-label="Account menu"
          >
          <div className="flex items-start gap-[10.5px] border-b border-zinc-100 px-[12.3px] py-[10.5px] dark:border-zinc-800">
            <div className="relative shrink-0">
              <UserAvatar user={user} sizeClass="size-8" />
              <span
                className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
                aria-hidden="true"
              />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-zinc-50">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                {user.email}
              </p>
            </div>
            <span className="mt-0.5 shrink-0 rounded-md bg-[#ffedd5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c2410c]">
              Free
            </span>
          </div>

          <div
            className={`border-b border-zinc-100 ${ACCOUNT_MENU_SECTION_X} ${ACCOUNT_MENU_SECTION_Y} dark:border-zinc-800`}
          >
            <p className="px-[7px] pb-[5.3px] text-[10px] font-semibold tracking-[0.08em] text-zinc-400">
              Workspaces
            </p>
            <div className="flex flex-col gap-[1.8px]">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  className={`flex w-full items-center ${ACCOUNT_MENU_ROW_GAP} rounded-lg ${ACCOUNT_MENU_SECTION_X} ${ACCOUNT_MENU_BTN_Y} text-left transition-colors ${
                    workspace.isActive
                      ? "bg-zinc-50 dark:bg-zinc-800/50"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
                    style={{ backgroundColor: workspace.color }}
                  >
                    {workspace.initial}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                      {workspace.name}
                    </span>
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                      {workspace.taskCount} tasks
                    </span>
                  </span>
                  {workspace.isActive ? (
                    <LuCheck
                      className="size-4 shrink-0 text-[#3b82f6]"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                className={`flex w-full items-center ${ACCOUNT_MENU_ROW_GAP} rounded-lg ${ACCOUNT_MENU_SECTION_X} ${ACCOUNT_MENU_BTN_Y} text-left text-[13px] text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/40`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600">
                  <LuPlus className="size-4" aria-hidden="true" />
                </span>
                <span>New workspace</span>
              </button>
            </div>
          </div>

          <div
            className={`flex flex-col gap-[1.8px] ${ACCOUNT_MENU_SECTION_X} ${ACCOUNT_MENU_SECTION_Y}`}
          >
            <AccountMenuRow
              icon={<LuCircleUser className="size-[17px]" aria-hidden="true" />}
              label="Profile"
              onClick={(event) => {
                runMenuAction(() =>
                  onOpenSettings("account", {
                    x: event.clientX,
                    y: event.clientY,
                  }),
                );
              }}
            />
            <AccountMenuRow
              icon={<FiSettings className="size-[16px]" aria-hidden="true" />}
              label="Settings"
              trailing={
                <span className="inline-flex items-center gap-0.5">
                  <MacCmdIcon className="size-3.5" />,
                </span>
              }
              onClick={(event) => {
                runMenuAction(() =>
                  onOpenSettings("general", {
                    x: event.clientX,
                    y: event.clientY,
                  }),
                );
              }}
            />
            <AccountMenuRow
              icon={<LuBell className="size-[17px]" aria-hidden="true" />}
              label="Notifications"
              trailing={
                <span className="flex size-[18px] items-center justify-center rounded-full bg-[#3b82f6] text-[10px] font-semibold leading-none text-white">
                  3
                </span>
              }
              onClick={() => {
                onCloseMenu();
              }}
            />
            <AccountMenuRow
              icon={<LuKeyboard className="size-[17px]" aria-hidden="true" />}
              label="Keyboard shortcuts"
              trailing="?"
              onClick={(event) => {
                runMenuAction(() =>
                  onOpenKeyboardShortcuts({
                    x: event.clientX,
                    y: event.clientY,
                  }),
                );
              }}
            />
            <AccountMenuRow
              icon={<LuCircleHelp className="size-[17px]" aria-hidden="true" />}
              label="Help & feedback"
              onClick={() => {
                window.location.href = "mailto:?subject=Todolist%20feedback";
                onCloseMenu();
              }}
            />
          </div>

          {/* <div className="mx-[7px] mb-[7px] rounded-xl bg-[#eef4ff] px-[10.5px] py-[10.5px] dark:bg-blue-950/40">
            <div className="mb-[7px] flex items-center justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
              <span>
                {activeTaskCount} / {TASK_USAGE_LIMIT} tasks used
              </span>
              <span>{usagePercent}%</span>
            </div>
            <div className="mb-[10.5px] h-1.5 overflow-hidden rounded-full bg-[#dbeafe] dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-[#3b82f6] transition-[width]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <button
              type="button"
              className={`flex w-[130px] ml-[20px] items-center justify-center gap-[7px] rounded-xl bg-[#839fcd] px-[10.5px] py-[8px] text-[11.5px] font-semibold text-white transition-colors hover:bg-[#2563eb]`}
              onClick={(event) => {
                runMenuAction(() =>
                  onOpenSettings("account", {
                    x: event.clientX,
                    y: event.clientY,
                  }),
                );
              }}
            >
              <LuSparkles className="size-4" aria-hidden="true" />
              Upgrade to Pro
            </button>
          </div> */}

          <div
            className={`border-t border-zinc-100 ${ACCOUNT_MENU_SECTION_X} ${ACCOUNT_MENU_SECTION_Y} dark:border-zinc-800`}
          >
            <button
              type="button"
              role="menuitem"
              className={`flex w-full items-center ${ACCOUNT_MENU_ROW_GAP} rounded-lg ${ACCOUNT_MENU_BTN_X} ${ACCOUNT_MENU_BTN_Y} text-left text-[13px] font-medium text-[#ef4444] transition-colors hover:bg-red-50 dark:hover:bg-red-950/30`}
              onClick={() => {
                runMenuAction(() => {
                  void onSignOut();
                });
              }}
            >
              <LuLogOut className="size-[17px] shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] bg-[#dceff2] p-[0.5px] dark:bg-cyan-950/35 shadow-[0_7px_17px_rgba(0,0,0,0.06)] cursor-pointer">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] border border-[#e8eaed] bg-white px-2.5 py-[7px] text-left shadow-[0_1px_4px_rgba(15,23,42,0.06)] transition-colors hover:bg-zinc-50/90 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_1px_4px_rgba(0,0,0,0.35)] dark:hover:bg-zinc-800/90"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div className="relative shrink-0">
            <UserAvatar user={user} sizeClass="size-7 text-[14px]" />
            <span
              className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-900"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold leading-snug text-zinc-750 dark:text-zinc-50">
              {displayName}
            </p>
            <p className="truncate text-[10.5px] font-normal leading-snug text-zinc-500 dark:text-zinc-400">
              Personal workspace
            </p>
          </div>
          <LuChevronsUpDown
            className="size-[17px] shrink-0 text-[#b8bfc4] dark:text-zinc-500"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
