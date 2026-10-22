export function LogoMark({ className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.1 6.6a8 8 0 1 0 0 10.8" />
      <circle cx="11.4" cy="12" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Logo({ markClassName = "h-6 w-6" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={`${markClassName} text-accent`} />
      <span className="font-display text-xl leading-none text-ink">Círculo</span>
    </span>
  );
}
