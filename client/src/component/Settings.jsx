import { useTheme } from "../theme/ThemeContext.jsx";
import { useNotifications } from "../notifications/NotificationsContext.jsx";

function ThemePreview({ id }) {
  return (
    <div
      data-theme={id}
      aria-hidden="true"
      className="flex h-24 overflow-hidden rounded-card border border-line bg-bg font-ui text-ink"
    >
      <div className="flex w-1/3 flex-col gap-1.5 border-r border-line bg-sidebar p-2">
        <span className="h-1.5 w-3/4 rounded-card bg-ink-2" />
        <span className="h-1.5 w-1/2 rounded-card bg-muted" />
        <span className="mt-1 h-1.5 w-2/3 rounded-card bg-accent" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 bg-surface p-2">
        <span className="font-display text-sm leading-none">Sala</span>
        <span className="max-w-[85%] rounded-card bg-raised px-1.5 py-1 text-[10px] leading-tight text-ink-2">
          Revisemos el borrador
        </span>
        <span className="ml-auto rounded-card bg-accent px-1.5 py-0.5 text-[10px] leading-tight text-accent-ink">
          Enviar
        </span>
      </div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme, themes } = useTheme();
  const {
    mode,
    setMode,
    modes,
    permission,
    requestPermission,
    test,
  } = useNotifications();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 bg-bg p-4 text-ink md:p-8">
      <h1 className="font-display text-3xl leading-tight">Ajustes</h1>

      <section className="flex flex-col gap-4" aria-labelledby="appearance-title">
        <div className="flex flex-col gap-1">
          <h2 id="appearance-title" className="text-lg font-semibold">
            Apariencia
          </h2>
          <p className="text-sm text-muted">
            El tema se guarda en este dispositivo.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="appearance-title"
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {themes.map((item) => {
            const active = item.id === theme;
            return (
              <label key={item.id} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name="theme"
                  value={item.id}
                  checked={active}
                  onChange={() => setTheme(item.id)}
                  className="peer sr-only"
                />
                <span
                  className={`flex min-h-10 flex-col gap-3 rounded-card border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                    active
                      ? "border-accent"
                      : "border-line hover:bg-raised"
                  }`}
                >
                  <ThemePreview id={item.id} />
                  <span className="flex items-start gap-2">
                    <span className="flex flex-1 flex-col">
                      <span className="font-semibold">{item.name}</span>
                      <span className="text-xs text-muted">{item.description}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                        active
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line"
                      }`}
                    >
                      {active && (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3 w-3 fill-none stroke-current"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section
        className="flex flex-col gap-4"
        aria-labelledby="notifications-title"
      >
        <div className="flex flex-col gap-1">
          <h2 id="notifications-title" className="text-lg font-semibold">
            Notificaciones
          </h2>
          <p className="text-sm text-muted">
            Se guardan en este dispositivo y también se cambian con la campana
            del chat.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="notifications-title"
          className="flex flex-col gap-2"
        >
          {modes.map((option) => {
            const active = option.id === mode;
            return (
              <label key={option.id} className="relative block cursor-pointer">
                <input
                  type="radio"
                  name="notification-mode"
                  value={option.id}
                  checked={active}
                  onChange={() => setMode(option.id)}
                  className="peer sr-only"
                />
                <span
                  className={`flex min-h-10 items-start gap-3 rounded-card border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                    active ? "border-accent" : "border-line hover:bg-raised"
                  }`}
                >
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-xs text-muted">
                      {option.description}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line"
                    }`}
                  >
                    {active && (
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 fill-none stroke-current"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    )}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {mode !== "silent" && permission === "denied" && (
          <p className="rounded-card bg-raised p-3 text-sm text-muted">
            El navegador bloquea las ventanas de notificación para este sitio.
            Puedes permitirlas en los ajustes del navegador; el sonido seguirá
            funcionando.
          </p>
        )}
        {mode !== "silent" && permission === "unsupported" && (
          <p className="rounded-card bg-raised p-3 text-sm text-muted">
            Este navegador no admite notificaciones del sistema; el sonido sí
            funciona.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {mode === "both" && permission === "default" && (
            <button
              type="button"
              onClick={requestPermission}
              className="min-h-10 rounded-card bg-accent px-4 text-sm font-semibold text-accent-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Permitir notificaciones
            </button>
          )}
          {mode !== "silent" && (
            <button
              type="button"
              onClick={test}
              className="min-h-10 rounded-card border border-line bg-raised px-4 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              Probar
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
