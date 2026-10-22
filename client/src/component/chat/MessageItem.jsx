import { useState } from "react";
import Avatar from "./parts/Avatar.jsx";
import MessageActions from "./parts/MessageActions.jsx";
import MessageBody from "./parts/MessageBody.jsx";
import QuoteBlock from "./parts/QuoteBlock.jsx";
import Reactions, { REACTION_EMOJIS } from "./parts/Reactions.jsx";
import ThreadSummary from "./parts/ThreadSummary.jsx";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageItem({
  message,
  user,
  grouped = false,
  canPin = false,
  isPinned = false,
  onReact,
  onReply,
  onQuote,
  onPin,
  onDelete,
  compact = false,
  participants = [],
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const own = message.sender_id === user.id;
  const canDelete = own || canPin;
  const name = own ? "Tú" : message.username;

  function pick(emoji) {
    setPickerOpen(false);
    onReact?.(emoji);
  }

  return (
    <article
      className={`group relative grid grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-card py-1 hover:bg-surface ${
        compact ? "px-5" : "px-2"
      } ${grouped ? "" : "mt-3"}`}
    >
      {grouped ? (
        <time
          dateTime={message.created_at}
          className="invisible pt-1 text-center font-mono text-[10px] text-muted group-hover:visible"
        >
          {formatTime(message.created_at)}
        </time>
      ) : (
        <Avatar name={message.username} me={own} size="md" />
      )}

      <div className="min-w-0">
        {!grouped && (
          <div className="flex flex-wrap items-baseline gap-2">
            <b className="font-semibold">{name}</b>
            {message.sender_is_admin && (
              <span className="rounded-card border border-line px-1.5 font-mono text-[11px] leading-[18px] text-muted">
                Admin
              </span>
            )}
            <time dateTime={message.created_at} className="font-mono text-xs text-muted">
              {formatTime(message.created_at)}
            </time>
          </div>
        )}

        {message.quoted && (
          <QuoteBlock username={message.quoted.username} body={message.quoted.body} />
        )}

        <MessageBody body={message.body} currentUsername={user.username} />

        {message.reactions?.length > 0 && (
          <Reactions
            reactions={message.reactions}
            currentUserId={user.id}
            onToggle={onReact}
            onAdd={() => setPickerOpen((value) => !value)}
          />
        )}

        {!compact && (
          <ThreadSummary
            count={message.reply_count}
            lastReplyAt={message.last_reply_at}
            participants={participants}
            onOpen={onReply}
          />
        )}

        {pickerOpen && (
          <div
            role="group"
            aria-label="Emojis disponibles"
            className="mt-2 flex flex-wrap gap-1"
          >
            {REACTION_EMOJIS.map((emoji) => (
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

      <MessageActions
        onReact={() => setPickerOpen((value) => !value)}
        onReply={onReply}
        onQuote={onQuote}
        onPin={onPin}
        onDelete={onDelete}
        canPin={canPin}
        canDelete={canDelete}
        isPinned={isPinned}
        showReply={!compact}
      />
    </article>
  );
}
