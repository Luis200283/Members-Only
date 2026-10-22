import app from "./app.js";
import env from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`Servidor en http://localhost:${env.port}`);
});

let closing = false;

function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`Recibido ${signal}, cerrando servidor...`);

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
