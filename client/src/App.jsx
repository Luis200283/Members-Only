import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Login from "./component/Login.jsx";
import Register from "./component/Register.jsx";
import PostList from "./component/PostList.jsx";
import AdminChat from "./component/AdminChat.jsx";
import { fetchMe, logout, becomeAdmin } from "./api/auth.js";

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

  async function handleJoinClub() {
    const secret = window.prompt("Clave secreta del club de admins: ");
    if (!secret) return;
    try {
      setUser(await becomeAdmin(secret));
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-800 text-slate-100">
        Cargando...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-800 text-slate-100">
        <nav className="flex items-center justify-between bg-slate-900 px-6 py-3">
          <Link to="/" className="text-xl font-bold">
            Member Only
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="text-slate-300">
                  @{user.username}
                  {user.isAdmin && (
                    <span className="ml-1 text-amber-400">(admin)</span>
                  )}
                </span>
                {!user.isAdmin && (
                  <button
                    onClick={handleJoinClub}
                    className="bg-amber-500 text-slate-900 px-3 py-1 rounded-lg"
                  >
                    Unirse al Club
                  </button>
                )}
                {user.isAdmin && (
                  <Link
                    to="/admin"
                    className="bg-purple-600 px-3 py-1 rounded-lg"
                  >
                    Chat admin
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-red-500 px-3 py-1 rounded-lg"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="bg-blue-500 px-3 py-1 rounded-lg">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-emerald-500 px-3 py-1 rounded-lg"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<PostList user={user} />} />
          <Route
            path="/login"
            element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />}
          />
          <Route
            path="/register"
            element={
              user ? <Navigate to="/" /> : <Register onRegister={setUser} />
            }
          />
          <Route
            path="/admin"
            element={
              !user ? (
                <Navigate to="/login" />
              ) : user.isAdmin ? (
                <AdminChat user={user} />
              ) : (
                <Navigate to="/" />
              )
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
