import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import sql from "../db/neon.js";

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (rows.length === 0)
        return done(null, false, { message: "Usuario no encontrado" });
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid)
        return done(null, false, { message: "Contraseña incorrecta" });
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }),
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const rows =
      await sql`SELECT id, username, "isAdmin", created_at FROM users WHERE id = ${id} `;
    done(null, rows[0] || null);
  } catch (error) {
    done(error);
  }
});

export default passport;
