import { useEffect, useState } from "react";
import Icon from "./icons.jsx";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👏", "🍷", "🙏", "👀"];

export default function Reactions({
  reactions = [],
  onToggle,
  onAdd,
  currentUserId,
  emojis = REACTION_EMOJIS,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || onAdd) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onAdd]);

  function pick(emoji) {
    setOpen(false);
    onToggle?.(emoji);
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => {
        const reacted = reaction.user_ids
          ? reaction.user_ids.includes(currentUserId)
          : Boolean(reaction.reacted);
        return (
          <button
            key={reaction.emoji}
            type="button"
            onClick={() => onToggle?.(reaction.emoji)}
            aria-pressed={reacted}
            aria-label={`${reaction.emoji} ${reaction.count}`}
            className={`inline-flex min-h-10 items-center gap-1 rounded-card border bg-bg px-2 text-xs md:h-6 md:min-h-0 tabular-nums hover:border-muted focus-visible:outline-2 focus-visible:outline-accent ${
              reacted ? "border-accent" : "border-line"
            }`}
          >
            <span aria-hidden="true">{reaction.emoji}</span>
            <span>{reaction.count}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => (onAdd ? onAdd() : setOpen((value) => !value))}
          aria-expanded={onAdd ? undefined : open}
          aria-label="Añadir reacción"
          className="inline-flex h-6 w-7 items-center justify-center rounded-card border border-line bg-bg text-muted hover:border-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
        </button>
        {open && !onAdd && (
          <div
            role="group"
            aria-label="Emojis disponibles"
            className="absolute bottom-full left-0 z-10 mb-1 flex flex-wrap gap-1 rounded-card border border-line bg-bg p-1 shadow-sm"
          >
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => pick(emoji)}
                aria-label={`Reaccionar con ${emoji}`}
                className="flex h-10 w-10 items-center justify-center rounded-card text-base hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
