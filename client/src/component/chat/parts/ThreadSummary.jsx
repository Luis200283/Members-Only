import Avatar from "./Avatar.jsx";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ThreadSummary({
  count,
  lastReplyAt,
  participants = [],
  pressed = false,
  onOpen,
}) {
  if (!count) return null;
  const label = count === 1 ? "respuesta" : "respuestas";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={pressed}
      aria-label={`Abrir hilo: ${count} ${label}`}
      className="mt-2 -ml-1 inline-flex min-h-10 items-center md:min-h-7 gap-2 rounded-card pl-1 pr-2 text-[13px] font-semibold text-accent hover:bg-accent-soft aria-[pressed=true]:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span className="flex">
        {participants.slice(0, 3).map((person, index) => (
          <span
            key={person.id ?? index}
            className={`rounded-card ring-2 ring-bg ${index > 0 ? "-ml-1" : ""}`}
          >
            <Avatar name={person.name} size="sm" />
          </span>
        ))}
      </span>
      <span>
        {count} {label}
        {lastReplyAt && (
          <small className="ml-2 text-xs font-normal text-muted">
            Última {formatTime(lastReplyAt)}
          </small>
        )}
      </span>
    </button>
  );
}
