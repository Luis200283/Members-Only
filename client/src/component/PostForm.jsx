import { useState } from "react";
import { createPost } from "../api/posts.js";

export default function PostForm({ onCreated }) {
  const [form, setForm] = useState({ title: "", body: "" });
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const post = await createPost(form.title, form.body);
      onCreated(post);
      setForm({ title: "", body: "" });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900 rounded-2xl p-5 flex flex-col gap-3"
    >
      <h2 className="font-bold">Crear un post</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <input
        name="title"
        placeholder="Título"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="bg-slate-800 p-3 rounded-lg"
      />
      <textarea
        name="body"
        placeholder="Contenido..."
        rows="3"
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
        className="bg-slate-800 p-3 rounded-lg"
      />
      <button className="bg-emerald-500 text-slate-900 p-3 rounded-lg font-bold">
        Publicar
      </button>
    </form>
  );
}
