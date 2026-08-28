# Members-Only — Guía de configuración

App de posts en grupos privados.

- Backend: Node + Express
- Frontend: React + Vite + Tailwind
- Base de datos: Neon (PostgreSQL serverless)
- Auth: Passport + bcryptjs

## Contenido

1. [Instalación de dependencias](#paso-1--instalación-de-dependencias)
2. [Scaffolding del proyecto](#paso-2--scaffolding-del-proyecto)
3. [Configuración base (Vite + Tailwind + React)](#paso-3--configuración-base-vite--tailwind--react)
4. [Neon (base de datos en la nube)](#paso-4--neon-base-de-datos-en-la-nube)
5. [Express + Vite (servidor único, dev y prod)](#paso-5--express--vite-servidor-único-dev-y-prod)
6. [Autenticación con Passport (sesiones)](#paso-6--autenticación-con-passport-sesiones)
7. [Posts API + roles (admin)](#paso-7--posts-api--roles-admin)
8. [SSE en el chat de admins](#paso-8--sse-en-el-chat-de-admins)
9. [Anexo: flujo de sesión con Passport](#anexo--cómo-funciona-el-flujo-de-sesión-con-passport)

## Paso 1 — Instalación de dependencias

```
npm install react react-dom vite @vitejs/plugin-react @tailwindcss/vite
npm install @neondatabase/serverless bcryptjs dotenv express express-session
npm install express-validator passport passport-local
npm install react-router-dom
```

## Paso 2 — Scaffolding del proyecto



Crear las carpetas de manera automaticamente con el siguiente comando en el bash :

```bash
mkdir -p db client/src config controllers routes
```

Estructura esperada tras ejecutar el comando:

```
                                MODEL-VIEW-CONTROLLER (MVC)
Members-Only/
├── package.json 
├── package-lock.json        
├── .gitignore          
├── db/           → configuracion Neon DB           (MODELL)
├── client/       → app React + Vite + Tailwind     (VIEW)
│   └── src/      → (main.jsx, App.jsx, index.css)    ....
├── config/       → (configuracion de passport js)  (CONTROLLER)
├── controllers/  → (controladores de rutas)          ....
└── routes/       → (enrutadores para cada endpoint)  ....
```

## Paso 3 — Configuración base (Vite + Tailwind + React)
#### 1.   `client/vite.config.js`

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

### 2. `client/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Members Only</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="src/main.jsx"></script>
  </body>
</html>
```

### 3. `client/src/index.css` (activa Tailwind)

```css
@import "tailwindcss";
```

### 4. `client/src/main.jsx`

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

### 5. `client/src/App.jsx`

```jsx
function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-800">
      <h1 className="text-4xl font-bold bg-red-400 text-red-600 p-2 rounded-2xl">
        Members Only
      </h1>
    </div>
  );
}

export default App;
```

### 6. Probar que Tailwind y React funcionan

Desde la carpeta `client/`, ejecutar en el bash:

```bash
  npx vite
```

- Abrir http://localhost:5173 → se renderiza "Members Only" (React monta `App.jsx`).
Si las clases de Tailwind de `App.jsx` se aplican (fondo, color, centrado), Tailwind funciona.

- Probar el HMR: editar `client/src/App.jsx` (texto o clases) y guardar →
el navegador se actualiza al instante sin recargar.

- Para detener el servidor: `Ctrl + C`.

## Paso 4 — Neon (base de datos en la nube)

1. Crear proyecto desde https://console.neon.tech
2. Una vez creado el proyecto, ubicar la ruta de acceso desde el botón de `CONNECT`
3. Crear `.env` para la variable de entorno: `DATABASE_URL='postgresql://...'`
4. Crear un archivo `db/neon.js`:
   ```js
   import "dotenv/config";
   import { neon } from "@neondatabase/serverless";
   const sql = neon(process.env.DATABASE_URL);
   export default sql;
   ```
5. Crear un archivo de prueba `db/test.js`:

   ```js
   import sql from "./neon.js";

   const result = await sql`SELECT version()`;
   const { version } = result[0];

   console.log("Conenctado a Neon implementando:", version);
   ```

6. Ejecutar en la consola para iniciar la prueba:
   ```
   node db/test.js
   ```
   Debe verse `Conectado a Neon implementando: PostgreSQL ...`.

## Paso 5 — Express + Vite (servidor único, dev y prod)

Un solo servidor en el puerto 3000. Express detecta el entorno con `NODE_ENV`:

- **Dev** (`NODE_ENV` no es `production`): inyecta Vite como middleware → React con **HMR**.
- **Prod** (`NODE_ENV=production`): sirve el build estático `client/dist` con **fallback SPA**
  (`/*splat`) para que las rutas de `react-router-dom` funcionen.

### `app.js` (final, con ambas ramas)

```js
import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const isProd = process.env.NODE_ENV === "production";

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
```

### Probar en dev (HMR)

```bash
node app.js
```
Abrir http://localhost:3000 → React se renderiza con estilos de Tailwind. Editar
`client/src/App.jsx` y el navegador se actualiza sin recargar.

### Probar en prod

```bash
cd client && npx vite build && cd ..
NODE_ENV=production node app.js
```
Abrir http://localhost:3000 → se sirve el build de React. El fallback `/*splat` responde con
`index.html` para rutas como `/login`.

### Notas

- **No** ejecutar `npx vite` por separado junto a `node app.js`: chocan en el puerto del
  WebSocket de HMR (24678). Con esta arquitectura Vite vive dentro de Express.
- En **Express 5** el comodín de ruta es `/*splat` (con `*` a secas rompe).

Estructura del proyecto:

```
Members-Only/
├── app.js        → servidor Express (dev + prod)
├── .env          → credenciales (gitignored)
├── .env.example  → plantilla de variables
├── db/
│   ├── neon.js   → cliente de la DB
│   ├── schema.js → crea las tablas (1 sola vez)
│   └── test.js   → prueba de conexión
├── client/       → app React + Vite + Tailwind
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/       → auth.js, posts.js (fetch helpers)
│       └── component/ → Login, Register, PostList, PostForm
├── config/       → passport.js
├── controllers/  → authController, postController, adminController
├── middleware/   → auth.js (requireAuth/requireAdmin), validate.js
└── routes/       → authRoutes, postRoutes, adminRoutes
```

## Paso 6 — Autenticación con Passport (sesiones)

Objetivo: que la API valide credenciales, cree la sesión y la recupere en cada petición.
Piezas: esquema de BD, `config/passport.js`, `controllers/authController.js`,
`routes/authRoutes.js` y el middleware en `app.js`.

### 1. Esquema de la base de datos — `db/schema.js`

Crea las tablas `users` y `posts`. `posts.user_id` es **clave foránea**
(`REFERENCES users(id)`): cada post pertenece a un usuario. `ON DELETE CASCADE` borra los
posts automáticamente si se elimina el usuario.

```js
import sql from "./neon.js";

await sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('users', 'posts')
`;
console.log("Tablas creadas:", tables.map((t) => t.table_name).join(", "));
```

> `information_schema.tables` es una **vista de sistema** de PostgreSQL que describe qué
> tablas existen. `table_name` es una **columna** de esa vista, no un placeholder. La query
> solo verifica que `users` y `posts` se hayan creado.

Ejecutar una sola vez:
```bash
node db/schema.js
```

### 2. Estrategia y sesiones — `config/passport.js`

Registra la estrategia `local` con `passport.use()` y define cómo guardar/recuperar el
usuario en la sesión (`serializeUser` / `deserializeUser`).

```js
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import sql from "../db/neon.js";

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
      if (rows.length === 0) return done(null, false, { message: "Usuario no encontrado" });
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return done(null, false, { message: "Contraseña incorrecta" });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }),
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const rows = await sql`SELECT id, username, created_at FROM users WHERE id = ${id}`;
    done(null, rows[0] || null);
  } catch (err) {
    done(err);
  }
});

export default passport;
```

### 3. Controlador de autenticación — `controllers/authController.js`

```js
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
      RETURNING id, username, created_at
    `;
    req.login(rows[0], (err) => {
      if (err) return res.status(500).json({ error: "Error al iniciar sesión" });
      return res.status(201).json(rows[0]);
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "El usuario ya existe" });
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
```

### 4. Rutas — `routes/authRoutes.js`

```js
import { Router } from "express";
import { register, login, logout, current } from "../controllers/authController.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", current);

export default router;
```

### 5. Middleware en `app.js`

Añadir los imports y, **después** de `express.urlencoded(...)` pero **antes** del bloque
`if (isProd)`:

```js
import session from "express-session";
import passport from "./config/passport.js";
import authRoutes from "./routes/authRoutes.js";
```

```js
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
```

> **El orden importa**: sesión → passport → rutas. Las rutas `/api/*` van **antes** del
> bloque Vite/static para no caer en el fallback SPA.

### 6. Variables de entorno

Añadir a `.env`:
```
SESSION_SECRET='cadena-larga-y-secreta'
```
Crear `.env.example` (el `.env` real está gitignoreado) con las claves pero sin valores:
```
DATABASE_URL='postgresql://...'
SESSION_SECRET='cambia-esto'
```

### 7. Verificación

```bash
node db/schema.js          # tablas users + posts
node app.js                # servidor en dev
```

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -d '{"username":"luis","password":"1234"}'
curl -b cookies.txt http://localhost:3000/api/auth/me      # 200 + usuario
curl -b cookies.txt -X POST http://localhost:3000/api/auth/logout
curl -b cookies.txt http://localhost:3000/api/auth/me      # 401
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -d '{"username":"luis","password":"1234"}'
# → 409 "El usuario ya existe"
```

---

## Paso 7 — Posts API + roles (admin)

Tres tipos de usuario: **invitado** (sin sesión), **user** (logueado) y **admin**
(columna `"isAdmin"` en `users`). Reglas:
- Cualquiera puede **leer** el feed, pero los invitados NO ven el autor (anónimo).
- Solo logueados pueden **crear** posts.
- Cada quien edita/borra **sus** posts; el admin puede borrar **cualquier** post y **usuario**.
- Un usuario logueado se vuelve admin con la **clave secreta** (`POST /api/auth/admin`).
- Los admins tienen un **chat privado** (`admin_messages`).

> ⚠️ En PostgreSQL los identificadores sin comillas se convierten a minúsculas. Para que la
> columna se llame `isAdmin` (y aparezca igual en JS), se escribe siempre **entre comillas**
> en SQL: `"isAdmin"`.

### 1. Schema — `db/schema.js` (re-ejecutable)

Añade `"isAdmin"` a `users` (con `ALTER ... IF NOT EXISTS`, porque la tabla ya existe) y la
tabla `admin_messages`:

```js
await sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;

await sql`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false
`;

await sql`
  CREATE TABLE IF NOT EXISTS admin_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  )
`;
```

`.env`: `ADMIN_SECRET='tu-clave-secreta-del-club'` (+ `.env.example`).

### 2. Middlewares — `middleware/auth.js` y `middleware/validate.js`

```js
// middleware/auth.js
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  return next();
}
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "No autenticado" });
  if (!req.user.isAdmin)
    return res.status(403).json({ error: "Se requieren privilegios de admin" });
  return next();
}
```

```js
// middleware/validate.js
import { validationResult } from "express-validator";
export function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
}
```

### 3. `config/passport.js` — incluir `"isAdmin"` en `deserializeUser`

```js
passport.deserializeUser(async (id, done) => {
  try {
    const rows = await sql`SELECT id, username, "isAdmin", created_at FROM users WHERE id = ${id}`;
    done(null, rows[0] || null);
  } catch (error) {
    done(error);
  }
});
```

### 4. `controllers/authController.js` — `becomeAdmin`

```js
export async function becomeAdmin(req, res) {
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ error: "Clave incorrecta" });
  const rows = await sql`
    UPDATE users SET "isAdmin" = true
    WHERE id = ${req.user.id}
    RETURNING id, username, "isAdmin", created_at
  `;
  return res.json(rows[0]);
}
```
> El flag queda **persistido en la DB**: en la siguiente petición `deserializeUser` ya carga
> `isAdmin: true` en `req.user`.

### 5. `controllers/postController.js`

- `getPosts`/`getPost`: `JOIN users`; si `!req.user` se quita el autor del resultado
  (`rows.map(({ user_id, username, ...post }) => post)`).
- `createPost`: `INSERT ... RETURNING id, title, body, created_at` con `req.user.id`.
- `updatePost`: `UPDATE ... WHERE id = ${id} AND user_id = ${req.user.id}` (solo dueño).
- `deletePost`: `DELETE ... WHERE id = ${id} AND (user_id = ${req.user.id} OR ${req.user.isAdmin})`.

### 6. `controllers/adminController.js`

- `getAdminMessages`/`createAdminMessage`: chat privado sobre `admin_messages`.
- `deleteUser`: `DELETE FROM users WHERE id = ${id}` (CASCADE borra sus posts y mensajes);
  impide borrarse a sí mismo (400).

### 7. Rutas y montaje

```js
// routes/authRoutes.js — register con validación + /admin
router.post("/register",
  body("username").trim().isLength({ min: 3, max: 30 }).withMessage("El usuario debe tener entre 3 y 30 caracteres"),
  body("password").isLength({ min: 6 }).withMessage("La contraseña debe tener al menos 6 caracteres"),
  handleValidation,
  register
);
router.post("/admin", requireAuth, body("secret").trim().notEmpty(), handleValidation, becomeAdmin);
```

```js
// routes/postRoutes.js
const postRules = [
  body("title").trim().notEmpty().withMessage("El título es obligatorio")
    .isLength({ max: 200 }).withMessage("El título no puede superar 200 caracteres"),
  body("body").trim().notEmpty().withMessage("El contenido es obligatorio"),
];
router.get("/", getPosts);
router.get("/:id", getPost);
router.post("/", requireAuth, postRules, handleValidation, createPost);
router.put("/:id", requireAuth, postRules, handleValidation, updatePost);
router.delete("/:id", requireAuth, deletePost);
```

```js
// routes/adminRoutes.js (todo con requireAdmin)
router.get("/messages", requireAdmin, getAdminMessages);
router.post("/messages", requireAdmin, body("body").trim().notEmpty(), handleValidation, createAdminMessage);
router.delete("/users/:id", requireAdmin, deleteUser);
```

```js
// app.js
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/admin", adminRoutes);
```

### 8. Verificación

```bash
node db/schema.js   # admin_messages, posts, users
# feed anónimo → posts sin autor · feed logueado → con autor
# POST /api/posts sin sesión → 401 · título vacío → 400
# POST /api/auth/admin clave mala → 403 · buena → "isAdmin": true
# chat /api/admin/messages: user → 403 · admin → 200
# DELETE /api/admin/users/:id → borra usuario y sus posts (cascade)
```

---

## Paso 8 — SSE en el chat de admins

**Server-Sent Events** permite que el servidor **empuje** datos al navegador por una única
conexión HTTP que queda abierta. Ideal para chat/notificaciones (unidireccional servidor→cliente).

```
Cliente                        Servidor
   │  EventSource("/api/admin/messages/stream")   ← abre conexión
   │───────────────────────────────────────────►  (queda abierta)
   │                                              res.writeHead(200, "text/event-stream")
   │  data: {"id":3,"body":"hola","username":"luis"}\n\n   ← push cuando hay mensaje
   │◄────────────────────────────────────────────
   │  onmessage → agrega el mensaje al estado     (sin polling)
```

### Backend — `controllers/adminController.js`

```js
const sseClients = new Set();   // clientes conectados (en memoria)

export async function streamAdminMessages(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 30000); // latido
  sseClients.add(res);
  res.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

function broadcast(message) {
  const payload = `data: ${JSON.stringify(message)}\n\n`;
  for (const client of sseClients) client.write(payload);
}

// en createAdminMessage, tras el INSERT:
const msg = { ...rows[0], username: req.user.username };
broadcast(msg);
```

```js
// routes/adminRoutes.js
router.get("/messages/stream", requireAdmin, streamAdminMessages);
```

### Frontend — `client/src/api/admin.js` y `AdminChat.jsx`

```js
export function streamAdminMessages(onMessage) {
  const source = new EventSource("/api/admin/messages/stream");
  source.onmessage = (event) => onMessage(JSON.parse(event.data));
  return source;
}
```

```jsx
useEffect(() => {
  load();                                      // historial inicial (GET normal)
  const source = streamAdminMessages((msg) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg], // sin duplicados
    );
  });
  return () => source.close();                 // limpiar al desmontar
}, []);
```

### Claves de SSE

- Formato de cada evento: `data: <json>\n\n` (termina en **línea en blanco**).
- `res.flushHeaders()` envía los headers de inmediato (sin esperar el primer write).
- **Heartbeat** (`: ping\n\n`): comentario que mantiene viva la conexión frente a proxies.
- `EventSource` **se reconecta solo** al caerse; la cookie de sesión viaja (same-origin), así que
  `requireAdmin` funciona en el stream.
- El broadcast es en memoria: si el servidor se reinicia, al reconectarse se recarga el historial
  de la DB → sin pérdida de mensajes.
- Probar con curl: `curl -N http://localhost:3000/api/admin/messages/stream` (queda "colgado").
- Comparativa: **polling** (pregunta cada N s → peticiones inútiles) · **SSE** (push una vía,
  ideal chat/notificaciones) · **WebSocket** (bidireccional, más complejo, para juegos/colab).

---

## Anexo — Cómo funciona el flujo de sesión con Passport

Referencia rápida para reproducir el patrón en futuros proyectos.

### Diagrama 1 — Flujo de login (cadena de llamadas en orden)

```
NAVEGADOR
   │  POST /api/auth/login   {username, password}
   ▼
app.js ──► express.json()          → req.body = {username, password}
   ▼
app.js ──► express-session()       → crea req.session
   ▼
app.js ──► passport.initialize() + passport.session()
   ▼
app.js ──► app.use("/api/auth", authRoutes)
   ▼
routes/authRoutes.js ──► router.post("/login", login)
   ▼
authController.js ──► login(req, res, next)
   ▼
passport.authenticate("local", callback)(req, res, next)
   │        Passport ejecuta la estrategia registrada con passport.use()
   ▼
config/passport.js ──► LocalStrategy(username, password, done)
   │
   ├─ 1. sql`SELECT * FROM users WHERE username = ${username}`  →  NEON
   │         · no existe fila → done(null, false, {message: "Usuario no encontrado"})
   │
   ├─ 2. bcrypt.compare(password, user.password)   → compara con el hash guardado
   │         · no coincide    → done(null, false, {message: "Contraseña incorrecta"})
   │
   └─ 3. done(null, user)   → credenciales correctas
              │
   (Passport invoca el callback del controlador con err, user, info)
              ▼
authController.js (callback de authenticate)
   ├─ user === false → res.status(401).json({error: info.message})
   └─ user válido    → req.login(user, cb)
              │
              ▼
Passport ──► serializeUser(user)  → done(null, user.id)   ← guarda SOLO el id
              │
              ▼
express-session ──► guarda {passport: {user: <id>}} en el MemoryStore
                    y envía la cookie connect.sid al navegador
              │
              ▼
authController ──► res.json(user)   → HTTP 200
```

### Diagrama 2 — ¿Dónde vive la sesión?

`express-session` por defecto usa **MemoryStore**: un objeto en memoria del proceso Node.
El navegador solo guarda el **ID** de la sesión en la cookie `connect.sid`.

```
   Servidor (memoria del proceso Node)              Navegador
┌──────────────────────────────────────┐        ┌─────────────────────┐
│  MemoryStore (express-session)       │        │  Cookies            │
│  ┌────────────────────────────────┐  │        │  connect.sid=abc123 │
│  │  "abc123..." → {              │  │◄───────│                     │
│  │    passport: { user: 7 }      │  │        │  solo viaja el ID   │
│  │  }                            │  │        └─────────────────────┘
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
     los datos de la sesión viven aquí
```

> ⚠️ MemoryStore se borra al reiniciar el servidor (las sesiones se pierden). Para prod se
> usa un store persistente (ej. `connect-pg-simple`, que guarda sesiones en Postgres).

### Diagrama 3 — Recuperación de la sesión (peticiones siguientes)

```
NAVEGADOR
   │  GET /api/auth/me   (la cookie connect.sid viaja automáticamente)
   ▼
express-session ──► lee la cookie → busca "abc123" en MemoryStore
                    → req.session = {passport: {user: 7}}
   ▼
passport.session() ──► lee req.session.passport.user (= 7)
                    → llama a passport.deserializeUser(7)
   ▼
config/passport.js ──► deserializeUser(id)
                    → sql`SELECT id, username, created_at FROM users WHERE id = ${7}`  →  NEON
                    → done(null, user)
   ▼
Passport ──► attacha req.user = {id: 7, username, created_at}
   ▼
authController.current() ──► si req.user existe → res.json(req.user)   → 200
                             si no              → res.status(401).json(...)
```

### Resumen del ciclo y para qué sirve `current()`

| Momento | Qué pasa |
|---|---|
| **login** | `serializeUser` guarda el **id** del usuario en la sesión |
| **cada petición** | `passport.session()` lee el id → `deserializeUser` → `req.user` |
| **current()** | devuelve `req.user` (200) o 401 → el front sabe si hay sesión sin re-loguear |

`current()` (ruta `GET /api/auth/me`) es el "¿quién soy yo?" de la app: cuando el front
React carga (recarga de página), no sabe si hay sesión; lo pregunta a `current()`. Si
responde 200 con el usuario, muestra la app logueada; si responde 401, muestra Login.
