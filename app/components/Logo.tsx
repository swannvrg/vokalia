export default function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14 24C14 17.373 19.373 12 26 12H38C46.837 12 54 19.163 54 28C54 36.837 46.837 44 38 44H24L15 52V38.5C14.36 36.1 14 33.5 14 30.8V24Z"
        fill="var(--color-accent)"
      />
      <rect x="24" y="22" width="4" height="16" rx="2" fill="var(--color-bg)" />
      <rect x="32" y="17" width="4" height="26" rx="2" fill="var(--color-bg)" />
      <rect x="40" y="25" width="4" height="10" rx="2" fill="var(--color-bg)" />
    </svg>
  );
}
