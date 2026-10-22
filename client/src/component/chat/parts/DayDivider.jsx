function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDay(value) {
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, now)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";

  const text = date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function DayDivider({ date }) {
  if (!date) return null;

  return (
    <div role="separator" className="my-4 flex items-center gap-3 text-xs font-medium text-muted">
      <span className="h-px flex-1 bg-line" />
      <span>{formatDay(date)}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
