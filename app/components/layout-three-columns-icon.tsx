type LayoutThreeColumnsIconProps = {
  className?: string;
};

/** Carbon "open-panel--left" (task modal: open in side panel). */
export function LayoutThreeColumnsIcon({ className }: LayoutThreeColumnsIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M28,4H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4ZM4,6h6V26H4ZM28,26H12V6H28Z" />
    </svg>
  );
}