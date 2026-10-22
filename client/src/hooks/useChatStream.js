import { useEffect, useLayoutEffect, useRef, useState } from "react";

export default function useChatStream(handlers = {}) {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const [connected, setConnected] = useState(false);
  const [streamError, setStreamError] = useState("");

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;

    const source = new EventSource("/api/chat/stream", {
      withCredentials: true,
    });

    function listen(eventName, handlerName) {
      source.addEventListener(eventName, (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }
        handlersRef.current?.[handlerName]?.(data);
      });
    }

    listen("ready", "onReady");
    listen("message.created", "onMessage");
    listen("message.deleted", "onMessageDeleted");
    listen("conversation.created", "onConversation");
    listen("read.updated", "onRead");
    listen("reaction.updated", "onReaction");
    listen("thread.updated", "onThread");
    listen("typing", "onTyping");
    listen("presence", "onPresence");
    listen("conversation.updated", "onConversationUpdated");

    source.onopen = () => {
      setConnected(true);
      setStreamError("");
      handlersRef.current?.onOpen?.();
    };

    source.onerror = () => {
      setConnected(false);
      setStreamError(
        "Conexión en tiempo real interrumpida. Reintentando...",
      );
    };

    return () => source.close();
  }, []);

  return { connected, streamError };
}
