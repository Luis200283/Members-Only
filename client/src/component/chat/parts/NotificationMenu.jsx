import { useEffect, useRef, useState } from "react";
import Icon from "./icons.jsx";
import { useNotifications } from "../../../notifications/NotificationsContext.jsx";

export default function NotificationMenu() {
  const {
    mode,
    setMode,
    permission,
    requestPermission,
    test,
    modes,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const current = modes.find((item) => item.id === mode) || modes[0];
  const iconName = mode === "silent" ? "bellOff" : "bell";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notificaciones: ${current.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-card text-muted hover:bg-raised hover:text-ink aria-expanded:bg-bg aria-expanded:text-ink focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8"
      >
        <Icon name={iconName} />
        {mode === "sound" && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent md:right-0.5 md:top-0.5"
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notificaciones"
          className="absolute right-0 top-full z-30 mt-1 flex w-72 flex-col gap-1 rounded-card border border-line bg-bg p-2 shadow-sm"
        >
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Notificaciones
          </p>
          {modes.map((option) => {
            const active = option.id === mode;
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => setMode(option.id)}
                className={`flex min-h-10 items-start gap-2 rounded-card px-2 py-2 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent ${
                  active ? "bg-raised" : ""
                }`}
              >
                <span className="mt-0.5 flex w-4 flex-none justify-center text-accent">
                  {active && <Icon name="check" className="h-4 w-4" />}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium text-ink">
                    {option.label}
                  </span>
                  <span className="text-xs text-muted">{option.description}</span>
                </span>
              </button>
            );
          })}

          {mode !== "silent" && permission === "default" && (
            <button
              type="button"
              onClick={requestPermission}
              className="mt-1 flex min-h-10 items-center gap-2 rounded-card border border-line px-2 text-left text-[13px] font-medium text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Icon name="bell" />
              Permitir notificaciones del navegador
            </button>
          )}
          {mode !== "silent" && permission === "denied" && (
            <p className="mt-1 rounded-card bg-raised px-2 py-2 text-xs text-muted">
              El navegador bloquea las ventanas de notificación. Puedes
              habilitarlas en los permisos del sitio. El sonido seguirá
              funcionando.
            </p>
          )}
          {mode !== "silent" && permission === "unsupported" && (
            <p className="mt-1 rounded-card bg-raised px-2 py-2 text-xs text-muted">
              Este navegador no admite notificaciones del sistema. El sonido
              sí funciona.
            </p>
          )}

          <button
            type="button"
            onClick={test}
            className="mt-1 flex min-h-10 items-center gap-2 rounded-card px-2 text-left text-[13px] text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Icon name="send" />
            Probar
          </button>
        </div>
      )}
    </div>
  );
}
