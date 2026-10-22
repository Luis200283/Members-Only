export function notFound(req, res) {
  return res.status(404).json({ error: "Ruta no encontrada" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = Number.isInteger(err.status) ? err.status : 500;

  if (status >= 500) {
    console.error(err);
  }

  const message =
    status >= 500
      ? "Error interno del servidor"
      : err.message || "Solicitud inválida";

  return res.status(status).json({ error: message });
}
