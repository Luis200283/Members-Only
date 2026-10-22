import { Fragment, useEffect, useRef, useState } from "react";
import DayDivider from "./parts/DayDivider.jsx";
import Icon from "./parts/icons.jsx";
import NotificationMenu from "./parts/NotificationMenu.jsx";
import PinnedBar from "./parts/PinnedBar.jsx";
import TypingIndicator from "./parts/TypingIndicator.jsx";
import MessageComposer from "./MessageComposer.jsx";
import MessageItem from "./MessageItem.jsx";
import LinksTab from "./LinksTab.jsx";

function dayKey(value) {
  return new Date(value).toDateString();
}

export default function ChatWindow({
  conversation,
  user,
  messages = [],
  hasMore,
  loadingMore,
  loading = false,
  error = "",
  onLoadMore,
  onlineCount = 0,
  typingNames = [],
  activePanel,
  onOpenPanel,
  onOpenThread,
  onSend,
  onToggleReaction,
  onPin,
  onDeleteMessage,
  onToggleMute,
  onArchive,
  onDeleteConversation,
  onTyping,
  onBack,
  highlightMessageId,
}) {
  const [tab, setTab] = useState("conversation");
  const [quote, setQuote] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flashId, setFlashId] = useState(null);
  const bottomRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const menuRef = useRef(null);

  const lastMessageId = messages[messages.length - 1]?.id ?? null;

  useEffect(() => {
    if (lastMessageId === null) return;
    if (lastMessageIdRef.current === lastMessageId) return;
    lastMessageIdRef.current = lastMessageId;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId]);

  useEffect(() => {
    if (highlightMessageId) setFlashId(highlightMessageId);
  }, [highlightMessageId]);

  useEffect(() => {
    if (!flashId) return undefined;
    const element = document.getElementById(`msg-${flashId.id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setFlashId(null), 2000);
    return () => clearTimeout(timer);
  }, [flashId, tab]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onPointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setQuote(null);
    setMenuOpen(false);
  }, [conversation.id]);

  const members = conversation.members || [];
  const memberCount = conversation.member_count ?? members.length;
  const canPin =
    Boolean(user.isAdmin) ||
    members.some(
      (member) =>
        member.id === user.id && (member.role === "owner" || member.role === "admin")
    );
  const pinnedId = conversation.pinned_message?.id ?? null;
  const isGroup = conversation.type === "group";

  function jumpTo(messageId) {
    if (messages.some((message) => message.id === messageId)) {
      setTab("conversation");
      setFlashId({ id: messageId, n: Date.now() });
    } else {
      onOpenThread(messageId);
    }
  }

  function participantsOf(message) {
    return (message.reply_user_ids || [])
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .map((member) => ({ id: member.id, name: member.username }));
  }

  function handleSend(body, options) {
    return onSend(body, options);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg font-ui text-ink">
      <header className="flex h-[72px] shrink-0 items-center gap-4 border-b border-line px-3 md:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center rounded-card border border-line px-3 text-sm font-medium text-ink hover:bg-raised md:hidden"
        >
          Volver
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-baseline gap-1 truncate font-display text-[28px] leading-[1.1] text-ink">
            {isGroup && (
              <span className="font-ui text-lg text-muted">
                {conversation.is_public === false ? (
                  <Icon name="lock" className="h-4 w-4" />
                ) : (
                  "#"
                )}
              </span>
            )}
            {conversation.title}
          </h2>
          {conversation.topic && (
            <p className="truncate text-[13px] text-muted">{conversation.topic}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenPanel("members")}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-card px-2 py-1 text-[13px] text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent max-md:hidden"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-online" />
          {memberCount} miembros · {onlineCount} en línea
        </button>
        <div className="flex flex-none gap-1">
          <button
            type="button"
            onClick={() => onOpenPanel("search")}
            aria-label="Buscar en la sala"
            aria-pressed={activePanel === "search"}
            className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink aria-[pressed=true]:bg-bg aria-[pressed=true]:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
          >
            <Icon name="search" />
          </button>
          <NotificationMenu />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Más opciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
            >
              <Icon name="more" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 flex min-w-44 flex-col rounded-card border border-line bg-bg p-1 shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenPanel("members");
                  }}
                  className="flex h-9 items-center rounded-card px-3 text-left text-[13px] hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Ver miembros
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleMute();
                  }}
                  className="flex h-9 items-center gap-2 rounded-card px-3 text-left text-[13px] hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Icon
                    name={conversation.muted ? "bell" : "bellOff"}
                    className="h-4 w-4"
                  />
                  {conversation.muted
                    ? "Activar esta conversación"
                    : "Silenciar esta conversación"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onArchive();
                  }}
                  className="flex h-9 items-center gap-2 rounded-card px-3 text-left text-[13px] hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Icon name="archive" className="h-4 w-4" />
                  {conversation.archived ? "Desarchivar chat" : "Archivar chat"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteConversation();
                  }}
                  className="flex h-9 items-center gap-2 rounded-card px-3 text-left text-[13px] text-danger hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Icon name="trash" className="h-4 w-4" />
                  Eliminar chat
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div role="tablist" className="flex h-10 shrink-0 items-stretch gap-4 border-b border-line px-3 md:px-6">
        {[
          { id: "conversation", label: "Conversación" },
          { id: "links", label: "Enlaces" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`relative flex items-center text-[13px] font-medium text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent aria-selected:font-semibold aria-selected:text-ink aria-selected:after:absolute aria-selected:after:inset-x-0 aria-selected:after:-bottom-px aria-selected:after:h-0.5 aria-selected:after:rounded-t-sm aria-selected:after:bg-accent`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "conversation" && (
        <PinnedBar pinned={conversation.pinned_message} onView={(pinned) => jumpTo(pinned.id)} />
      )}

      {tab === "links" ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LinksTab conversationId={conversation.id} onOpenMessage={jumpTo} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 pb-2 md:px-6">
          {error && (
            <p role="alert" className="mb-3 text-center text-sm text-danger">
              {error}
            </p>
          )}
          {loading && messages.length === 0 ? (
            <p role="status" className="p-6 text-center text-sm text-muted">
              Cargando mensajes…
            </p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-muted">
              <p className="text-ink-2">Todavía no hay mensajes.</p>
              <p className="text-sm">Escribe el primero para empezar.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {hasMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="mx-auto mb-4 h-10 rounded-card border border-line bg-bg px-3 text-sm font-medium text-ink hover:bg-raised disabled:opacity-60"
                >
                  {loadingMore ? "Cargando..." : "Cargar mensajes anteriores"}
                </button>
              )}
              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const newDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
                const grouped = !newDay && previous.sender_id === message.sender_id;
                return (
                  <Fragment key={message.id}>
                    {newDay && <DayDivider date={message.created_at} />}
                    <div
                      id={`msg-${message.id}`}
                      className={`rounded-card transition-shadow ${
                        flashId?.id === message.id ? "ring-2 ring-accent" : ""
                      }`}
                    >
                      <MessageItem
                        message={message}
                        user={user}
                        grouped={grouped}
                        canPin={canPin}
                        isPinned={pinnedId === message.id}
                        participants={participantsOf(message)}
                        onReact={(emoji) => onToggleReaction(message.id, emoji)}
                        onReply={() => onOpenThread(message.id)}
                        onQuote={() =>
                          setQuote({ id: message.id, username: message.username, body: message.body })
                        }
                        onPin={() => onPin(pinnedId === message.id ? null : message.id)}
                        onDelete={() => onDeleteMessage?.(message)}
                      />
                    </div>
                  </Fragment>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
          <TypingIndicator names={typingNames} />
        </div>
      )}

      {tab === "conversation" && (
        <MessageComposer
          onSend={handleSend}
          onTyping={onTyping}
          quoted={quote}
          onClearQuote={() => setQuote(null)}
          members={members}
          placeholder={`Escribe en ${isGroup ? "#" : ""}${conversation.title}…`}
        />
      )}
    </div>
  );
}
