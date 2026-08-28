import { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../api/auth.js";

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      onLogin(await login(form.username, form.password));
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <div className="flex items-center justify-center mt-24">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-2xl w-96 flex flex-col gap-4"
      >
        <h2 className="text-2xl font-bold text-center">Iniciar sesión</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          name="username"
          placeholder="Usuario"
          value={form.username}
          onChange={handleChange}
          className="bg-slate-800 p-3 rounded-lg"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          className="bg-slate-800 p-3 rounded-lg"
        />
        <button className="bg-blue-500 p-3 rounded-lg font-bold">Entrar</button>
        <p className="text-sm text-center text-slate-400">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-emerald-400">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}
