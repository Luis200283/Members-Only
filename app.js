import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const vite = await createViteServer({
  root: path.join(import.meta.dirname, "client"),
  server: { middlewareMode: true },
  appType: "spa",
});
app.use(vite.middlewares);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
