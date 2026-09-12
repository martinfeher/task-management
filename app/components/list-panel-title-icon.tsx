import { IoMdPricetag } from "react-icons/io";
import { LuInbox, LuList, LuStar } from "react-icons/lu";
import { TodayCalendarIcon } from "./today-calendar-icon";

export type TaskListTitleIconKind =
  | "today"
  | "inbox"
  | "important"
  | "list"
  | "label";

const NAV_SELECTED_ICON_COLOR = "text-[#7474bb]";
const LIST_ICON_COLOR = "text-[#acadb7]";
const LABEL_ICON_COLOR = "text-[#d4d4ea]";

type TaskListTitleIconProps = {
  kind: TaskListTitleIconKind;
  className?: string;
};

export function TaskListTitleIcon({
  kind,
  className,
}: TaskListTitleIconProps) {
  switch (kind) {
    case "today":
      return (
        <TodayCalendarIcon
          className={
            className ?? `size-[19px] shrink-0 ${NAV_SELECTED_ICON_COLOR}`
          }
          strokeWidth={1}
        />
      );
    case "inbox":
      return (
        <LuInbox
          className={
            className ?? `size-[15px] shrink-0 ${NAV_SELECTED_ICON_COLOR}`
          }
          strokeWidth={1}
          aria-hidden="true"
        />
      );
    case "important":
      return (
        <LuStar
          className={
            className ?? `size-[15px] shrink-0 ${NAV_SELECTED_ICON_COLOR}`
          }
          strokeWidth={1}
          aria-hidden="true"
        />
      );
    case "list":
      return (
        <LuList
          className={className ?? `size-[14px] shrink-0 ${LIST_ICON_COLOR}`}
          aria-hidden="true"
        />
      );
    case "label":
      return (
        <IoMdPricetag
          className={className ?? `size-[12.5px] shrink-0 ${LABEL_ICON_COLOR}`}
          aria-hidden="true"
        />
      );
  }
}
