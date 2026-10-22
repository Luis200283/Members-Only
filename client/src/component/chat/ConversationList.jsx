import { useState } from "react";
import Avatar from "./parts/Avatar.jsx";
import Icon from "./parts/icons.jsx";

function peerOf(conversation, userId) {
  return conversation.members?.find((member) => member.id !== userId) || null;
}

function Unread({ count }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} sin leer`}
      className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-card bg-accent px-1.5 text-xs font-semibold text-accent-ink"
    >
      {count}
    </span>
  );
}

function ListItem({ active, unread, onClick, children }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={`flex min-h-10 w-full items-center gap-2 rounded-card px-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent md:min-h-8 ${
          active
            ? "border border-line bg-bg font-semibold text-ink"
            : `text-ink hover:bg-raised ${unread ? "font-semibold" : ""}`
        }`}
      >
        {children}
      </button>
    </li>
  );
}

export default function ConversationList({
  conversations,
  user,
  activeId,
  presence,
  loading,
  error,
  onSelect,
  onNewDirect,
  onOpenRooms,
}) {
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const term = query.trim().toLocaleLowerCase();

  const matches = (conversation) =>
    !term || (conversation.title || "").toLocaleLowerCase().includes(term);

  const visible = conversations.filter(matches);
  const rooms = visible.filter(
    (conversation) => conversation.type === "group" && !conversation.archived,
  );
  const directs = visible.filter(
    (conversation) => conversation.type === "direct" && !conversation.archived,
  );
  const archived = visible.filter((conversation) => conversation.archived);

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="flex h-18 shrink-0 items-center gap-3 border-b border-line px-4">
        <h2 className="font-display text-xl leading-tight">Chat</h2>
        <button
          type="button"
          onClick={onNewDirect}
          aria-label="Nuevo mensaje directo"
          className="ml-auto grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
        >
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 px-4 pt-4 pb-2">
        <label className="flex min-h-10 items-center gap-2 rounded-card border border-line bg-bg px-2 text-sm text-muted focus-within:border-accent md:min-h-8">
          <Icon name="search" className="h-4 w-4" />
          <span className="sr-only">Buscar salas y mensajes directos</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar"
            className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted outline-none"
          />
        </label>
      </div>

      {error && <p className="px-4 py-2 text-sm text-danger">{error}</p>}

      <nav
        aria-label="Salas y mensajes directos"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
      >
        {loading ? (
          <p className="p-4 text-center text-sm text-muted">Cargando…</p>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between px-2 pt-4 pb-2">
                <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">
                  Salas
                </h3>
                <button
                  type="button"
                  onClick={onOpenRooms}
                  aria-label="Crear o explorar salas"
                  className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-6 md:w-6"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="flex flex-col gap-0.5">
                {rooms.map((room) => {
                  const unread = room.unread_count > 0;
                  return (
                    <ListItem
                      key={room.id}
                      active={room.id === activeId}
                      unread={unread}
                      onClick={() => onSelect(room.id)}
                    >
                      {room.is_public ? (
                        <Icon name="hash" className="h-3.5 w-3.5 text-muted" />
                      ) : (
                        <Icon name="lock" className="h-3.5 w-3.5 text-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{room.title}</span>
                      <Unread count={room.unread_count} />
                    </ListItem>
                  );
                })}
              </ul>
              {rooms.length === 0 && (
                <p className="px-2 py-2 text-xs text-muted">
                  {term ? "Sin salas que coincidan." : "Todavía no tienes salas."}
                </p>
              )}
            </section>

            <section>
              <h3 className="px-2 pt-4 pb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
                Mensajes directos
              </h3>
              <ul className="flex flex-col gap-0.5">
                {directs.map((conversation) => {
                  const peer = peerOf(conversation, user?.id);
                  const name = conversation.title;
                  const unread = conversation.unread_count > 0;
                  const online = peer && presence?.has(peer.id);
                  return (
                    <ListItem
                      key={conversation.id}
                      active={conversation.id === activeId}
                      unread={unread}
                      onClick={() => onSelect(conversation.id)}
                    >
                      <Avatar
                        name={name}
                        size="sm"
                        presence={online ? "online" : "offline"}
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <span className="sr-only">
                        {online ? "En línea" : "Desconectado"}
                      </span>
                      <Unread count={conversation.unread_count} />
                    </ListItem>
                  );
                })}
              </ul>
              {directs.length === 0 && term && (
                <p className="px-2 py-2 text-xs text-muted">Sin mensajes que coincidan.</p>
              )}
            </section>

            {archived.length > 0 && (
              <section className="mt-4 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => setShowArchived((value) => !value)}
                  aria-expanded={showArchived}
                  className="flex min-h-10 w-full items-center gap-2 rounded-card px-2 text-left text-[11px] font-semibold tracking-wider text-muted uppercase hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:min-h-8"
                >
                  <Icon name="archive" className="h-3.5 w-3.5" />
                  <span className="flex-1">Archivados</span>
                  <span className="rounded-card border border-line px-1.5 text-[11px] normal-case">
                    {archived.length}
                  </span>
                  <Icon
                    name="chevron"
                    className={`h-4 w-4 transition-transform ${showArchived ? "rotate-180" : ""}`}
                  />
                </button>
                {showArchived && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {archived.map((conversation) => {
                      const unread = conversation.unread_count > 0;
                      return (
                        <ListItem
                          key={conversation.id}
                          active={conversation.id === activeId}
                          unread={unread}
                          onClick={() => onSelect(conversation.id)}
                        >
                          <Icon
                            name="archive"
                            className="h-3.5 w-3.5 text-muted"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {conversation.title}
                          </span>
                          <Unread count={conversation.unread_count} />
                        </ListItem>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </nav>

      {user && (
        <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
          <Avatar name={user.username} me presence="online" />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold">{user.username}</b>
            <span className="text-xs text-muted">En línea</span>
          </div>
        </div>
      )}
    </div>
  );
}
