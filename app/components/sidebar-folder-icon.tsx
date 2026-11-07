import type { CSSProperties, SVGProps } from "react";

const FOLDER_ICON_SHADOW_VAR = "--dig-color__foldericon__shadow";
const FOLDER_ICON_CONTAINER_VAR = "--dig-color__foldericon__container";

const DEFAULT_FOLDER_SHADOW = "#75aaff";
// const DEFAULT_FOLDER_SHADOW = "#75aaff"; 
const DEFAULT_FOLDER_CONTAINER = "#B7C0F9"; 
// const DEFAULT_FOLDER_CONTAINER = "#a0c4ff";  

type SidebarFolderIconProps = SVGProps<SVGSVGElement> & {
  shadowColor?: string;
  containerColor?: string;
};

export function SidebarFolderIcon({
  className,
  shadowColor,
  containerColor,
  style,
  ...props
}: SidebarFolderIconProps) {
  const mergedStyle = {
    [FOLDER_ICON_SHADOW_VAR]: shadowColor ?? DEFAULT_FOLDER_SHADOW,
    [FOLDER_ICON_CONTAINER_VAR]: containerColor ?? DEFAULT_FOLDER_CONTAINER,
    ...style,
  } as CSSProperties;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 30 26"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={mergedStyle}
      {...props}
    >
      <path
        fill={`var(${FOLDER_ICON_SHADOW_VAR}, ${DEFAULT_FOLDER_SHADOW})`}
        d="M9.502.004c.552.018.993.252 1.295.7l.785 2.12c.145.298.363.576.561.779.252.257.633.4 1.156.4H30l-.002 18c-.027.976-.3 1.594-.836 2.142-.565.577-1.383.858-2.41.858H3.248c-1.026 0-1.844-.28-2.409-.858C.274 23.568 0 22.73 0 21.68V.003z"
      />
      <path
        fill={`var(${FOLDER_ICON_CONTAINER_VAR}, ${DEFAULT_FOLDER_CONTAINER})`}
        d="M9.502.001c.552.018.993.252 1.295.7l.785 2.12c.145.298.363.576.561.779.252.257.633.4 1.156.4H30l-.002 16.84c-.027.976-.3 1.754-.836 2.302-.565.577-1.383.858-2.41.858H3.248c-1.026 0-1.844-.28-2.409-.858C.274 22.565 0 21.727 0 20.677V0z"
      />
    </svg>
  );
}
