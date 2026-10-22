import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Login from "./component/Login.jsx";
import Register from "./component/Register.jsx";
import ChatPage from "./component/chat/ChatPage.jsx";
import Settings from "./component/Settings.jsx";
import { LogoMark } from "./component/brand/Logo.jsx";
import { fetchMe, logout } from "./api/auth.js";

const navLink =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-card px-3 text-sm font-medium text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-accent";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMe().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink">
        Cargando...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="flex h-dvh flex-col bg-bg text-ink">
        <nav className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-sidebar px-3 py-2 md:px-6 md:py-3">
          <Link
            to="/"
            aria-label="Círculo, ir al chat"
            className="inline-flex items-center gap-2.5 rounded-card text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <LogoMark className="h-7 w-7 text-accent" />
            <span className="font-display text-[22px] leading-none">Círculo</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-1 md:gap-2">
            {user ? (
              <>
                <Link
                  to="/chat"
                  className="hidden text-sm text-muted hover:text-ink md:inline"
                >
                  @{user.username}
                  {user.isAdmin && (
                    <span className="ml-1 font-medium text-ink-2">(admin)</span>
                  )}
                </Link>
                {user.isAdmin && (
                  <span className="text-xs font-semibold text-accent md:hidden">
                    admin
                  </span>
                )}
                <Link
                  to="/ajustes"
                  aria-label="Ajustes"
                  className={`${navLink} w-10 justify-center px-0 md:w-auto md:px-3`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-4 shrink-0 fill-none stroke-current stroke-[1.75] [stroke-linecap:round] [stroke-linejoin:round]"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span className="hidden md:inline">Ajustes</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className={`${navLink} text-muted hover:text-ink`}
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={navLink}>
                  Login
                </Link>
                <Link to="/register" className={navLink}>
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={<Navigate to={user ? "/chat" : "/login"} replace />}
            />
            <Route
              path="/login"
              element={
                user ? <Navigate to="/chat" replace /> : <Login onLogin={setUser} />
              }
            />
            <Route
              path="/register"
              element={
                user ? (
                  <Navigate to="/chat" replace />
                ) : (
                  <Register onRegister={setUser} />
                )
              }
            />
            <Route
              path="/chat"
              element={
                !user ? <Navigate to="/login" replace /> : <ChatPage user={user} />
              }
            />
            <Route
              path="/chat/:conversationId"
              element={
                !user ? <Navigate to="/login" replace /> : <ChatPage user={user} />
              }
            />
            <Route
              path="/ajustes"
              element={
                !user ? <Navigate to="/login" replace /> : <Settings />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
