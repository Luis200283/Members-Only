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
    <div className="flex items-center justify-center mt-24 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-line rounded-card p-8 w-96 max-w-full flex flex-col gap-4"
      >
        <h2 className="font-display text-3xl text-center text-ink">Iniciar sesión</h2>
        {error && <p className="text-danger text-sm">{error}</p>}
        <input
          name="username"
          placeholder="Usuario"
          value={form.username}
          onChange={handleChange}
          className="bg-raised border border-line rounded-card p-3 min-h-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña"
          value={form.password}
          onChange={handleChange}
          className="bg-raised border border-line rounded-card p-3 min-h-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <button className="bg-accent text-accent-ink rounded-card p-3 min-h-10 font-medium">Entrar</button>
        <p className="text-sm text-center text-muted">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-accent underline underline-offset-2">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}
