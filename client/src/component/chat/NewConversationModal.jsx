import { useEffect, useRef, useState } from "react";
import { createConversation, fetchChatUsers } from "../../api/chat.js";

export default function NewConversationModal({ onClose, onCreated }) {
  const dialogRef = useRef(null);
  const [tab, setTab] = useState("direct");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const previous = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError("");
      return undefined;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const users = await fetchChatUsers(term);
        if (!cancelled) {
          setResults(users);
          setSearchError("");
        }
      } catch (err) {
        if (!cancelled) setSearchError(err.message);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function toggleSelected(user) {
    setSelectedUsers((prev) =>
      prev.some((item) => item.id === user.id)
        ? prev.filter((item) => item.id !== user.id)
        : [...prev, user],
    );
  }

  async function startDirect(user) {
    setCreating(true);
    setError("");
    try {
      const conversation = await createConversation({
        type: "direct",
        targetUserId: user.id,
      });
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function startGroup() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("El título del grupo es obligatorio");
      return;
    }
    if (selectedUsers.length === 0) {
      setError("Selecciona al menos un miembro");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const conversation = await createConversation({
        type: "group",
        title: trimmedTitle,
        memberIds: selectedUsers.map((selectedUser) => selectedUser.id),
      });
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 font-ui"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-line bg-bg p-4 text-ink shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="new-conversation-title" className="font-display text-2xl leading-tight">Nueva conversación</h2>
          <button
            onClick={onClose}
            className="flex h-10 items-center rounded-card border border-line px-3 text-sm font-medium text-muted hover:bg-raised hover:text-ink"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              setTab("direct");
              setError("");
            }}
            className={`flex h-10 flex-1 items-center justify-center rounded-card border px-3 text-sm font-semibold ${
              tab === "direct"
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-bg text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            Mensaje directo
          </button>
          <button
            onClick={() => {
              setTab("group");
              setError("");
            }}
            className={`flex h-10 flex-1 items-center justify-center rounded-card border px-3 text-sm font-semibold ${
              tab === "group"
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-bg text-muted hover:bg-raised hover:text-ink"
            }`}
          >
            Grupo
          </button>
        </div>

        {tab === "group" && (
          <div className="mt-3">
            <label className="text-sm font-medium text-ink-2" htmlFor="group-title">
              Título del grupo
            </label>
            <input
              id="group-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="Equipo de estudio"
              className="mt-1 min-h-10 w-full rounded-card border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
            />
          </div>
        )}

        <div className="mt-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            aria-label="Buscar usuarios"
            placeholder="Buscar usuarios..."
            className="min-h-10 w-full rounded-card border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]"
          />
          <p className="mt-1 text-xs text-muted">
            Escribe al menos 2 caracteres.
          </p>
        </div>

        {tab === "group" && selectedUsers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleSelected(user)}
                aria-label={`Quitar a @${user.username}`}
                className="flex min-h-10 items-center rounded-card bg-accent-soft px-3 text-xs font-medium text-accent"
              >
                @{user.username}{" "}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        {searchError && (
          <p className="mt-2 text-sm text-danger">{searchError}</p>
        )}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {searching ? (
            <p className="py-4 text-center text-sm text-muted">
              Buscando...
            </p>
          ) : query.trim().length < 2 ? (
            <p className="py-4 text-center text-sm text-muted">
              Busca por nombre de usuario.
            </p>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              No se encontraron usuarios.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((user) => {
                const isSelected = selectedUsers.some(
                  (selectedUser) => selectedUser.id === user.id,
                );
                return (
                  <li key={user.id}>
                    <button
                      onClick={() =>
                        tab === "direct"
                          ? startDirect(user)
                          : toggleSelected(user)
                      }
                      disabled={creating}
                      className={`flex min-h-10 w-full items-center gap-3 rounded-card px-3 py-2 text-left disabled:opacity-60 ${
                        isSelected
                          ? "bg-accent-soft"
                          : "hover:bg-raised"
                      }`}
                    >
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-card bg-line text-sm font-semibold uppercase text-ink">
                        {user.username.charAt(0)}
                      </span>
                      <span className="flex-1 truncate">@{user.username}</span>
                      {tab === "group" ? (
                        <span
                          className={`text-sm ${
                            isSelected ? "font-semibold text-accent" : "text-muted"
                          }`}
                        >
                          {isSelected ? "Seleccionado" : "Seleccionar"}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-accent">
                          Crear DM
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {tab === "group" && (
          <button
            onClick={startGroup}
            disabled={creating}
            className="mt-3 min-h-10 w-full rounded-card bg-accent px-3 py-2 font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear grupo"}
          </button>
        )}
      </div>
    </div>
  );
}
