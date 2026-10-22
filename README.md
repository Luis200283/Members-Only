# Members-Only — Guía de configuración

App de posts en grupos privados, con **chat privado 1:1 y en grupo** en tiempo real.

- Backend: Node + Express 5
- Frontend: React 19 + Vite + Tailwind v4
- Base de datos: PostgreSQL (Neon) — `@neondatabase/serverless` para auth/posts y `pg` para sesiones/chat
- Auth: Passport + bcryptjs
- Tiempo real: Server-Sent Events (SSE)
- Tests: Vitest + Supertest

> **Estado actual del proyecto: rama `refactor/chat-v1`.**
> Los pasos 1-8 conservan el recorrido histórico de construcción (algunos fragmentos muestran
> versiones incrementales). El estado final —`app.js` + `server.js`, sesiones en Postgres,
> hardening, chat privado y tests— está en el **[Paso 9](#paso-9--chat-privado-hardening-y-tests)**.

## Contenido

1. [Instalación de dependencias](#paso-1--instalación-de-dependencias)
2. [Scaffolding del proyecto](#paso-2--scaffolding-del-proyecto)
3. [Configuración base (Vite + Tailwind + React)](#paso-3--configuración-base-vite--tailwind--react)
4. [Neon (base de datos en la nube)](#paso-4--neon-base-de-datos-en-la-nube)
5. [Express + Vite (servidor único, dev y prod)](#paso-5--express--vite-servidor-único-dev-y-prod)
6. [Autenticación con Passport (sesiones)](#paso-6--autenticación-con-passport-sesiones)
7. [Posts API + roles (admin)](#paso-7--posts-api--roles-admin)
8. [SSE en el chat de admins](#paso-8--sse-en-el-chat-de-admins)
9. [Chat privado, hardening y tests](#paso-9--chat-privado-hardening-y-tests)
10. [Anexo: flujo de sesión con Passport](#anexo--cómo-funciona-el-flujo-de-sesión-con-passport)

## Inicio rápido (estado actual)

```bash
npm install
npm run db:migrate   # crea/actualiza las tablas (incluye el chat)
npm run dev          # http://localhost:3000 (Express + Vite middleware)
```

`.env` (no está en git):

```bash
DATABASE_URL='postgresql://usuario:password@host/dbname?sslmode=require'
SESSION_SECRET='cadena-larga-y-secreta'
ADMIN_SECRET='clave-del-club-de-admins'
```

Otros comandos:

```bash
npm run build        # build de React en client/dist
npm start            # producción: NODE_ENV=production node server.js (requiere build)
npm test             # migraciones + tests de integración (Vitest + Supertest)
npm run test:watch   # tests en modo watch
```

## Paso 1 — Instalación de dependencias

Dependencias del estado actual:

```bash
# Frontend
npm install react react-dom react-router-dom vite @vitejs/plugin-react @tailwindcss/vite

# Backend
npm install express express-session express-validator passport passport-local
npm install bcryptjs dotenv @neondatabase/serverless
npm install pg connect-pg-simple helmet express-rate-limit

# Tests
npm install -D vitest supertest
```

> Las dependencias de la fase inicial (`browser-sync`, `nodeom`, `npm-run-all`) se eliminaron
> para dejar `npm audit` en 0 vulnerabilidades.

## Paso 2 — Scaffolding del proyecto



Crear las carpetas de manera automaticamente con el siguiente comando en el bash :

```bash
mkdir -p db client/src config controllers middleware routes test
mkdir -p db/migrations client/src/api client/src/component/chat client/src/hooks
```

Estructura esperada tras ejecutar el comando:

```
                                MODEL-VIEW-CONTROLLER (MVC)
Members-Only/
├── package.json
├── package-lock.json
├── .gitignore
├── .env                  → credenciales (gitignored)
├── .env.example          → plantilla de variables
├── app.js                → app Express (testeable, sin listen)
├── server.js             → listen + cierre ordenado
├── config/               → env.js, passport.js
├── db/                   → neon.js, pg.js, migrate.js, migrations/, schema.js
├── controllers/          → auth, post, admin, chat
├── middleware/           → auth, validate, errorHandler, rateLimiters, sameOrigin
├── routes/               → auth, post, admin, chat
├── test/                 → tests de integración
├── vitest.config.js
└── client/               → app React + Vite + Tailwind
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── api/          → auth.js, posts.js, admin.js, chat.js
        ├── hooks/        → useChatStream.js
        └── component/    → Login, Register, PostList, PostForm, AdminChat
            └── chat/     → ChatPage, ConversationList, ChatWindow,
                            MessageComposer, NewConversationModal
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

> ⚠️ **Nota de estado:** este paso muestra la versión **base** del servidor único. El
> `app.js` actual (sesión persistente, Helmet, rate limit, same-origin, rutas de chat y
> separación `app.js`/`server.js`) está en el **[Paso 9](#paso-9--chat-privado-hardening-y-tests)**.

### `app.js` (versión base, con ambas ramas)

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

### Probar en dev (HMR) — estado actual

```bash
npm run dev          # ejecuta node server.js
```
Abrir http://localhost:3000 → React se renderiza con estilos de Tailwind. Editar
`client/src/App.jsx` y el navegador se actualiza sin recargar. Los cambios de **backend**
requieren reiniciar el proceso (no hay nodemon).

### Probar en prod

```bash
npm run build        # cd client && vite build
npm start            # NODE_ENV=production node server.js
```
Abrir http://localhost:3000 → se sirve el build de React. El fallback `/*splat` responde con
`index.html` para rutas como `/login` o `/chat`.

> En producción la cookie de sesión es `secure` (solo HTTPS). Si pruebas `npm start` en
> `http://localhost`, el navegador no guardará la cookie y el login no persistirá.
> Para desarrollo usa `npm run dev`; para producción real, sirve la app detrás de HTTPS.

### Notas

- **No** ejecutar `npx vite` por separado junto a `node server.js`: chocan en el puerto del
  WebSocket de HMR (24678). Con esta arquitectura Vite vive dentro de Express.
- En **Express 5** el comodín de ruta es `/*splat` (con `*` a secas rompe).

Estructura actual del proyecto:

```text
Members-Only/
├── app.js          → app Express (sin listen) + Vite middleware
├── server.js       → listen + cierre ordenado
├── .env            → credenciales (gitignored)
├── .env.example    → plantilla de variables
├── db/
│   ├── neon.js     → cliente Neon (auth/posts/admin)
│   ├── pg.js       → Pool de pg (sesiones/chat) + parser BIGINT
│   ├── migrate.js  → runner de migraciones
│   ├── migrations/ → 001_chat.sql
│   ├── schema.js   → tablas base (script histórico)
│   └── test.js     → prueba de conexión
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── api/        → auth.js, posts.js, admin.js, chat.js
│       ├── hooks/      → useChatStream.js
│       └── component/  → Login, Register, PostList, PostForm, AdminChat
│           └── chat/   → ChatPage, ConversationList, ChatWindow,
│                         MessageComposer, NewConversationModal
├── config/         → env.js, passport.js
├── controllers/    → authController, postController, adminController, chatController
├── middleware/     → auth.js, validate.js, errorHandler.js, rateLimiters.js, sameOrigin.js
├── routes/         → authRoutes, postRoutes, adminRoutes, chatRoutes
├── test/           → chat.test.js
└── vitest.config.js
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
>
> La configuración actual de la sesión (store en Postgres con `connect-pg-simple`, cookie
> `members.sid`, `trust proxy` y Helmet) está en el **[Paso 9](#paso-9--chat-privado-hardening-y-tests)**.

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
node db/schema.js          # tablas base (script histórico)
npm run db:migrate         # migraciones actuales (incluye chat)
npm run dev                # servidor en dev (server.js)
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
node db/schema.js   # admin_messages, posts, users (script histórico)
# feed anónimo → posts sin autor · feed logueado → con autor
# POST /api/posts sin sesión → 401 · título vacío → 400
# POST /api/auth/admin clave mala → 403 · buena → "isAdmin": true
# chat /api/admin/messages: user → 403 · admin → 200
# DELETE /api/admin/users/:id → borra usuario y sus posts (cascade)
```

> El chat de admins (`/api/admin/messages`) convive con el chat privado nuevo
> (`/api/chat/*`). El primero sigue siendo exclusivo de admins; el segundo es para cualquier
> usuario logueado.

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

#### Flujo de `streamAdminMessages` (paso a paso)

```
Petición: GET /api/admin/messages/stream  (ya pasó requireAdmin → req.user existe)
   │
   ▼
┌─ PASO 1: res.writeHead(200, {...}) ────────────────────────────────────┐
│  "Elijo qué tipo de respuesta seré" — solo guarda los headers en el    │
│  buffer, NO los envía todavía.                                         │
│  · Content-Type: text/event-stream → le dice al navegador: "esto es    │
│    un SSE; espérame y te empujaré eventos" (sin esto, EventSource no   │
│    funciona).                                                          │
│  · Cache-Control: no-cache → para que ni proxies ni el navegador       │
│    guarden esta respuesta (un stream NO se puede cachear).             │
│  · Connection: keep-alive → "no cierres el cable, seguiré enviando".   │
└────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─ PASO 2: res.flushHeaders() ───────────────────────────────────────────┐
│  "Despego ahora": saca los headers del buffer y los manda al navegador │
│  SIN esperar al primer evento. Si no lo hicieras, los headers          │
│  viajarían junto al primer write() — que puede tardar minutos → el     │
│  navegador no sabría que es un SSE y onopen no se dispararía.          │
└────────────────────────────────────────────────────────────────────────┘
   │  El navegador recibe Content-Type → EventSource dispara "onopen"
   ▼
┌─ PASO 3: heartbeat = setInterval(write(": ping\n\n"), 30000) ──────────┐
│  "Un vigilante que cada 30 s manda un comentario vacío".               │
│  · ": ping\n\n" es un COMENTARIO del protocolo SSE (empieza con ":")   │
│    — el navegador lo ignora.                                           │
│  · Por qué: proxies/balanceadores (o Render) matan conexiones que      │
│    están "inactivas". El ping las mantiene "vivas" ante esas capas.    │
└────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─ PASO 4: sseClients.add(res) ──────────────────────────────────────────┐
│  "Registro este cliente en la lista de conexiones vivas".              │
│  sseClients es un Set() de objetos `res` (uno por admin conectado).    │
│  Cuando alguien hace POST, broadcast() recorre este Set y escribe      │
│  "data: {...}" en cada `res` → así TODOS reciben el mensaje.           │
└────────────────────────────────────────────────────────────────────────┘
   │
   ▼
┌─ PASO 5: res.on("close", limpiar) ─────────────────────────────────────┐
│  "Cuando el navegador cierre (recarga, cierra pestaña, cae la red):"   │
│  · clearInterval(heartbeat) → deja de mandar pings a un muerto.        │
│  · sseClients.delete(res) → lo saca del Set para que broadcast no      │
│    intente escribirle a una conexión cerrada (evita errores y fugas).  │
└────────────────────────────────────────────────────────────────────────┘
   │
   ▼
La función RETORNA — pero la conexión queda "colgada": el socket sigue
abierto y cada broadcast futuro escribirá sobre `res`.
```

#### Glosario de términos

- **"Colgada" / "conexión colgada"** — La petición HTTP **nunca se cierra** (no se
  llama `res.end()`). El navegador abre el cable y lo deja a la espera de más datos. Es
  la esencia de SSE.
- **Buffer** — Zona de memoria donde Node acumula datos antes de enviarlos. Node
  bufferiza la respuesta: headers + primer trozo de body salen **juntos** en el primer
  `write()`. Por eso `writeHead()` por sí solo no manda nada; `flushHeaders()` vacía el
  buffer enviando solo los headers.
- **Heartbeat (latido)** — Mensaje periódico que mantiene viva la conexión. En SSE se
  usa un comentario (`: ping\n\n`), que el protocolo define para ignorarse en el
  cliente. Evita que proxies/balanceadores corten conexiones que crean inactivas.
- **`new Set()`** — Colección de JS que guarda **valores únicos** (sin duplicados).
  Operaciones en O(1): `add`/`delete`, e iterable con `for...of` (lo que usa `broadcast`).
  Aquí guarda objetos `res`, uno por admin conectado → "la lista de clientes vivos".
- **`res`** — El objeto de respuesta HTTP de esa petición. Cada conexión SSE tiene **su
  propio `res`**: escribir en él manda datos a **ese** navegador. Guardarlos en el `Set`
  permite recordar todos los clientes para escribirles cuando haya un mensaje nuevo.

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

#### Ciclo de vida del `useEffect` (con `[]`)

```
PRIMER RENDER del componente AdminChat
   │
   ▼
useEffect con [] → se ejecuta UNA vez, después del render
   │
   ├─ (1) load()
   │        fetch GET /api/admin/messages   → historial   → setMessages(historial)
   │
   ├─ (2) streamAdminMessages(callback)
   │        crea EventSource("/api/admin/messages/stream")
   │        source.onmessage = callback        ← registrar el "escuchador"
   │        devuelve `source` (guardado en la variable local)
   │
   ├─ (3) return () => source.close()
   │        NO se ejecuta ahora: es la función de LIMPIEZA,
   │        React la guarda para usarla después.
   │
   ▼
   El componente sigue vivo. Cada vez que llega un evento SSE:
      source.onmessage(callback)  ← se ejecuta el MISMO callback (closure)
   │       └─ setMessages(prev => ...)   → re-render con el mensaje nuevo
   │
   (esto pasa miles de veces, pero el useEffect NO se re-ejecuta,
    porque la conexión ya quedó abierta una vez)
   │
   ▼
El usuario sale del chat / navega a otra ruta
   ▼
React DESMONTA el componente → ejecuta la limpieza:
   return () => source.close();   ← cierra el EventSource (corta la conexión)
```

> Con `[]`, la función corre **una sola vez** tras el primer render. Si pusieras `[messages]`,
> se re-ejecutaría en cada cambio → abrirías un `EventSource` nuevo por mensaje (conexiones
> duplicadas/fugas). El cleanup cierra la conexión al desmontar para no dejar streams colgados.

#### `setMessages(prev => ...)` — actualización funcional y append idempotente

```
¿Por qué `prev` siempre ve el estado más reciente?

useState acepta un valor directo o una función. Con función (updater),
React la ejecuta AL PROCESAR la actualización y le pasa `prev` = el estado
en ese momento (no el que capturó tu closure).

SIN función (bug de stale state): si dos eventos SSE llegan antes de un
re-render, ambos usan el MISMO `messages` viejo → el primero se pierde.
   evento A → setMessages([...messages, A])  → usa messages=[] → [A]
   evento B → setMessages([...messages, B])  → sigue viendo [] → [B]  ❌ A se perdió

CON función (recomendado): React encadena los updates; cada `prev` es el
resultado del anterior.
   evento A → setMessages(prev => [...prev, A]) → prev=[] → [A]
   evento B → setMessages(prev => [...prev, B]) → prev=[A] → [A, B]  ✓
```

```js
prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
```

- `prev` = estado actual de `messages` (un array de mensajes).
- `.some(fn)` → `true` si **al menos un elemento** cumple la condición; se detiene en el
  primero. Aquí pregunta: **"¿ya existe un mensaje con este `id`?"**.
- Si **SÍ** → devuelve `prev` tal cual (misma referencia → React **no re-renderiza**, y no
  se duplica el mensaje).
- Si **NO** → devuelve `[...prev, msg]`: copia todo lo anterior y agrega `msg` al final
  (array nuevo → React re-renderiza).

**Idempotente** = aplicar el mismo evento 2 veces no duplica: la 2ª vez `.some` da `true`.
Útil para la carrera entre el historial (`load()`) y un evento SSE que llegue justo después.

#### Flujo completo de SSE

**A) Abrir la conexión (sucede 1 vez):**

```
NAVEGADOR (AdminChat)
   │  new EventSource("/api/admin/messages/stream")
   │  (GET con la cookie de sesión, same-origin)
   ▼
app.js ──► express-session + passport.session()      → req.user (es admin)
   ▼
app.js ──► app.use("/api/admin", adminRoutes)
   ▼
routes/adminRoutes.js ──► router.get("/messages/stream", requireAdmin, streamAdminMessages)
   ▼
middleware requireAdmin ──► !req.user → 401 · !req.user.isAdmin → 403
   ▼
adminController.streamAdminMessages(req, res)   (headers SSE + flushHeaders + heartbeat + add al Set)
   ▼
   ╔══════════════════════════════════════════════════════╗
   ║  CONEXIÓN ABIERTA — el servidor ya NO responde:       ║
   ║  se queda "colgado" esperando para empujar eventos.   ║
   ╚══════════════════════════════════════════════════════╝
```

**B) Empujar un mensaje nuevo (cada mensaje):**

```
Cualquier admin (p. ej. otro AdminChat abierto)
   │  POST /api/admin/messages   {body: "hola"}
   ▼
routes/adminRoutes.js ──► router.post("/messages", requireAdmin, handleValidation, createAdminMessage)
   ▼
adminController.createAdminMessage
   ├─ INSERT INTO admin_messages (user_id, body) VALUES (...) RETURNING ...   →  NEON
   ├─ msg = { ...rows[0], username: req.user.username }    ← se añade el autor
   ├─ broadcast(msg)      ← recorre el Set sseClients
   │     for (const client of sseClients) client.write(`data: ${JSON.stringify(msg)}\n\n`)
   │           ├─► cliente A (conexión abierta)  → recibe "data: {...}\n\n"
   │           └─► cliente B (el remitente)      → también recibe su propio mensaje
   └─ res.status(201).json(rows[0])    ← responde el POST normal (no bloquea)
   ▼
NAVEGADOR A (AdminChat)
   │  EventSource.onmessage = (event) => ...   → event.data = "{...}"
   │  setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
   ▼
   React re-renderiza → el mensaje aparece al instante en TODOS los admins conectados
```

**C) Formato del evento (lo que viaja por la conexión):**

```
data: {"id":3,"body":"hola","username":"luis"}\n
\n
: ping\n\n          ← comentario (heartbeat); EventSource lo ignora
```

- Cada evento real: `data: <json>` + **línea en blanco** (eso delimita el evento).
- `: ping\n\n` es un **comentario** que se envía cada 30 s para que proxies/balanceadores no
  maten la conexión inactiva. El navegador lo descarta.

**D) Ciclo de vida y reconexión:**

```
Servidor se reinicia o cae
   ▼
Conexión SSE se cierra  (también se borran los sseClients de memoria)
   ▼
EventSource se RECONECTA SOLO (es automático; manda la cookie → requireAdmin vuelve a pasar)
   ▼
AdminChat vuelve a cargar:
   1. GET /api/admin/messages   → historial completo desde la DB (no se pierde nada)
   2. stream SSE abierto de nuevo → sigue recibiendo push
```

> El broadcast vive en memoria (se pierde al reiniciar), pero **el historial está en la DB**:
> al reconectar se recarga. Por eso no se pierden mensajes.

**Resumen del flujo:**

| Paso | Quién | Qué hace |
|---|---|---|
| 1 | Cliente | `new EventSource(url)` abre la conexión |
| 2 | Servidor | Valida sesión (`requireAdmin`) y deja la conexión abierta |
| 3 | Cliente | Carga historial con `GET /api/admin/messages` |
| 4 | Cualquier admin | `POST /api/admin/messages` guarda en la DB |
| 5 | Servidor | `broadcast(msg)` escribe `data: {...}` en todos los `sseClients` |
| 6 | Todos los clientes | `onmessage` agrega el mensaje → UI actualizada al instante |

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

## Paso 9 — Chat privado, hardening y tests

Esta fase (`refactor/chat-v1`) convierte el backend en una base más robusta y añade chat
privado **1:1 y en grupo** para cualquier usuario logueado.

### 1. Dependencias y scripts

```bash
npm install pg connect-pg-simple helmet express-rate-limit
npm install -D vitest supertest
```

`package.json` (scripts actuales):

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "cd client && vite build",
    "start": "NODE_ENV=production node server.js",
    "db:migrate": "node db/migrate.js",
    "test": "node db/migrate.js && vitest run",
    "test:watch": "vitest"
  }
}
```

`.env` (y `.env.example` sin valores):

```bash
DATABASE_URL='postgresql://usuario:password@host/dbname?sslmode=require'
SESSION_SECRET='cambia-esto-por-una-cadena-larga-y-secreta'
ADMIN_SECRET='Cambia esto'
```

### 2. `app.js` + `server.js` (app testeable, sin `listen`)

`app.js` exporta la app para poder testearla con Supertest; `server.js` es el único que
escucha y cierra ordenadamente:

```js
// server.js
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
```

`app.js` actual (orden importante: JSON → sesión → passport → same-origin → rutas API →
static/Vite → error handler):

```js
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
```

`config/env.js` valida las variables obligatorias al arrancar (falla rápido si faltan):

```js
import "dotenv/config";

const required = ["DATABASE_URL", "SESSION_SECRET"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(", ")}`,
  );
}

const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  adminSecret: process.env.ADMIN_SECRET,
  port: Number(process.env.PORT) || 3000,
  isProd,
  isTest,
};

export default env;
```

> **Sesiones:** en dev/prod se guardan en Postgres con `connect-pg-simple` (cookie
> `members.sid`, 7 días). En tests se usa `MemoryStore` para no depender de la tabla de
> sesiones. Esto reemplaza al `MemoryStore` histórico del Anexo.

### 3. `db/pg.js`, migraciones y `db/migrations/001_chat.sql`

`db/pg.js` crea un `Pool` de `pg` (usado por sesiones y chat) y convierte `BIGINT` a número,
porque `pg` devuelve `BIGSERIAL` como string:

```js
import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;

pg.types.setTypeParser(20, (value) => Number(value));

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
});

export default pool;
```

`db/migrate.js` aplica en orden los `.sql` de `db/migrations/`, registra cada uno en
`schema_migrations` y envuelve cada migración en una transacción (`BEGIN`/`COMMIT`/`ROLLBACK`).
Ejecutar con `npm run db:migrate` (es idempotente: si ya está aplicada, la salta).

`db/migrations/001_chat.sql`:

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
  title TEXT,
  dm_key TEXT UNIQUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT conversations_shape CHECK (
    (type = 'direct' AND dm_key IS NOT NULL AND title IS NULL) OR
    (type = 'group' AND dm_key IS NULL AND title IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_id ON messages (conversation_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations (updated_at DESC);
```

Decisiones del esquema:

- **DM único**: `dm_key` guarda los dos ids ordenados (`"3:7"`), con `UNIQUE`. Si el DM ya
  existe, se reutiliza en vez de crear otro.
- **Grupo**: `title` obligatorio y `dm_key` nulo (lo exige el CHECK).
- **Miembros y roles**: `conversation_members` es la tabla puente; el creador queda `owner`.
- **No leídos**: `last_read_message_id` por miembro; se compara con el último mensaje.
- **Borrado lógico**: `messages.deleted_at` (las consultas filtran `IS NULL`).

### 4. Hardening y middlewares

- `helmet` — cabeceras de seguridad (CSP activa en prod).
- `express-rate-limit` — `authLimiter` (100 req/15 min en auth/admin) y
  `chatWriteLimiter` (120 req/min en escrituras de chat); ambos se saltan en tests.
- `sameOrigin` — para `POST`/`PUT`/`PATCH`/`DELETE` con cabecera `Origin`, exige que coincida
  con el host de la petición (mitiga CSRF). Las peticiones sin `Origin` (curl, tests) pasan.
- `errorHandler` — centraliza errores: 500 genérico en prod, mensaje en 4xx; no filtra stacks.
- `notFound` — cualquier `/api/*` desconocida responde 404 JSON (no cae en el SPA).
- `GET /api/health` — healthcheck `{ ok: true }`.

### 5. API de chat

Base: `/api/chat`. Todo requiere sesión (`requireAuth`).

| Método | Ruta | Body / query | Respuesta |
|---|---|---|---|
| GET | `/users?q=` | `q` mín. 2 caracteres | `[{ id, username }]` |
| GET | `/conversations` | — | Lista de conversaciones |
| GET | `/conversations/:id` | — | Una conversación |
| POST | `/conversations` | `{ type:"direct", targetUserId }` o `{ type:"group", title, memberIds }` | 201 (200 si el DM ya existía) |
| GET | `/conversations/:id/messages` | `limit` (máx. 100), `before` | `{ messages, nextCursor }` |
| POST | `/conversations/:id/messages` | `{ body }` (máx. 4000) | 201 + mensaje |
| POST | `/conversations/:id/read` | `{ messageId }` | `{ ok, lastReadMessageId }` |
| GET | `/stream` | — | SSE |

Forma de una conversación:

```json
{
  "id": 1,
  "type": "direct",
  "title": "luis",
  "created_at": "...",
  "updated_at": "...",
  "last_read_message_id": 12,
  "unread_count": 0,
  "last_message": {
    "id": 12,
    "body": "hola",
    "created_at": "...",
    "sender_id": 7,
    "username": "luis"
  },
  "members": [{ "id": 7, "username": "luis", "role": "owner" }]
}
```

- En un **DM**, el `title` se calcula en el backend con el username del otro miembro.
- `unread_count` cuenta mensajes con `id > last_read_message_id` cuyo `sender_id` no es el
  usuario actual.
- `GET /messages` devuelve los últimos `limit` en orden ascendente. Si la página vino
  completa, `nextCursor` es el id del mensaje más viejo (para pedir `?before=<id>`); si vino
  incompleta, es `null`.
- Crear un DM es **idempotente** por `dm_key`; crear un grupo valida que todos los
  `memberIds` existan y añade al creador como `owner`.

Implementación principal: `controllers/chatController.js` y `routes/chatRoutes.js`.
Las operaciones que tocan varias tablas (crear conversación + miembros) usan una transacción
con `pool.connect()`; el envío de mensajes usa un `INSERT ... SELECT ... WHERE EXISTS`
para insertar solo si el usuario es miembro.

### 6. SSE del chat

A diferencia del chat de admins (Paso 8), aquí los eventos van **con nombre** y se filtran
por miembro de la conversación:

```
GET /api/chat/stream
  → event: ready                data: { userId }
  → event: conversation.created data: { conversationId }
  → event: message.created      data: { conversationId, message }
  → event: read.updated         data: { conversationId, lastReadMessageId }
```

- `streamClients` es un `Set` de `{ res, userId }`; al desconectar se limpia y se corta el
  heartbeat (30 s).
- `message.created` y `conversation.created` se envían a **todos los miembros**.
- `read.updated` se envía **solo al mismo usuario** (sus otras pestañas), porque representa
  el avance de *su* lectura.
- El hook `client/src/hooks/useChatStream.js` usa `addEventListener` para los eventos con
  nombre (no `onmessage`) y `withCredentials: true` para mandar la cookie.

```js
const source = new EventSource("/api/chat/stream", { withCredentials: true });

source.addEventListener("message.created", (event) => {
  const { conversationId, message } = JSON.parse(event.data);
  // append idempotente: prev.some(m => m.id === message.id) ? prev : [...prev, message]
});
source.addEventListener("conversation.created", () => reloadConversations());
source.addEventListener("read.updated", ({ data }) => {
  const { conversationId, lastReadMessageId } = JSON.parse(data);
  // actualizar el marcador local
});

return () => source.close();
```

### 7. Frontend de chat

Rutas nuevas en `client/src/App.jsx` (solo logueados; si no hay sesión → `/login`):

- `/chat` → lista de conversaciones + panel vacío.
- `/chat/:conversationId` → conversación activa (en móvil se muestra sola; en desktop
  conviven lista y ventana).

Componentes:

- `ChatPage.jsx` — estado global del chat: lista, mensajes, cursor, no leídos, SSE y navegación.
- `ConversationList.jsx` — búsqueda visual, último mensaje, hora, badge de no leídos.
- `ChatWindow.jsx` — cabecera, historial, scroll al último mensaje, botón de mensajes viejos.
- `MessageComposer.jsx` — textarea (Enter envía, Shift+Enter salto de línea), límite 4000.
- `NewConversationModal.jsx` — pestañas DM/Grupo, búsqueda de usuarios con debounce (300 ms),
  selección múltiple y creación.
- `client/src/api/chat.js` — helpers `fetch` con manejo uniforme de errores.

Detalles de estado:

- Al abrir una conversación se cargan los últimos 30 mensajes y se marca leída si el último
  mensaje supera `last_read_message_id`.
- Los eventos SSE se aplican de forma **idempotente** (por `id`) para evitar duplicados entre
  la respuesta del POST y el push.
- La lista se reordena por actividad (`last_message.created_at` o `updated_at`).

### 8. Tests

`test/chat.test.js` usa Vitest + Supertest contra la app exportada (`NODE_ENV=test` activa
MemoryStore y desactiva los rate limiters). Cubre:

1. registro de dos usuarios y búsqueda;
2. creación de DM y reutilización por `dm_key`;
3. envío de mensaje y cálculo de `unread_count`;
4. historial y cursor;
5. marcar leído (baja a 0 el no leído);
6. grupo con miembros y no leídos;
7. validaciones (DM consigo mismo, mensaje vacío, lectura inválida);
8. stream SSE autenticado (`text/event-stream` + evento `ready`).

Los tests usan usuarios aleatorios (`test_a_<sufijo>`) y los eliminan en `afterAll` (el
`ON DELETE CASCADE` limpia conversaciones y mensajes). **Usan la DB real configurada en
`.env`**, así que no los apuntes a producción.

`vitest.config.js`:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### 9. Verificación

```bash
npm run db:migrate
npm test                 # 8/8 en verde
npm run build            # build de React
npm run dev              # http://localhost:3000
```

Prueba manual en el navegador:

1. Registra dos usuarios (usa una ventana normal y otra de incógnito).
2. Con el usuario A: **Chats → Nuevo → Mensaje directo → busca a B**.
3. Envía un mensaje; en la ventana de B debe aparecer sin recargar (SSE) y con badge de no leído.
4. Abre la conversación en B → el badge baja a 0.
5. Crea un grupo con ambos y repite el envío.
6. Recarga la página: la sesión persiste (cookie `members.sid` + store en Postgres).

### 10. Gotchas de esta fase

- `pg` devuelve `BIGINT` como **string**; sin `setTypeParser(20, Number)` las comparaciones
  `id <= otroId` fallan (`"10" < "9"`). Está resuelto en `db/pg.js`.
- El driver HTTP de Neon (`sql\`...\``) no permite transacciones multi-query; por eso el chat
  usa el `Pool` de `pg`. Auth/posts/admin siguen usando `@neondatabase/serverless`.
- Los eventos SSE con nombre **no** llegan a `source.onmessage`; hay que registrarlos con
  `source.addEventListener("nombre", ...)`.
- En producción `secure: true` exige HTTPS; en `http://localhost` la cookie no se guarda.
- `sameOrigin` bloquea escrituras cross-origin con `Origin` distinto; si usas un dominio o
  proxy, revisa `trust proxy` y el host recibido.
- El servidor de desarrollo no recarga cambios de backend; reinicia `npm run dev`.
- El chat de admins histórico (`admin_messages`, `/api/admin/messages`) sigue activo y
  separado del chat privado nuevo.

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
express-session ──► guarda {passport: {user: <id>}} en Postgres
                    (connect-pg-simple) y envía la cookie members.sid
              │
              ▼
authController ──► res.json(user)   → HTTP 200
```

### Diagrama 2 — ¿Dónde vive la sesión?

`express-session` usa **`connect-pg-simple`**: la sesión se guarda en la tabla `session` de
Postgres. El navegador solo guarda el **ID** de la sesión en la cookie `members.sid`.
En tests (`NODE_ENV=test`) se usa `MemoryStore` para no depender de esa tabla.

```
   Postgres (tabla session)                         Navegador
┌──────────────────────────────────────┐        ┌─────────────────────┐
│  connect-pg-simple                   │        │  Cookies            │
│  ┌────────────────────────────────┐  │        │  members.sid=abc123 │
│  │  "abc123..." → {              │  │◄───────│                     │
│  │    passport: { user: 7 }      │  │        │  solo viaja el ID   │
│  │  }                            │  │        └─────────────────────┘
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
     los datos de la sesión viven aquí (persisten al reiniciar)
```

> La cookie es `httpOnly`, `sameSite=lax`, dura 7 días y en producción es `secure` (HTTPS).
> `SESSION_SECRET` firma la cookie; si cambia, las sesiones existentes dejan de ser válidas.

### Diagrama 3 — Recuperación de la sesión (peticiones siguientes)

```
NAVEGADOR
   │  GET /api/auth/me   (la cookie members.sid viaja automáticamente)
   ▼
express-session ──► lee la cookie → busca "abc123" en la tabla session (Postgres)
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
