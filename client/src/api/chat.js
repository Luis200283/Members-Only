function extractError(data, fallback) {
  if (data?.errors?.length) return data.errors[0].msg;
  return data?.error || fallback;
}

async function request(url, options) {
  const res = await fetch(url, { cache: "no-store", ...options });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(extractError(data, "Error al conectar con el chat"));
  return data;
}

export function fetchChatUsers(query) {
  const q = query.trim();
  if (q.length < 2) return Promise.resolve([]);
  return request(`/api/chat/users?q=${encodeURIComponent(q)}`);
}

export function fetchConversations() {
  return request("/api/chat/conversations");
}

export function fetchConversation(id) {
  return request(`/api/chat/conversations/${id}`);
}

export function createConversation(payload) {
  return request("/api/chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchMessages(id, { before, limit = 30 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", String(before));
  return request(`/api/chat/conversations/${id}/messages?${params}`);
}

export function sendChatMessage(id, body, { parentId, quotedId } = {}) {
  return request(`/api/chat/conversations/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parentId, quotedId }),
  });
}

export function markConversationRead(id, messageId) {
  return request(`/api/chat/conversations/${id}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
}

function postJson(url, payload) {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchRooms() {
  return request("/api/chat/rooms");
}

export function createRoom({ title, topic, is_public }) {
  return postJson("/api/chat/rooms", { title, topic, is_public });
}

export function joinRoom(id) {
  return request(`/api/chat/rooms/${id}/join`, { method: "POST" });
}

export function leaveConversation(id) {
  return request(`/api/chat/conversations/${id}/leave`, { method: "POST" });
}

export function fetchReplies(messageId) {
  return request(`/api/chat/messages/${messageId}/replies`);
}

export function toggleReaction(messageId, emoji) {
  return postJson(`/api/chat/messages/${messageId}/reactions`, { emoji });
}

export function pinMessage(id, messageId) {
  return postJson(`/api/chat/conversations/${id}/pin`, { messageId });
}

export function setMuted(id, muted) {
  return postJson(`/api/chat/conversations/${id}/mute`, { muted });
}

export function archiveConversation(id, archived) {
  return postJson(`/api/chat/conversations/${id}/archive`, { archived });
}

export function deleteConversation(id) {
  return request(`/api/chat/conversations/${id}`, { method: "DELETE" });
}

export function deleteMessage(messageId) {
  return request(`/api/chat/messages/${messageId}`, { method: "DELETE" });
}

export function sendTyping(id) {
  return request(`/api/chat/conversations/${id}/typing`, { method: "POST" });
}

export function searchMessages(id, q) {
  const params = new URLSearchParams({ q });
  return request(`/api/chat/conversations/${id}/search?${params}`);
}

export function fetchLinks(id) {
  return request(`/api/chat/conversations/${id}/links`);
}

export function fetchPresence() {
  return request("/api/chat/presence");
}
