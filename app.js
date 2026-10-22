import path from "path";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import connectPgSimple from "connect-pg-simple";
import env from "./config/env.js";
import pool from "./db/pg.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import { sameOrigin } from "./middleware/sameOrigin.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

if (env.isProd) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    contentSecurityPolicy: env.isProd ? undefined : false,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PgStore = connectPgSimple(session);

const sessionStore = env.isTest
  ? new session.MemoryStore()
  : new PgStore({ pool, createTableIfMissing: true });

app.use(
  session({
    name: "members.sid",
    secret: env.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", sameOrigin);

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/chat", chatRoutes);

app.use("/api", notFound);

if (env.isProd) {
  const distPath = path.join(import.meta.dirname, "client/dist");
  app.use(express.static(distPath));
  app.get("/*splat", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else if (!env.isTest) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: path.join(import.meta.dirname, "client"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.use(errorHandler);

export default app;
