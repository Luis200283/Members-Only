import bcrypt from "bcryptjs";
import passport from "../config/passport.js";
import sql from "../db/neon.js";

export async function register(req, res) {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (username, password)
      VALUES (${username}, ${hash})
      RETURNING id, username, "isAdmin", created_at
    `;
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
