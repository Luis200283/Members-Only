import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConversationList from "./ConversationList.jsx";
import ChatWindow from "./ChatWindow.jsx";
import NewConversationModal from "./NewConversationModal.jsx";
import RoomModal from "./RoomModal.jsx";
import RightPanel from "./RightPanel.jsx";
import useChatStream from "../../hooks/useChatStream.js";
import { useNotifications } from "../../notifications/NotificationsContext.jsx";
import { useConfirm } from "../ui/ConfirmProvider.jsx";
import {
  archiveConversation,
  deleteConversation,
  deleteMessage,
  fetchConversation,
  fetchConversations,
  fetchMessages,
  fetchPresence,
  fetchReplies,
  markConversationRead,
  pinMessage,
  searchMessages,
  sendChatMessage,
  sendTyping,
  setMuted,
  toggleReaction,
} from "../../api/chat.js";

const TYPING_TTL = 4000;
const TYPING_THROTTLE = 3000;

function sortByActivity(conversations) {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(
      a.last_message?.created_at || a.updated_at || a.created_at,
    ).getTime();
    const bTime = new Date(
      b.last_message?.created_at || b.updated_at || b.created_at,
    ).getTime();
    return bTime - aTime;
  });
}

export default function ChatPage({ user }) {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const parsedId = Number(conversationId);
  const activeId =
    Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showRooms, setShowRooms] = useState(false);
  const [presence, setPresence] = useState(() => new Set());
  const [typing, setTyping] = useState(() => new Map());
  const [activePanel, setActivePanel] = useState(null);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [thread, setThread] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const { notify } = useNotifications();
  const confirm = useConfirm();

  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const missingIdRef = useRef(null);
  const justDeletedRef = useRef(null);
  const threadRequestRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setListLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(sortByActivity(data));
      setListError("");
    } catch (err) {
      if (!silent) setListError(err.message);
    } finally {
      if (!silent) setListLoading(false);
    }
  }, []);

  const loadPresence = useCallback(async () => {
    try {
      const data = await fetchPresence();
      setPresence(new Set(data.online || []));
    } catch {
      setPresence(new Set());
    }
  }, []);

  const markRead = useCallback(async (conversationIdToRead, messageId) => {
    if (!conversationIdToRead || !messageId) return;
    try {
      await markConversationRead(conversationIdToRead, messageId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationIdToRead
            ? {
                ...conversation,
                last_read_message_id: Math.max(
                  conversation.last_read_message_id || 0,
                  messageId,
                ),
                unread_count: 0,
              }
            : conversation,
        ),
      );
    } catch {
      setMessagesError("No se pudo marcar la conversación como leída");
    }
  }, []);

  function upsertConversation(conversation) {
    setConversations((prev) =>
      sortByActivity([
        conversation,
        ...prev.filter((item) => item.id !== conversation.id),
      ]),
    );
  }

  function applyMessageToList(message) {
    setConversations((prev) =>
      sortByActivity(
        prev.map((conversation) => {
          if (conversation.id !== message.conversation_id) return conversation;
          if (
            conversation.last_message &&
            message.id <= conversation.last_message.id
          )
            return conversation;
          const isActive = conversation.id === activeIdRef.current;
          const isOwn = message.sender_id === user.id;
          return {
            ...conversation,
            updated_at: message.created_at,
            last_message: {
              id: message.id,
              body: message.body,
              created_at: message.created_at,
              sender_id: message.sender_id,
              username: message.username,
            },
            unread_count: isOwn
              ? 0
              : isActive
                ? conversation.unread_count || 0
                : (conversation.unread_count || 0) + 1,
            last_read_message_id: isOwn
              ? Math.max(
                  conversation.last_read_message_id || 0,
                  message.id,
                )
              : conversation.last_read_message_id,
          };
        }),
      ),
    );
  }

  function applyIncomingMessage(conversationIdReceived, message) {
    applyMessageToList(message);
    if (conversationIdReceived !== activeIdRef.current) return;
    setMessages((prev) =>
      prev.some((item) => item.id === message.id)
        ? prev
        : [...prev, message],
    );
  }

  function appendReply(message) {
    setThread((prev) => {
      if (!prev || prev.parent?.id !== message.parent_id) return prev;
      if (prev.replies.some((item) => item.id === message.id)) return prev;
      return { ...prev, replies: [...prev.replies, message] };
    });
  }

  function patchMessage(messageId, patch) {
    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? patch(message) : message)),
    );
    setThread((prev) =>
      prev && {
        ...prev,
        parent: prev.parent?.id === messageId ? patch(prev.parent) : prev.parent,
        replies: prev.replies.map((reply) =>
          reply.id === messageId ? patch(reply) : reply,
        ),
      },
    );
  }

  function normalizeReactions(list) {
    return (list || []).map((reaction) => ({
      emoji: reaction.emoji,
      count: reaction.count,
      reacted: (reaction.user_ids || []).includes(user.id),
      user_ids: reaction.user_ids,
    }));
  }

  function maybeNotify(conversationIdReceived, message) {
    if (!message || message.sender_id === user.id) return;
    const conversation = conversationsRef.current.find(
      (item) => item.id === conversationIdReceived,
    );
    if (conversation?.muted) return;
    const focused =
      document.visibilityState === "visible" && document.hasFocus();
    if (conversationIdReceived === activeIdRef.current && focused) return;
    const who = message.username || conversation?.title || "Alguien";
    const text = message.parent_id
      ? `${who} respondió en un hilo: ${message.body}`
      : `${who}: ${message.body}`;
    notify({
      title: conversation?.title || who,
      body: text.length > 180 ? `${text.slice(0, 177)}…` : text,
      tag: `circulo-chat-${conversationIdReceived}`,
      onClick: () => navigate(`/chat/${conversationIdReceived}`),
    });
  }

  const totalUnread = conversations.reduce(
    (sum, conversation) => sum + (conversation.unread_count || 0),
    0,
  );

  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Círculo` : "Círculo";
  }, [totalUnread]);

  useEffect(
    () => () => {
      document.title = "Círculo";
    },
    [],
  );

  const { streamError } = useChatStream({
    onOpen: () => {
      loadConversations({ silent: true });
      loadPresence();
      const reconnectedId = activeIdRef.current;
      if (!reconnectedId) return;
      fetchMessages(reconnectedId)
        .then((data) => {
          if (activeIdRef.current !== reconnectedId) return;
          const fresh = data.messages || [];
          setMessages((prev) => {
            const freshIds = new Set(fresh.map((message) => message.id));
            const kept = prev.filter((message) => !freshIds.has(message.id));
            return [...kept, ...fresh].sort((a, b) => a.id - b.id);
          });
        })
        .catch(() => {});
    },
    onConversation: () => loadConversations({ silent: true }),
    onConversationUpdated: () => loadConversations({ silent: true }),
    onMessage: ({ conversationId: id, message }) => {
      if (!id || !message) return;
      if (message.parent_id) {
        if (id === activeIdRef.current) appendReply(message);
      } else {
        applyIncomingMessage(id, message);
      }
      maybeNotify(id, message);
    },
    onMessageDeleted: ({ messageId, parentId }) => {
      if (!messageId) return;
      removeDeletedMessage(messageId, parentId ?? null);
    },
    onThread: ({ parentId, reply_count, last_reply_at, reply_user_ids }) => {
      patchMessage(parentId, (message) => ({
        ...message,
        reply_count,
        last_reply_at,
        reply_user_ids,
      }));
    },
    onReaction: ({ messageId, reactions }) => {
      const next = normalizeReactions(reactions);
      patchMessage(messageId, (message) => ({ ...message, reactions: next }));
    },
    onTyping: ({ conversationId: id, userId, username }) => {
      if (!id || userId === user.id) return;
      setTyping((prev) => {
        const next = new Map(prev);
        const users = new Map(next.get(id) || []);
        users.set(userId, { username, at: Date.now() });
        next.set(id, users);
        return next;
      });
    },
    onPresence: ({ userId, online }) => {
      setPresence((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    },
    onRead: ({ conversationId: id, lastReadMessageId }) => {
      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== id) return conversation;
          const lastRead = Math.max(
            conversation.last_read_message_id || 0,
            lastReadMessageId,
          );
          const reachedEnd =
            conversation.last_message && lastRead >= conversation.last_message.id;
          return {
            ...conversation,
            last_read_message_id: lastRead,
            unread_count: reachedEnd ? 0 : conversation.unread_count,
          };
        }),
      );
    },
  });

  useEffect(() => {
    loadConversations();
    loadPresence();
  }, [loadConversations, loadPresence]);

  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - TYPING_TTL;
      setTyping((prev) => {
        let changed = false;
        const next = new Map();
        for (const [conversationKey, users] of prev) {
          const kept = new Map();
          for (const [userKey, info] of users) {
            if (info.at > cutoff) kept.set(userKey, info);
            else changed = true;
          }
          if (kept.size) next.set(conversationKey, kept);
        }
        return changed ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setActivePanel(null);
    setActiveThreadId(null);
    setThread(null);
    setSearchResults([]);
    setHighlightMessageId(null);
    threadRequestRef.current = null;
  }, [activeId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setNextCursor(null);
      setMessagesError("");
      setMessagesLoading(false);
      return undefined;
    }

    let cancelled = false;
    setMessages([]);
    setNextCursor(null);
    setMessagesError("");
    setMessagesLoading(true);

    fetchMessages(activeId)
      .then((data) => {
        if (cancelled) return;
        setMessages(data.messages || []);
        setNextCursor(data.nextCursor ?? null);
      })
      .catch((err) => {
        if (!cancelled) setMessagesError(err.message);
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  useEffect(() => {
    if (listLoading || activeId) return;
    const general = conversations.find(
      (conversation) =>
        conversation.type === "group" &&
        conversation.is_public &&
        conversation.title?.toLowerCase() === "general",
    );
    if (general) navigate(`/chat/${general.id}`, { replace: true });
  }, [activeId, conversations, listLoading, navigate]);

  const activeInList = conversations.some(
    (conversation) => conversation.id === activeId,
  );

  useEffect(() => {
    if (!activeId || listLoading || activeInList) return;
    if (missingIdRef.current === activeId) return;
    if (justDeletedRef.current === activeId) return;
    const requestedId = activeId;
    missingIdRef.current = requestedId;
    fetchConversation(requestedId)
      .then((conversation) => {
        upsertConversation(conversation);
      })
      .catch(() => {
        if (missingIdRef.current === requestedId) missingIdRef.current = null;
      });
  }, [activeId, activeInList, listLoading]);

  useEffect(() => {
    if (justDeletedRef.current !== null && activeId !== justDeletedRef.current) {
      justDeletedRef.current = null;
    }
  }, [activeId]);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeId,
  );

  useEffect(() => {
    if (!activeConversation?.last_message) return;
    if (
      activeConversation.last_message.id >
      (activeConversation.last_read_message_id || 0)
    ) {
      markRead(activeConversation.id, activeConversation.last_message.id);
    }
  }, [activeConversation, markRead]);

  const activeTyping = activeId ? typing.get(activeId) : null;
  const typingNames = activeTyping
    ? [...activeTyping.values()].map((info) => info.username)
    : [];
  const members = activeConversation?.members || [];
  const onlineCount = members.filter((member) => presence.has(member.id)).length;

  async function handleSend(body, { quotedId } = {}) {
    const conversationIdToSend = activeIdRef.current;
    if (!conversationIdToSend) throw new Error("Selecciona una conversación");
    const message = await sendChatMessage(conversationIdToSend, body, {
      quotedId,
    });
    if (activeIdRef.current === conversationIdToSend) {
      setMessages((prev) =>
        prev.some((item) => item.id === message.id)
          ? prev
          : [...prev, message],
      );
    }
    applyMessageToList(message);
    return message;
  }

  async function handleSendReply(body, { quotedId } = {}) {
    if (!activeId || !activeThreadId) throw new Error("Selecciona un hilo");
    const conversationIdToSend = activeId;
    const message = await sendChatMessage(conversationIdToSend, body, {
      parentId: activeThreadId,
      quotedId,
    });
    if (activeIdRef.current === conversationIdToSend) appendReply(message);
    return message;
  }

  async function handleToggleReaction(messageId, emoji) {
    try {
      const data = await toggleReaction(messageId, emoji);
      const next = data.reactions || [];
      patchMessage(messageId, (message) => ({ ...message, reactions: next }));
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  async function handlePin(messageId) {
    if (!activeId) return;
    try {
      const updated = await pinMessage(activeId, messageId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  async function handleToggleMute() {
    if (!activeConversation) return;
    try {
      const data = await setMuted(activeId, !activeConversation.muted);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeId
            ? { ...conversation, muted: data.muted }
            : conversation,
        ),
      );
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  async function handleArchive() {
    if (!activeConversation) return;
    try {
      const data = await archiveConversation(
        activeId,
        !activeConversation.archived,
      );
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === activeId
            ? { ...conversation, archived: data.archived }
            : conversation,
        ),
      );
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  async function handleDeleteConversation() {
    if (!activeConversation) return;
    const isGroup = activeConversation.type === "group";
    const name = activeConversation.title;
    const confirmed = await confirm({
      title: isGroup ? "Eliminar la sala" : "Eliminar el chat",
      message: isGroup
        ? `Saldrás de #${name} y dejarás de recibir sus mensajes. La sala seguirá existiendo para los demás.`
        : `La conversación con ${name} desaparecerá de tu lista. Si esa persona te vuelve a escribir, aparecerá de nuevo.`,
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      justDeletedRef.current = activeId;
      await deleteConversation(activeId);
      const fresh = await fetchConversations().catch(() => null);
      const remaining = fresh
        ? sortByActivity(fresh)
        : conversations.filter((conversation) => conversation.id !== activeId);
      const next =
        remaining.find(
          (conversation) =>
            !conversation.archived &&
            conversation.type === "group" &&
            conversation.title?.toLowerCase() === "general",
        ) ||
        remaining.find((conversation) => !conversation.archived) ||
        remaining[0];

      setConversations(remaining);
      setMessages([]);
      setActivePanel(null);
      setThread(null);
      setActiveThreadId(null);
      navigate(next ? `/chat/${next.id}` : "/chat", { replace: true });
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  async function handleDeleteMessage(message) {
    if (!message) return;
    const isReply =
      message.parent_id !== null && message.parent_id !== undefined;
    const confirmed = await confirm({
      title: isReply ? "Eliminar la respuesta" : "Eliminar el mensaje",
      message: isReply
        ? "La respuesta se borrará para todos y no se podrá recuperar."
        : "El mensaje y sus respuestas se borrarán para todos y no se podrán recuperar.",
      confirmLabel: "Eliminar",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteMessage(message.id);
      removeDeletedMessage(message.id, message.parent_id ?? null);
    } catch (err) {
      setMessagesError(err.message);
    }
  }

  function removeDeletedMessage(messageId, parentId) {
    setMessages((prev) => prev.filter((item) => item.id !== messageId));
    setThread((prev) => {
      if (!prev) return prev;
      if (prev.parent?.id === messageId) return null;
      return {
        ...prev,
        replies: prev.replies.filter((reply) => reply.id !== messageId),
      };
    });
    if (parentId) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === parentId
            ? { ...item, reply_count: Math.max(0, (item.reply_count || 1) - 1) }
            : item,
        ),
      );
    } else {
      setActiveThreadId((current) =>
        current === messageId ? null : current,
      );
    }
  }

  function handleTyping() {
    if (!activeId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE) return;
    lastTypingSentRef.current = now;
    sendTyping(activeId).catch(() => {});
  }

  async function handleLoadOlder() {
    if (!activeId || !nextCursor || olderLoading) return;
    const conversationIdToLoad = activeId;
    setOlderLoading(true);
    setMessagesError("");
    try {
      const data = await fetchMessages(conversationIdToLoad, { before: nextCursor });
      if (activeIdRef.current !== conversationIdToLoad) return;
      setMessages((prev) => {
        const known = new Set(prev.map((message) => message.id));
        const older = (data.messages || []).filter(
          (message) => !known.has(message.id),
        );
        return [...older, ...prev];
      });
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      if (activeIdRef.current === conversationIdToLoad) setMessagesError(err.message);
    } finally {
      setOlderLoading(false);
    }
  }

  async function handleOpenThread(messageId) {
    setActiveThreadId(messageId);
    setActivePanel("thread");
    threadRequestRef.current = messageId;
    const known = messages.find((message) => message.id === messageId) || null;
    setThread({ parent: known, replies: [], loading: true });
    try {
      const data = await fetchReplies(messageId);
      if (threadRequestRef.current !== messageId) return;
      setThread({
        parent: data.parent,
        replies: data.replies || [],
        loading: false,
      });
    } catch (err) {
      if (threadRequestRef.current !== messageId) return;
      setThread(null);
      setMessagesError(err.message);
    }
  }

  function handleOpenPanel(panel) {
    setActivePanel(panel);
  }

  function handleClosePanel() {
    setActivePanel(null);
    setActiveThreadId(null);
    setThread(null);
  }

  async function handleSearch(q) {
    if (!activeId) return;
    setLoadingSearch(true);
    try {
      const data = await searchMessages(activeId, q);
      setSearchResults(data || []);
    } catch (err) {
      setSearchResults([]);
      setMessagesError(err.message);
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleSelectResult(message) {
    const conversationIdAtSelect = activeId;
    const rootId = message.parent_id || null;
    const targetId = message.id;
    const flash = () => setHighlightMessageId({ id: targetId, n: Date.now() });

    if (rootId) {
      await handleOpenThread(rootId);
      flash();
      return;
    }

    if (messages.some((item) => item.id === targetId)) {
      flash();
      return;
    }

    let cursor = nextCursor;
    for (let page = 0; page < 10 && cursor; page += 1) {
      try {
        const data = await fetchMessages(conversationIdAtSelect, { before: cursor });
        if (activeIdRef.current !== conversationIdAtSelect) return;
        const older = data.messages || [];
        cursor = data.nextCursor ?? null;
        setMessages((prev) => {
          const known = new Set(prev.map((item) => item.id));
          return [...older.filter((item) => !known.has(item.id)), ...prev];
        });
        setNextCursor(cursor);
        if (older.some((item) => item.id === targetId)) {
          flash();
          return;
        }
      } catch (err) {
        setMessagesError(err.message);
        return;
      }
    }
    handleOpenThread(targetId);
    flash();
  }

  function handleCreated(conversation) {
    setShowNewConversation(false);
    upsertConversation(conversation);
    navigate(`/chat/${conversation.id}`);
  }

  function handleRoomReady(conversation) {
    setShowRooms(false);
    upsertConversation(conversation);
    navigate(`/chat/${conversation.id}`);
  }

  return (
    <main className="relative flex h-full min-h-0 bg-bg text-ink">
      <aside
        className={`h-full w-full shrink-0 border-r border-line bg-sidebar md:flex md:w-[280px] ${
          activeId ? "hidden" : "flex"
        }`}
      >
        <div className="h-full w-full">
          <ConversationList
            conversations={conversations}
            user={user}
            activeId={activeId}
            presence={presence}
            loading={listLoading}
            error={listError || streamError}
            onSelect={(id) => navigate(`/chat/${id}`)}
            onNewDirect={() => setShowNewConversation(true)}
            onOpenRooms={() => setShowRooms(true)}
          />
        </div>
      </aside>

      <section
        className={`h-full min-w-0 flex-1 bg-surface ${
          activeId ? "flex" : "hidden md:flex"
        }`}
      >
        {activeConversation ? (
          <div className="h-full w-full">
            <ChatWindow
              key={activeConversation.id}
              conversation={activeConversation}
              user={user}
              messages={messages}
              hasMore={Boolean(nextCursor)}
              loadingMore={olderLoading}
              loading={messagesLoading}
              error={messagesError}
              onLoadMore={handleLoadOlder}
              onlineCount={onlineCount}
              typingNames={typingNames}
              activePanel={activePanel}
              activeThreadId={activeThreadId}
              onOpenPanel={handleOpenPanel}
              onOpenThread={handleOpenThread}
              onSend={handleSend}
              onToggleReaction={handleToggleReaction}
              onPin={handlePin}
              onDeleteMessage={handleDeleteMessage}
              onToggleMute={handleToggleMute}
              onArchive={handleArchive}
              onDeleteConversation={handleDeleteConversation}
              onTyping={handleTyping}
              onBack={() => navigate("/chat")}
              highlightMessageId={highlightMessageId}
            />
          </div>
        ) : activeId && !listLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted">
            <p>Conversación no encontrada.</p>
            <button
              onClick={() => navigate("/chat")}
              className="min-h-10 rounded-card border border-line bg-raised px-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Volver a Chats
            </button>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-muted">
            <p className="font-display text-2xl text-ink">
              Selecciona una conversación
            </p>
            <p className="text-sm">
              Elige un chat de la lista o crea uno nuevo para empezar.
            </p>
            <button
              onClick={() => setShowNewConversation(true)}
              className="mt-2 min-h-10 rounded-card bg-accent px-4 text-sm font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Nueva conversación
            </button>
          </div>
        )}
      </section>

      {activeConversation && (
        <RightPanel
          panel={activePanel}
          thread={thread}
          members={members}
          presence={presence}
          searchResults={searchResults}
          loadingSearch={loadingSearch}
          onSearch={handleSearch}
          onSelectResult={handleSelectResult}
          onSendReply={handleSendReply}
          onToggleReaction={handleToggleReaction}
          onDeleteMessage={handleDeleteMessage}
          onClose={handleClosePanel}
          user={user}
        />
      )}

      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onCreated={handleCreated}
        />
      )}

      {showRooms && (
        <RoomModal
          onClose={() => setShowRooms(false)}
          onJoined={handleRoomReady}
          onCreated={handleRoomReady}
        />
      )}
    </main>
  );
}
