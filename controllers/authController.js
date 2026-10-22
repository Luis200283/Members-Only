import bcrypt from "bcryptjs";
import passport from "../config/passport.js";
import sql from "../db/neon.js";
import pool from "../db/pg.js";
import { closeStreamsForSession } from "./chatController.js";

async function joinGeneralRoom(userId) {
  try {
    await pool.query(
      `
        INSERT INTO conversation_members (conversation_id, user_id, role, last_read_message_id)
        SELECT c.id, $1, 'member',
               COALESCE((SELECT max(m.id) FROM messages m WHERE m.conversation_id = c.id), 0)
        FROM conversations c
        WHERE c.type = 'group' AND c.is_public = true AND c.title = 'general'
        ORDER BY c.id ASC
        LIMIT 1
        ON CONFLICT DO NOTHING
      `,
      [userId],
    );
  } catch (err) {
    console.error("No se pudo unir a general:", err.message);
  }
}

export async function register(req, res) {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (username, password)
      VALUES (${username}, ${hash})
      RETURNING id, username, "isAdmin", created_at
    `;
    await joinGeneralRoom(rows[0].id);
    req.login(rows[0], (err) => {
      if (err)
        return res.status(500).json({ error: "Error al iniciar sesión" });
      return res.status(201).json(rows[0]);
    });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "El usuario ya existe" });
    return res.status(500).json({ error: "Error al registrar" });
  }
}

export function login(req, res, next) {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info.message });
    req.login(user, (err2) => {
      if (err2) return next(err2);
      const { password, ...safeUser } = user;
      return res.json(safeUser);
    });
  })(req, res, next);
}

export function logout(req, res) {
  closeStreamsForSession(req.sessionID);
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Error al cerrar sesión" });
    return res.json({ ok: true });
  });
}

export function current(req, res) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  return res.json(req.user);
}

export async function becomeAdmin(req, res) {
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: "Clave incorrecta" });
  try {
    const rows = await sql`
       UPDATE users SET "isAdmin" = true
       WHERE id = ${req.user.id}
       RETURNING id, username, "isAdmin", created_at   
    `;
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: "Error al actualizar el rol" });
  }
}
