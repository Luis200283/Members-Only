export async function fetchMe() {
  const res = await fetch("/api/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    //tomar los datos de la interfaz y solicitarle al sercidor que los valide.
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }), //Parsear a JSON los datos del formulario
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al iniciar sesion");
  return data; // retornar el toquen de validacion nviado por el servidor
}

export async function register(username, password) {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.errors?.[0]?.msg || data.error || "Error al registrarse",
    );
  return data;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

export async function becomeAdmin(secret) {
  const res = await fetch("/api/auth/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}
