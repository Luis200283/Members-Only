import { useEffect, useState, useRef } from "react";
import { fetchAdminMessages, createAdminMessage, streamAdminMessages } from "../api/admin.js";

export default function AdminChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  async function load() {
    try {
      setMessages(await fetchAdminMessages());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const source = streamAdminMessages((msg) => {
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    });
    return () => source.close();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await createAdminMessage(text);
      setText("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="max-w-300 mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Chat privado de admins</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <ul className="bg-slate-900 rounded-2xl p-4 h-150 overflow-y-auto no-scrollbar flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-slate-500 my-auto">
            Sin mensajes todavía.
          </p>
        ) : (
          messages.map((m) => (
            <li
              key={m.id}
              className={`max-w-[80%] rounded-xl px-3 py-2 ${
                m.username === user.username
                  ? "bg-blue-600 self-end"
                  : "bg-slate-700 self-start"
              }`}
            >
              <span className="text-xs text-slate-300">{m.username}</span>
              <p>{m.body}</p>
              <span className="text-xs text-slate-400">
                {new Date(m.created_at).toLocaleTimeString()}
              </span>
            </li>
          ))
        )}
        <div ref={bottomRef} />
      </ul>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="flex-1 bg-slate-900 p-3 rounded-lg"
        />
        <button className="bg-emerald-500 text-slate-900 px-4 rounded-lg font-bold">
          Enviar
        </button>
      </form>
    </main>
  );
}
