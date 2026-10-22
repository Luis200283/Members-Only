const SIZES = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
};

const DOT_SIZES = {
  sm: "h-2 w-2 -right-0.5 -bottom-0.5",
  md: "h-2.5 w-2.5 -right-0.5 -bottom-0.5",
};

function initials(name) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default function Avatar({ name, size = "md", me = false, presence = null }) {
  const dotSize = DOT_SIZES[size] ?? DOT_SIZES.md;
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`relative grid flex-none place-items-center rounded-card font-semibold ${
        SIZES[size] ?? SIZES.md
      } ${me ? "bg-ink text-bg" : "bg-line text-ink"}`}
    >
      {initials(name)}
      {presence === "online" && (
        <span
          aria-label="En línea"
          className={`absolute ${dotSize} rounded-full border-2 border-surface bg-online`}
        />
      )}
      {presence === "offline" && (
        <span
          aria-label="Desconectado"
          className={`absolute ${dotSize} rounded-full border-[1.5px] border-muted bg-bg`}
        />
      )}
    </span>
  );
}
