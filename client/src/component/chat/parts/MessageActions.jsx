import Icon from "./icons.jsx";

const BUTTON =
  "grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8";

export default function MessageActions({
  onReact,
  onReply,
  onQuote,
  onPin,
  onDelete,
  canPin = false,
  canDelete = false,
  isPinned = false,
  showReply = true,
}) {
  return (
    <div
      role="toolbar"
      aria-label="Acciones del mensaje"
      className="absolute -top-3 right-2 flex gap-0.5 rounded-card border border-line bg-bg p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100"
    >
      <button type="button" className={BUTTON} onClick={onReact} aria-label="Reaccionar" title="Reaccionar">
        <Icon name="smile" />
      </button>
      {showReply && (
        <button type="button" className={BUTTON} onClick={onReply} aria-label="Responder en hilo" title="Responder en hilo">
          <Icon name="reply" />
        </button>
      )}
      <button type="button" className={BUTTON} onClick={onQuote} aria-label="Citar" title="Citar">
        <Icon name="quote" />
      </button>
      {canPin && (
        <button
          type="button"
          className={BUTTON}
          onClick={onPin}
          aria-label={isPinned ? "Quitar fijado" : "Fijar"}
          aria-pressed={isPinned}
          title={isPinned ? "Quitar fijado" : "Fijar"}
        >
          <Icon name="pin" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          className={`${BUTTON} hover:text-danger`}
          onClick={onDelete}
          aria-label="Eliminar mensaje"
          title="Eliminar mensaje"
        >
          <Icon name="trash" />
        </button>
      )}
    </div>
  );
}
