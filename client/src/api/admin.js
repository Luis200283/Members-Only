export async function fetchAdminMessages() {
  const res = await fetch("/api/admin/messages");
  if (!res.ok) throw new Error("Error al obtener el chat");
  return res.json();
}

export async function createAdminMessage(body) {
  const res = await fetch("/api/admin/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.errors?.[0]?.msg || data.error || "Error al enviar");
  return data;
}

export function streamAdminMessages(onMessage) {
  const source = new EventSource("/api/admin/messages/stream");
  source.onmessage = (event) => onMessage(JSON.parse(event.data));
  return source;
}