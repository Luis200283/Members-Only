import { useId, useRef, useState } from "react";
import Icon from "./parts/icons.jsx";
import { REACTION_EMOJIS } from "./parts/Reactions.jsx";

const MAX_LENGTH = 4000;
const TYPING_INTERVAL = 3000;

export default function MessageComposer({
  onSend,
  onTyping,
  quoted = null,
  onClearQuote,
  members = [],
  placeholder = "Escribe un mensaje...",
  disabled,
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState(null);
  const [activeMention, setActiveMention] = useState(0);
  const textareaRef = useRef(null);
  const lastTypingRef = useRef(0);
  const listboxId = useId();

  const trimmed = text.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending;

  const suggestions = mention
    ? members
        .filter((member) =>
          member.username.toLowerCase().startsWith(mention.query.toLowerCase())
        )
        .slice(0, 6)
    : [];

  function notifyTyping() {
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTypingRef.current < TYPING_INTERVAL) return;
    lastTypingRef.current = now;
    onTyping();
  }

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError("");
    try {
      await onSend(trimmed, { quotedId: quoted?.id ?? null });
      setText("");
      setMention(null);
      onClearQuote?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleChange(event) {
    const value = event.target.value;
    const caret = event.target.selectionStart ?? value.length;
    setText(value);
    notifyTyping();

    const before = value.slice(0, caret);
    const match = before.match(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u);
    setMention(match ? { start: caret - match[1].length - 1, query: match[1] } : null);
    setActiveMention(0);
  }

  function insertAtCursor(snippet) {
    const element = textareaRef.current;
    const start = element?.selectionStart ?? text.length;
    const end = element?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + snippet + text.slice(end);
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      const pos = start + snippet.length;
      element.setSelectionRange(pos, pos);
    });
  }

  function pickMention(member) {
    if (!mention) return;
    const element = textareaRef.current;
    const caret = element?.selectionStart ?? text.length;
    const next = text.slice(0, mention.start) + `@${member.username} ` + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      if (!element) return;
      element.focus();
      const pos = mention.start + member.username.length + 2;
      element.setSelectionRange(pos, pos);
    });
  }

  const listOpen = suggestions.length > 0;
  const activeIndex = Math.min(activeMention, Math.max(suggestions.length - 1, 0));
  const activeOptionId = listOpen ? `${listboxId}-${activeIndex}` : undefined;

  function handleKeyDown(event) {
    if (listOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMention((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMention((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if ((event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) || event.key === "Tab") {
        event.preventDefault();
        pickMention(suggestions[activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMention(null);
        return;
      }
    }
    if (event.key === "Escape") {
      setEmojiOpen(false);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="shrink-0 px-3 pt-2 pb-4 md:px-6">
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="relative rounded-card border border-line bg-bg px-3 pt-3 pb-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft focus-within:outline-2 focus-within:outline-accent">
        {quoted && (
          <div className="mb-2 flex items-start gap-2 rounded-card border-l-2 border-muted bg-raised py-1 pl-3 pr-1 text-[13px] text-muted">
            <div className="min-w-0 flex-1">
              <b className="block text-xs font-semibold text-ink">{quoted.username}</b>
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{quoted.body}</span>
            </div>
            <button
              type="button"
              onClick={onClearQuote}
              aria-label="Quitar cita"
              className="grid h-7 w-7 flex-none place-items-center rounded-card text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {listOpen && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Menciones"
            className="absolute bottom-full left-0 z-10 mb-1 flex min-w-40 flex-col rounded-card border border-line bg-bg p-1 shadow-sm"
          >
            {suggestions.map((member, index) => (
              <li
                key={member.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickMention(member)}
                className={`flex h-10 w-full cursor-pointer items-center rounded-card px-2 text-left text-[13px] md:h-8 ${
                  index === activeIndex ? "bg-raised" : "hover:bg-raised"
                }`}
              >
                @{member.username}
              </li>
            ))}
          </ul>
        )}

        {emojiOpen && (
          <div
            role="group"
            aria-label="Emojis disponibles"
            className="absolute bottom-full right-0 z-10 mb-1 flex flex-wrap gap-1 rounded-card border border-line bg-bg p-1 shadow-sm"
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertAtCursor(emoji)}
                aria-label={`Insertar ${emoji}`}
                className="flex h-10 w-10 items-center justify-center rounded-card text-base hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
              >
                <span aria-hidden="true">{emoji}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={listOpen}
          aria-controls={listOpen ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={MAX_LENGTH}
          rows={1}
          disabled={disabled}
          readOnly={sending}
          placeholder={placeholder}
          aria-label="Escribe un mensaje"
          className="block max-h-32 min-h-6 w-full resize-none bg-transparent text-sm leading-6 text-ink outline-none placeholder:text-muted disabled:opacity-60"
        />
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEmojiOpen((value) => !value)}
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            disabled={disabled}
            className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
          >
            <Icon name="smile" />
          </button>
          <button
            type="button"
            onClick={() => insertAtCursor("@")}
            aria-label="Mencionar"
            disabled={disabled}
            className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
          >
            <Icon name="at" />
          </button>
          <span className="flex-1 text-right text-xs text-muted">
            {text.length}/{MAX_LENGTH}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend || disabled}
            className="inline-flex h-10 items-center gap-2 rounded-card bg-accent px-4 text-sm font-semibold text-accent-ink hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        <kbd className="rounded-card border border-line bg-bg px-1 text-[11px] leading-4">
          Enter
        </kbd>{" "}
        para enviar ·{" "}
        <kbd className="rounded-card border border-line bg-bg px-1 text-[11px] leading-4">
          Shift
        </kbd>{" "}
        +{" "}
        <kbd className="rounded-card border border-line bg-bg px-1 text-[11px] leading-4">
          Enter
        </kbd>{" "}
        para nueva línea
      </p>
    </div>
  );
}
