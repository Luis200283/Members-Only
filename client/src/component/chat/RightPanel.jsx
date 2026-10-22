import { useEffect, useState } from "react";
import MessageItem from "./MessageItem.jsx";
import MessageComposer from "./MessageComposer.jsx";

const PANEL_TITLES = {
  thread: "Hilo",
  members: "Miembros",
  search: "Búsqueda",
};

const noop = () => {};

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ThreadPanel({
  thread,
  members,
  onSendReply,
  onToggleReaction,
  onDeleteMessage,
  user,
}) {
  const [quoted, setQuoted] = useState(null);

  useEffect(() => {
    setQuoted(null);
  }, [thread?.parent?.id]);

  if (!thread) {
    return (
      <p className="p-4 text-sm text-muted">
        Selecciona “Responder en hilo” en un mensaje para verlo aquí.
      </p>
    );
  }

  const { parent, replies = [], loading } = thread;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {parent && (
          <div className="border-b border-line">
            <MessageItem
              message={parent}
              user={user}
              grouped={false}
              canPin={false}
              isPinned={false}
              onReact={(emoji) => onToggleReaction(parent.id, emoji)}
              onReply={noop}
              onQuote={() => setQuoted(parent)}
              onPin={noop}
              onDelete={() => onDeleteMessage?.(parent)}
              compact
            />
          </div>
        )}
        <p className="px-4 py-2 text-xs text-muted">
          {loading
            ? "Cargando respuestas…"
            : `${replies.length} ${replies.length === 1 ? "respuesta" : "respuestas"}`}
        </p>
        {replies.map((reply, index) => (
          <div key={reply.id} id={`msg-${reply.id}`}>
            <MessageItem
              message={reply}
              user={user}
              grouped={
                index > 0 && replies[index - 1].sender_id === reply.sender_id
              }
              canPin={false}
              isPinned={false}
              onReact={(emoji) => onToggleReaction(reply.id, emoji)}
              onReply={noop}
              onQuote={() => setQuoted(reply)}
              onPin={noop}
              onDelete={() => onDeleteMessage?.(reply)}
              compact
            />
          </div>
        ))}
      </div>
      <div className="border-t border-line p-3">
        <MessageComposer
          onSend={(body, options) => onSendReply(body, options)}
          onTyping={noop}
          quoted={quoted ? { id: quoted.id, username: quoted.username, body: quoted.body } : null}
          onClearQuote={() => setQuoted(null)}
          members={members}
          placeholder="Responder en el hilo…"
          disabled={!parent}
        />
      </div>
    </div>
  );
}

function MembersPanel({ members, presence }) {
  const sorted = [...members].sort((a, b) => {
    const aOnline = presence.has(a.id) ? 0 : 1;
    const bOnline = presence.has(b.id) ? 0 : 1;
    if (aOnline !== bOnline) return aOnline - bOnline;
    return a.username.localeCompare(b.username);
  });

  return (
    <ul className="flex flex-col gap-1 p-2">
      {sorted.map((member) => {
        const online = presence.has(member.id);
        return (
          <li
            key={member.id}
            className="flex items-center gap-3 rounded-card px-2 py-2 hover:bg-raised"
          >
            <span
              aria-label={online ? "En línea" : "Desconectado"}
              className={`size-2.5 shrink-0 rounded-full ${
                online ? "bg-online" : "border border-muted"
              }`}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {member.username}
            </span>
            {member.role && member.role !== "member" && (
              <span className="text-xs text-muted">
                {member.role === "owner" ? "Propietario" : "Admin"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SearchPanel({ searchResults, loadingSearch, onSearch, onSelectResult }) {
  const [query, setQuery] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    if (q.length >= 2) onSearch(q);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form onSubmit={handleSubmit} className="p-3">
        <label className="sr-only" htmlFor="chat-search-input">
          Buscar mensajes
        </label>
        <input
          id="chat-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar en la conversación…"
          className="min-h-10 w-full rounded-card border border-line bg-raised px-3 text-sm text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loadingSearch && <p className="p-2 text-sm text-muted">Buscando…</p>}
        {!loadingSearch && searchResults?.length === 0 && (
          <p className="p-2 text-sm text-muted">Sin resultados.</p>
        )}
        <ul className="flex flex-col gap-1">
          {(searchResults || []).map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => onSelectResult(message)}
                className="flex w-full flex-col gap-1 rounded-card px-2 py-2 text-left hover:bg-raised min-h-10 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate font-medium text-ink">
                    {message.username}
                  </span>
                  <span className="font-mono">{formatTime(message.created_at)}</span>
                </span>
                <span className="line-clamp-2 text-sm text-ink-2">
                  {message.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function RightPanel({
  panel,
  thread,
  members = [],
  presence = new Set(),
  searchResults = [],
  loadingSearch = false,
  onSearch,
  onSelectResult,
  onSendReply,
  onToggleReaction,
  onDeleteMessage,
  onClose,
  user,
}) {
  useEffect(() => {
    if (!panel) return undefined;
    function handleKeyDown(event) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="menu"], [role="listbox"]')) return;
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panel, onClose]);

  if (!panel) return null;

  return (
    <aside
      role="complementary"
      aria-label={PANEL_TITLES[panel]}
      className="flex h-full w-[330px] max-w-full shrink-0 flex-col border-l border-line bg-sidebar text-ink max-[1100px]:absolute max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:z-20 max-[1100px]:shadow-lg max-[768px]:inset-0 max-[768px]:w-full"
    >
      <header className="flex min-h-14 items-center justify-between gap-2 border-b border-line px-4">
        <h2 className="font-display text-lg text-ink">{PANEL_TITLES[panel]}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="flex size-10 items-center justify-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {panel === "thread" && (
          <ThreadPanel
            thread={thread}
            members={members}
            onSendReply={onSendReply}
            onToggleReaction={onToggleReaction}
            onDeleteMessage={onDeleteMessage}
            user={user}
          />
        )}
        {panel === "members" && (
          <div className="h-full overflow-y-auto">
            <MembersPanel members={members} presence={presence} />
          </div>
        )}
        {panel === "search" && (
          <SearchPanel
            searchResults={searchResults}
            loadingSearch={loadingSearch}
            onSearch={onSearch}
            onSelectResult={onSelectResult}
          />
        )}
      </div>
    </aside>
  );
}
