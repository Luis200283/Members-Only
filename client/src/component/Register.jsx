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
    <div className="flex items-center justify-center mt-24">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 p-8 rounded-2xl w-96 flex flex-col gap-4"
      >
        <h2 className="text-2xl font-bold text-center">Crear cuenta</h2>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          name="username"
          placeholder="Usuario (3-30 caracteres)"
          value={form.username}
          onChange={handleChange}
          className="bg-slate-800 p-3 rounded-lg"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña (mínimo 6)"
          value={form.password}
          onChange={handleChange}
          className="bg-slate-800 p-3 rounded-lg"
        />
        <input
          name="confirm"
          type="password"
          placeholder="Repetir contraseña"
          value={form.confirm}
          onChange={handleChange}
          className="bg-slate-800 p-3 rounded-lg"
        />
        <button className="bg-emerald-500 text-slate-900 p-3 rounded-lg font-bold">
          Registrarse
        </button>
        <p className="text-sm text-center text-slate-400">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-blue-400">
            Entra
          </Link>
        </p>
      </form>
    </div>
  );
}
