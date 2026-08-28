export async function fetchPosts() {
  const res = await fetch("/api/posts");
  if (!res.ok) throw new Error("Error al obtener los posts");
  return res.json();
}

export async function createPost(title, body) {
  const res = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.errors?.[0]?.msg || data.error || "Error al crear el post");
  return data;
}

export async function deletePost(id) {
  const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al eliminar el post");
  return data;
}


