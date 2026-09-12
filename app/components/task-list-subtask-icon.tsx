type TaskListSubtaskIconProps = {
  className?: string;
};

export function TaskListSubtaskIcon({
  className = "size-[16px]",
}: TaskListSubtaskIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`block shrink-0 ${className}`}
    >
      <path
        d="M4 2.25V6.75"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M4 6.75H10.25"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle
        cx="11.5"
        cy="6.75"
        r="1.15"
        stroke="currentColor"
        strokeWidth="1.15"
        fill="none"
      />
      <path
        d="M4 6.75V11.75H10.25"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="11.5"
        cy="11.75"
        r="1.15"
        stroke="currentColor"
        strokeWidth="1.15"
        fill="none"
      />
    </svg>
  );
}
