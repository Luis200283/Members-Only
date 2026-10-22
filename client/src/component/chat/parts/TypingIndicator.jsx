function label(names) {
  if (names.length === 1) return `${names[0]} está escribiendo…`;
  if (names.length === 2) return `${names[0]} y ${names[1]} están escribiendo…`;
  return "Varias personas están escribiendo…";
}

export default function TypingIndicator({ names = [] }) {
  if (names.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="mb-2 ml-[52px] mt-2 flex items-center gap-2 text-xs text-muted"
    >
      <span className="inline-flex gap-[3px]" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <i
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            className="block h-1 w-1 animate-pulse rounded-full bg-muted motion-reduce:animate-none motion-reduce:opacity-60"
          />
        ))}
      </span>
      {label(names)}
    </div>
  );
}
