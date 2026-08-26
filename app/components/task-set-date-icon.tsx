  type TaskSetDateIconProps = {
    className?: string;
  };

  export function TaskSetDateIcon({ className = "size-4" }: TaskSetDateIconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={`block shrink-0 ${className}`}
      >
        <circle
          cx="12"
          cy="12"
          r="10.25"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeDasharray="2.1 2.1"
          strokeLinecap="round"
        />
        <rect
          x="7.25"
          y="9.25"
          width="9.5"
          height="7.75"
          rx="1.35"
          stroke="currentColor"
          strokeWidth="0.75"
        />
        <path
          d="M7.25 11.75h9.5"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
        <path
          d="M9.5 9.25V7.35M14.5 9.25V7.35"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
      </svg>
    );
  }
