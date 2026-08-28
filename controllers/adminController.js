import sql from "../db/neon.js";

const sseClients = new Set();

//Crear transmicion de datos abiertta SSE(Server-Sent Event)

export async function streamAdminMessages(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 30000);

  sseClients.add(res); //agregar un cliente cada vez que alguien se conecte
  res.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

//Enviar el mesaje a todo los usuarios

function broadcast(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) client.write(payload);
}

// obtener los mensages de la BD

export async function getAdminMessages(req, res) {
  try {
    const rows = await sql`
            SELECT admin_messages.id, admin_messages.body, admin_messages.created_at, 
            users.username
            FROM admin_messages
            JOIN users ON admin_messages.user_id = users.id
            ORDER BY admin_messages.created_at ASC
        `;
    return res.json(rows);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error al obtener los mensajes de administración" });
  }
}

// crear mensaje nuevo

export async function createAdminMessage(req, res) {
  const { body } = req.body;
  try {
    const rows = await sql`
      INSERT INTO admin_messages (user_id, body)
      values (${req.user.id}, ${body})
      RETURNING id, body, created_at
    `;
    const msg = { ...rows[0], username: req.user.username };
    broadcast(msg);  //sincronizar el chat para todos 
    return res.status(201).json(rows[0]);
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Error al crear el mensaje de administración" });
  }
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
  }
  try {
    const rows = await sql`DELETE FROM users WHERE id = ${id} RETURNING id`;
    if (rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Error al eliminar el usuario" });
  }
}
