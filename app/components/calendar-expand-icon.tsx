type CalendarExpandIconProps = {
  className?: string;
};

export function CalendarExpandIcon({ className }: CalendarExpandIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="3.25"
        y="3.25"
        width="13.5"
        height="13.5"
        rx="2.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M6.75 6.75V9.25H9.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="11.25"
        y="11.25"
        width="3.75"
        height="3.75"
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}
