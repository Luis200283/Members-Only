import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import session from "express-session";
import passport from "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();

app.use(express.json()); //Middlewares()
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes); //Router()
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);

const isProd = process.env.NODE_ENV === "production";
console.log(`Modo de ejecución: ${isProd ? "Producción" : "Desarrollo"}`);
if (isProd) {
  const distPath = path.join(import.meta.dirname, "client/dist");
  app.use(express.static(distPath));
  app.get("/*splat", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  const vite = await createViteServer({
    root: path.join(import.meta.dirname, "client"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
