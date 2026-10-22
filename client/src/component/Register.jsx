import { useState } from "react";
import { Link } from "react-router-dom";
import { register } from "../api/auth.js";

export default function Register({ onRegister }) {
  const [form, setForm] = useState({ username: "", password: "", confirm: "" });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    try {
      onRegister(await register(form.username, form.password));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="flex items-center justify-center mt-24 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-surface border border-line rounded-card p-8 w-96 max-w-full flex flex-col gap-4"
      >
        <h2 className="font-display text-3xl text-center text-ink">Crear cuenta</h2>
        {error && <p className="text-danger text-sm">{error}</p>}
        <input
          name="username"
          placeholder="Usuario (3-30 caracteres)"
          value={form.username}
          onChange={handleChange}
          className="bg-raised border border-line rounded-card p-3 min-h-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña (mínimo 6)"
          value={form.password}
          onChange={handleChange}
          className="bg-raised border border-line rounded-card p-3 min-h-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <input
          name="confirm"
          type="password"
          placeholder="Repetir contraseña"
          value={form.confirm}
          onChange={handleChange}
          className="bg-raised border border-line rounded-card p-3 min-h-10 text-ink placeholder:text-muted focus:outline-2 focus:outline-accent"
        />
        <button className="bg-accent text-accent-ink rounded-card p-3 min-h-10 font-medium">
          Registrarse
        </button>
        <p className="text-sm text-center text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-accent underline underline-offset-2">
            Entra
          </Link>
        </p>
      </form>
    </div>
  );
}
