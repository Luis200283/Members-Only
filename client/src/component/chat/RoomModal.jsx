import { useEffect, useRef, useState } from "react";
import { createRoom, fetchRooms, joinRoom } from "../../api/chat.js";
import Icon from "./parts/icons.jsx";

const TABS = [
  { id: "explore", label: "Explorar salas" },
  { id: "create", label: "Crear sala" },
];

export default function RoomModal({ onClose, onJoined, onCreated }) {
  const dialogRef = useRef(null);
  const [tab, setTab] = useState("explore");
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [isPublic, setIsPublic] = useState(true);
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
    let cancelled = false;
    fetchRooms()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectTab(id) {
    setTab(id);
    setError("");
  }

  async function handleJoin(room) {
    setBusyId(room.id);
    setError("");
    try {
      const conversation = await joinRoom(room.id);
      onJoined(conversation);
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("El nombre de la sala es obligatorio");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const conversation = await createRoom({
        title: trimmedTitle,
        topic: topic.trim() || undefined,
        is_public: isPublic,
      });
      onCreated(conversation);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  const inputClass =
    "mt-1 min-h-10 w-full rounded-card border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--c-accent-soft)]";

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
        aria-labelledby="room-modal-title"
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border border-line bg-bg p-4 text-ink shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="room-modal-title" className="font-display text-2xl leading-tight">
            Salas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div role="tablist" aria-label="Salas" className="mt-3 flex gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`room-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`room-panel-${item.id}`}
              onClick={() => selectTab(item.id)}
              className={`flex min-h-10 flex-1 items-center justify-center rounded-card border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-accent ${
                tab === item.id
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-bg text-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        {tab === "explore" && (
          <div
            role="tabpanel"
            id="room-panel-explore"
            aria-labelledby="room-tab-explore"
            className="mt-3 min-h-0 flex-1 overflow-y-auto"
          >
            {loading ? (
              <p className="py-4 text-center text-sm text-muted">Cargando salas…</p>
            ) : rooms.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                No hay salas públicas todavía.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {rooms.map((room) => (
                  <li
                    key={room.id}
                    className="flex min-h-10 items-center gap-3 rounded-card px-3 py-2 hover:bg-raised"
                  >
                    <Icon name="hash" className="h-4 w-4 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{room.title}</p>
                      {room.topic && (
                        <p className="truncate text-xs text-muted">{room.topic}</p>
                      )}
                      <p className="text-xs text-muted">
                        {room.member_count} miembros
                      </p>
                    </div>
                    {room.joined ? (
                      <span className="flex items-center gap-1 text-sm text-muted">
                        <Icon name="check" className="h-4 w-4" />
                        Unido
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoin(room)}
                        disabled={busyId !== null}
                        aria-label={`Unirse a ${room.title}`}
                        className="min-h-10 rounded-card border border-line bg-bg px-3 text-sm font-medium text-ink hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                      >
                        {busyId === room.id ? "Uniendo…" : "Unirse"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "create" && (
          <form
            role="tabpanel"
            id="room-panel-create"
            aria-labelledby="room-tab-create"
            onSubmit={handleCreate}
            className="mt-3 flex min-h-0 flex-col gap-3 overflow-y-auto"
          >
            <div>
              <label className="text-sm font-medium text-ink-2" htmlFor="room-title">
                Nombre
              </label>
              <input
                id="room-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={80}
                required
                placeholder="lecturas"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-ink-2" htmlFor="room-topic">
                Tema <span className="text-muted">(opcional)</span>
              </label>
              <input
                id="room-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                maxLength={160}
                placeholder="De qué se habla en la sala"
                className={inputClass}
              />
            </div>
            <label className="flex min-h-10 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-4 w-4 accent-[var(--c-accent)]"
              />
              Sala pública (cualquier miembro puede verla y unirse)
            </label>
            <button
              type="submit"
              disabled={creating}
              className="min-h-10 w-full rounded-card bg-accent px-3 py-2 font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creando…" : "Crear sala"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
