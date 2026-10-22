const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function deny(res) {
  return res.status(403).json({ error: "Origen no permitido" });
}

export function sameOrigin(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const origin = req.get("origin");
  if (!origin) return next();

  const expected = `${req.protocol}://${req.get("host")}`;
  let requestOrigin;

  try {
    requestOrigin = new URL(expected).origin;
  } catch {
    return deny(res);
  }

  let receivedOrigin;

  try {
    receivedOrigin = new URL(origin).origin;
  } catch {
    return deny(res);
  }

  if (receivedOrigin !== requestOrigin) return deny(res);

  return next();
}
