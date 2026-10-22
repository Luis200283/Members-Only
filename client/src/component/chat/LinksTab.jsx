import { useEffect, useState } from "react";
import { fetchLinks } from "../../api/chat.js";

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LinksTab({ conversationId, onOpenMessage }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchLinks(conversationId)
      .then((data) => {
        if (!cancelled) setLinks(data);
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
  }, [conversationId]);

  if (loading) {
    return <p className="p-6 text-center text-sm text-muted">Cargando enlaces...</p>;
  }

  if (error) {
    return <p className="p-6 text-center text-sm text-danger">{error}</p>;
  }

  if (links.length === 0) {
    return <p className="p-6 text-center text-sm text-muted">No hay enlaces en esta sala.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 px-3 py-4 md:px-6">
      {links.map((link, index) => (
        <li
          key={`${link.message_id}-${index}`}
          className="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-[13px]"
        >
          <div className="min-w-0 flex-1">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {link.url}
            </a>
            <span className="text-xs text-muted">
              {link.username} · {formatTime(link.created_at)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenMessage?.(link.message_id)}
            aria-label={`Ver mensaje de ${link.username} con este enlace`}
            className="min-h-10 min-w-10 flex-none rounded-card md:min-h-8 md:min-w-0 border border-line bg-bg px-3 text-[13px] font-medium hover:border-muted focus-visible:outline-2 focus-visible:outline-accent"
          >
            Ver
          </button>
        </li>
      ))}
    </ul>
  );
}
