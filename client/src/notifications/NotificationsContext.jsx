import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "circulo:notificaciones";
const VALID_MODES = ["both", "sound", "silent"];
const TOAST_MS = 6000;

export const NOTIFICATION_MODES = [
  {
    id: "both",
    label: "Sonido y aviso",
    description: "Suena y muestra la ventana de notificación.",
  },
  {
    id: "sound",
    label: "Solo sonido",
    description: "Suena, pero no muestra la ventana.",
  },
  {
    id: "silent",
    label: "Silenciar",
    description: "Ni suena ni muestra ventanas.",
  },
];

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID_MODES.includes(stored)) return stored;
  } catch {
    // localStorage puede no estar disponible; usamos el valor por defecto.
  }
  return "both";
}

function currentPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const [permission, setPermission] = useState(currentPermission);
  const [toasts, setToasts] = useState([]);
  const audioRef = useRef(null);
  const toastSeq = useRef(0);
  const toastTimers = useRef(new Map());

  // Los navegadores bloquean el audio hasta que hay una interacción del usuario.
  useEffect(() => {
    function unlock() {
      try {
        if (!audioRef.current) {
          const AudioCtor = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtor) return;
          audioRef.current = new AudioCtor();
        }
        if (audioRef.current.state === "suspended") audioRef.current.resume();
      } catch {
        // Sin audio disponible: las notificaciones visuales siguen funcionando.
      }
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    function sync() {
      setPermission(currentPermission());
    }
    if (typeof Notification === "undefined") return undefined;
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const playChime = useCallback(() => {
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioRef.current) audioRef.current = new AudioCtor();
      const context = audioRef.current;
      if (context.state === "suspended") context.resume();
      const start = context.currentTime;
      [880, 1174.66].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        const from = start + index * 0.11;
        gain.gain.setValueAtTime(0.0001, from);
        gain.gain.exponentialRampToValueAtTime(0.14, from + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, from + 0.26);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(from);
        oscillator.stop(from + 0.3);
      });
    } catch {
      // Si el audio falla, no interrumpimos la notificación visual.
    }
  }, []);

  const dismissToast = useCallback((toastId) => {
    const timer = toastTimers.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(toastId);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback(
    ({ title, body, tag, onClick }) => {
      const id = ++toastSeq.current;
      setToasts((prev) => {
        const kept = tag ? prev.filter((toast) => toast.tag !== tag) : prev;
        return [...kept, { id, title, body, tag, onClick }].slice(-3);
      });
      const timer = setTimeout(() => dismissToast(id), TOAST_MS);
      toastTimers.current.set(id, timer);
    },
    [dismissToast],
  );

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported";
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      const fallback = currentPermission();
      setPermission(fallback);
      return fallback;
    }
  }, []);

  const setMode = useCallback(
    (next) => {
      if (!VALID_MODES.includes(next)) return;
      setModeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin persistencia: el modo dura lo que dure la sesión.
      }
      if (next === "both" && currentPermission() === "default") {
        requestPermission();
      }
    },
    [requestPermission],
  );

  const showSystemBanner = useCallback(({ title, body, tag, onClick }) => {
    if (typeof Notification === "undefined") return false;
    if (Notification.permission !== "granted") return false;
    try {
      const notification = new Notification(title, { body, tag, silent: true });
      notification.onclick = () => {
        try {
          window.focus();
        } catch {
          // Algunos navegadores no permiten enfocar la ventana.
        }
        onClick?.();
        notification.close();
      };
      return true;
    } catch {
      return false;
    }
  }, []);

  const notify = useCallback(
    ({ title, body, tag, onClick }) => {
      if (mode === "silent") return;
      playChime();
      if (mode !== "both") return;
      const hidden =
        document.visibilityState !== "visible" || !document.hasFocus();
      if (hidden && showSystemBanner({ title, body, tag, onClick })) return;
      pushToast({ title, body, tag, onClick });
    },
    [mode, playChime, showSystemBanner, pushToast],
  );

  const test = useCallback(() => {
    const sample = "Así se verá el aviso cuando llegue un mensaje.";
    playChime();
    pushToast({ title: "Círculo", body: sample });
    showSystemBanner({ title: "Círculo", body: sample });
  }, [playChime, pushToast, showSystemBanner]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      permission,
      requestPermission,
      notify,
      playChime,
      test,
      modes: NOTIFICATION_MODES,
    }),
    [mode, setMode, permission, requestPermission, notify, playChime, test],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-card border border-line border-l-4 border-l-accent bg-surface shadow-lg"
          >
            <button
              type="button"
              onClick={() => {
                toast.onClick?.();
                dismissToast(toast.id);
              }}
              className="flex w-full flex-col gap-1 px-3 py-3 text-left hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                {toast.title}
              </span>
              <span className="line-clamp-3 text-sm text-ink">
                {toast.body}
              </span>
            </button>
            <div className="flex justify-end border-t border-line px-2 py-1">
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Descartar aviso"
                className="rounded-card px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                Cerrar
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications debe usarse dentro de NotificationsProvider",
    );
  }
  return context;
}
