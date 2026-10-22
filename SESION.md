# Sesión de trabajo — Members-Only

> Archivo de contexto para continuar el proyecto desde otro PC o una nueva sesión.
> Complementa a `README.md` (guía de configuración técnica). Aquí está el estado del trabajo y las decisiones.

- Fecha de inicio: 27 ago 2026
- Última actualización: 20 oct 2026 (fase `refactor/chat-v1`)
- Proyecto: Members-Only — app de posts en grupos privados con autenticación.
- Objetivo de la sesión: migrar de **EJS** a **React**, manteniendo el backend **Node + Express** controlado a mano.

---

## Acuerdos de trabajo (cómo trabajamos)
- **El usuario implementa todo manualmente**; el asistente guía paso a paso, da el código exacto,
  **verifica** cada paso y tacha el ítem de la lista.
- `README.md` es la guía de configuración definitiva; se actualiza al cerrar cada paso.
- Todo el código documentado en el README debe coincidir con los archivos reales del proyecto.

## Arquitectura (decisiones definitivas)
- **Un solo servidor**: Express + Vite como middleware (`middlewareMode: true`, `appType: "spa"`).
  - Dev: HMR en puerto 3000 → `node app.js`.
  - Prod: build de `client/dist` + fallback SPA → `NODE_ENV=production node app.js`.
- **No se usa EJS**: Express se vuelve una **API** que responde JSON en `/api/*`.
- **Base de datos**: Neon (PostgreSQL serverless), driver oficial `@neondatabase/serverless`
  (se eliminó `pg`). Sintaxis de queries: tagged templates `sql\`...\``.
- **Estilos**: Tailwind **v4** (solo plugin de Vite + `@import "tailwindcss"`; sin
  `tailwind.config.js` ni `postcss.config.js`).
- **Auth**: Passport (`passport-local`) + `bcryptjs` + `express-session` + `express-validator`.
- **Rutas del SPA**: `react-router-dom` v7 (instalado). Express sigue siendo la fuente de verdad (API).

## Checklist de progreso
`[x]` completado · `[ ]` pendiente

- [x] **1. Dependencias base** — corregido typo `pq`→`pg`; instalados react, react-dom, vite,
      @vitejs/plugin-react, @tailwindcss/vite, @neondatabase/serverless, react-router-dom.
- [x] **2. Scaffolding del proyecto** — `mkdir -p db client/src config controllers routes`.
- [x] **3. Configuración base** — `client/vite.config.js`, `index.html`, `src/main.jsx`, `src/index.css`.
      Prueba con `npx vite` desde `client/`.
- [x] **4. Conexión Neon** — `db/neon.js`, `.env` con DATABASE_URL, prueba `node db/test.js`.
- [x] **5. Express + Vite en dev** — `app.js` con middleware de Vite; probado, responde 200 con HMR.
- [x] **6. Express + build en prod** — rama `NODE_ENV=production`: `express.static(client/dist)`
      + `app.get("/*splat", ...)`. Corregido typo `disPath`→`distPath`; probado build + prod en :3000.
      *(En README, 5 y 6 se fusionaron en un solo Paso 5 "dev y prod".)*
      **← SIGUIENTE PASO: 7 (backend autenticación) — código en README Paso 6 + Anexo de diagramas**
- [x] **7. Backend autenticación** — schema `users`/`posts`, `config/passport.js`, `authController` con bcryptjs.
      Verificado: register→me→logout→401, 409 en duplicado. Corregidos: typo `sql8`/`#{username}`,
      duplicado de `.gitignore`, ruta `controller/`→`controllers/` (consolidada), fuga de hash en login
      (se sanitiza con `safeUser`). Creado `.env.example`.
      **← SIGUIENTE PASO: 8 (postRoutes + controllers JSON + express-validator)**
- [x] **8. Rutas API JSON** — `postRoutes`/`adminRoutes` + `postController`/`adminController` con
      JSON + express-validator. Roles: invitado (feed sin autor) / user / admin (`"isAdmin"` en
      users + `becomeAdmin` con `ADMIN_SECRET`). Chat privado de admins (`admin_messages`).
      Verificado completo con curl. Corregidos 8 errores (ver Lecciones).
      **← SIGUIENTE PASO: 9 (App React)**
- [x] **9. App React** — componentes App, Login, Register, PostList, PostForm + router
      (react-router-dom) + helpers fetch (`api/auth.js`, `api/posts.js`). Feed público anónimo /
      logueado con autor, botón "Unirse al club" (becomeAdmin), borrado de posts propios/admin.
      Corregidos 7 errores (imports `post.js`→`posts.js`, `setuser`, `useEffect` sin `[]`,
      `userrname`, `e.taget`, `errors[0].msg`).
- [x] **10. react-router-dom** — BrowserRouter, Routes, Route, Link; rutas protegidas con
      `<Navigate>` (login/register si hay sesión; `/admin` solo admins).
- [x] **11. Comunicación fetch** — helpers en `client/src/api/` (auth.js, posts.js, admin.js).
- [x] **12. Scripts npm** — `dev: node app.js`, `build: cd client && vite build && cd ..`,
      `start: NODE_ENV=production node app.js`. Eliminados browser-sync/nodeom/npm-run-all
      → `npm audit` = **0 vulnerabilidades**.
      **← SIGUIENTE PASO: 13 (verificación final dev+prod)**
- [x] **13. Verificación final** — flujo completo verificado en **dev** y **prod**:
      register→login→postear→feed (anónimo sin autor / logueado con autor), validaciones 400,
      becomeAdmin (403/ok), logout→401, SPA + fallbacks (`/login`, `/admin`) 200, SSE push en vivo.
      **✔ CHECKLIST COMPLETO**
- [x] **Chat admin con SSE** — reemplazado el polling de 5s por Server-Sent Events (push real).
      Backend: `streamAdminMessages` + `broadcast` en adminController; frontend: `EventSource`
      en AdminChat (historial con GET + append en vivo, sin duplicados). Verificado con curl.

## Código del siguiente paso (Paso 13)
Verificación final: flujo completo registro→login→postear→ver (feed anónimo/logueado) +
becomeAdmin + chat SSE, en dev y prod. **COMPLETADO — proyecto funcional de punta a punta.**
Posibles mejoras futuras: store de sesiones persistente (`connect-pg-simple`), chat de admins
con WebSocket (si se quiere bidireccional), deploy.

---

## Fase actual — `refactor/chat-v1` (en curso, sin commit)

Objetivo: endurecer el backend y añadir **chat privado 1:1 y en grupo** (sustituye al chat
solo de admins para el uso general; el chat de admins antiguo sigue existiendo en `/admin`).

### Completado en esta fase (working tree)
- [x] **Separación app/servidor** — `app.js` exporta la app (testeable, sin `listen`);
      `server.js` hace `listen` + cierre ordenado con SIGTERM/SIGINT.
- [x] **Config validada** — `config/env.js` exige `DATABASE_URL` y `SESSION_SECRET`, centraliza
      `PORT`, `isProd`, `isTest`; ya no se lee `process.env` disperso.
- [x] **Sesiones persistentes** — `connect-pg-simple` sobre `db/pg.js` en dev/prod
      (MemoryStore solo en `NODE_ENV=test`). Cookie `members.sid` httpOnly, sameSite=lax,
      secure en prod, 7 días. `trust proxy` en prod.
- [x] **Hardening** — `helmet`, `express-rate-limit` (`authLimiter`, `chatWriteLimiter`),
      `sameOrigin` para métodos unsafe, `notFound`/`errorHandler` centralizados,
      `GET /api/health`.
- [x] **Migraciones** — `db/migrate.js` + `db/migrations/001_chat.sql` (tabla
      `schema_migrations`, transacciones). Script `npm run db:migrate` (ya aplicada en Neon).
- [x] **Esquema de chat** — `conversations`, `conversation_members`, `messages`
      (DM por `dm_key` único, grupos, roles owner/member, `last_read_message_id`, borrado lógico).
- [x] **Backend de chat** — `controllers/chatController.js` + `routes/chatRoutes.js`,
      montado en `/api/chat`. Endpoints:
      - `GET /users?q=` (mín. 2 caracteres, sin wildcards)
      - `GET /conversations` (título de DM calculado, último mensaje, `unread_count`)
      - `GET /conversations/:id`
      - `POST /conversations` (`{type:"direct",targetUserId}` reutiliza DM; grupo con
        `{type:"group",title,memberIds}`)
      - `GET /conversations/:id/messages?limit=&before=` (paginación por cursor `id`)
      - `POST /conversations/:id/messages` (`{body}`, máx. 4000)
      - `POST /conversations/:id/read` (`{messageId}`)
      - `GET /stream` (SSE con eventos `ready`, `message.created`, `conversation.created`,
        `read.updated`; heartbeat 30 s; `read.updated` solo al mismo usuario).
- [x] **Frontend de chat** — `client/src/component/chat/*` (ChatPage, ConversationList,
      ChatWindow, MessageComposer, NewConversationModal), `hooks/useChatStream.js`,
      `api/chat.js`; rutas `/chat` y `/chat/:conversationId`; layout con scroll independiente.
- [x] **Tests** — `test/chat.test.js` (Vitest + Supertest) cubre registro, búsqueda, DM único,
      envío, no leídos, historial, marcar leído, grupo, validaciones y SSE. `npm test` en verde
      (8/8). `vitest.config.js` con timeout 30 s y sin paralelismo entre archivos.
- [x] **Verificación** — `npm run build` OK; `npm test` OK; smoke dev: `/api/health` 200 y
      `/chat` 200.

### Pendiente para cerrar la fase
- [ ] Probar el flujo de chat en el navegador (login, DM, grupo, dos pestañas/SSE, no leídos).
- [x] Documentar en `README.md`: inicio rápido, scripts (`server.js`), store de sesiones,
      migraciones, objetivos de chat, endpoints, SSE con eventos nombrados, frontend, tests,
      hardening, gotchas y Anexo de sesión actualizado. (Paso 9 añadido.)
- [ ] Probar `npm start` en producción real (HTTPS) por el flag `secure` de la cookie.
- [ ] Decidir si el chat de admins (`admin_messages` + `/admin`) se conserva o se migra a
      `conversations`; por ahora conviven.
- [ ] Revisar `secure: env.isProd`: en prod local por HTTP la cookie no se guarda; para
      probar `npm start` en localhost haría falta HTTPS o un flag explícito.
- [ ] Commit de la fase `refactor/chat-v1`.

### Gotchas nuevos aprendidos
- `pg` devuelve `BIGINT`/`BIGSERIAL` como **string**; se añadió
  `pg.types.setTypeParser(20, Number)` en `db/pg.js`. Sin eso, comparar ids de mensajes
  (`"10" < "9"`) da resultados incorrectos en el front.
- `@neondatabase/serverless` (tagged templates) no sirve para transacciones multi-query;
  el chat usa el `Pool` de `pg` (`db/pg.js`) para crear conversación + miembros de forma atómica.
- Los eventos SSE con nombre (`event: ready`) **no** llegan a `source.onmessage`; hay que
  usar `source.addEventListener("ready", ...)` (el hook ya lo hace).
- En tests, `NODE_ENV=test` activa MemoryStore y desactiva los rate limiters; las pruebas siguen
  usando la DB real de Neon, con usuarios aleatorios y limpieza en `afterAll`.
- El servidor de desarrollo que quedó corriendo de la sesión anterior no recarga el backend:
  hay que reiniciar `node server.js` para ver los endpoints de chat.

## Lecciones y errores típicos aprendidos
- `vite.config.js` usa **`plugins`** (plural), no `plugin`.
- El **CSS se importa desde JS** (`import "./index.css"`); el `<link>` en HTML no es el patrón recomendado.
- Con el middleware de Vite **NO se corre `npx vite` por separado** junto a `node app.js`
  (choque del puerto 24678 del WebSocket de HMR).
- En **Express 5** el comodín de ruta es `/*splat` (antes era `*`, ahora rompe).
- `@neondatabase/serverless` devuelve arrays: `const { version } = (await sql\`SELECT version()\`)[0];`.
- Verificar paquetes con scope: `require('pkg/package.json')` puede dar falso negativo por el campo `exports`;
  usar `import('pkg')` o leer el archivo directamente.
- **Nunca devolver el usuario completo de la DB en JSON**: la estrategia de Passport carga `SELECT *`
  (incluye el hash). Sanitizar con `const { password, ...safeUser } = user;` antes de `res.json()`.
- No duplicar carpetas con nombre parecido (`controller` vs `controllers`): el import de rutas
  define la canonical. Revisar con `grep -rn` antes de crear.
- **PostgreSQL pasa los identificadores sin comillas a minúsculas**: columna `isAdmin` sin comillas
  se convierte en `isadmin` (y la key en JS). Para camelCase hay que escribir `"isAdmin"` (entre
  comillas dobles) en **toda** consulta.
- **`CREATE TABLE IF NOT EXISTS` no añade columnas a una tabla existente**: usar
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para migrar DBs ya creadas.
- Errores típicos al escribir a mano: typo en vars de entorno (`ADDMIN_SECRET`), `sql8`/`#{x}`
  (tagged template), import con path equivocado (`../db.js`), columnas que no existen (`message`
  vs `body`), paréntesis sin cerrar en SQL, y **nombres de export que no coinciden** con el import
  de las rutas (`getposts` vs `getPosts`) → la app no arranca.
- Con **MemoryStore**, al reiniciar el servidor se pierden todas las sesiones: al probar con curl
  tras un restart hay que **volver a loguearse** (las cookies viejas dan 401).
- Los errores de orquestación de pruebas no son bugs de la app: distinguir "sesión perdida por
  restart" de un fallo real del código.

## Skill — Server-Sent Events (SSE)
- **Qué es**: HTTP que queda abierto; el servidor empuja eventos `data: <json>\n\n` (línea en blanco).
- **Cuándo usar**: chat/notificaciones (unidireccional servidor→cliente). Evita el polling (peticiones
  inútiles). WebSocket solo si se necesita bidireccionalidad (juegos, colab).
- **Backend**: `res.writeHead(200, {"Content-Type":"text/event-stream", ...})` + `res.flushHeaders()`
  (envía headers sin esperar primer write) → mantener `res` en un `Set` de clientes → `broadcast`
  escribe en cada uno → limpiar con `res.on("close")`. Heartbeat `: ping\n\n` cada 30s para proxies.
- **Frontend**: `new EventSource(url)`; `source.onmessage`; `source.close()` al desmontar.
  `EventSource` **se reconecta solo** y manda la cookie de sesión (same-origin → funciona `requireAdmin`).
- **Gotcha**: el broadcast vive en memoria (se pierde al reiniciar) → el cliente recarga historial al
  reconectarse. Append idempotente `prev.some(m => m.id === msg.id)` para evitar duplicados.
- **Probar**: `curl -N <url>` se queda "colgado" y muestra cada evento al instante.

## Archivos clave del proyecto
- `app.js` — app Express + middleware de Vite (dev/prod), sesión, seguridad y montaje de rutas.
  `server.js` — `listen` + cierre ordenado.
- `config/env.js` — variables de entorno validadas. `config/passport.js` — estrategia local.
- `db/pg.js` — `Pool` de `pg` (sesiones + chat). `db/neon.js` — cliente Neon (posts/auth/admin).
  `db/migrate.js` + `db/migrations/` — migraciones SQL.
- `client/` — React: `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`,
  `src/api/` (auth, posts, admin, chat), `src/hooks/useChatStream.js`,
  `src/component/` (Login, Register, PostList, PostForm, AdminChat) y `src/component/chat/`
  (ChatPage, ConversationList, ChatWindow, MessageComposer, NewConversationModal).
- `controllers/` (auth, post, admin, chat), `middleware/` (auth, validate, errorHandler,
  rateLimiters, sameOrigin), `routes/` (auth, post, admin, chat).
- `test/chat.test.js` — integración del chat. `vitest.config.js` — configuración de pruebas.
- `README.md` — guía de configuración. Pasos 1-8 (recorrido histórico; 5 fusiona dev+prod y
  8 = SSE) + **Paso 9 con el estado actual** (inicio rápido, `server.js`, sesiones en Postgres,
  migraciones, chat privado, SSE con eventos nombrados, frontend, tests y gotchas) + Anexo de
  sesión actualizado a `members.sid`/`connect-pg-simple`.

## ⚠️ IMPORTANTE al cambiar de PC
- `.env` **no está en git** (gitignored). En el otro PC hay que crearlo de nuevo con
  `DATABASE_URL`, `SESSION_SECRET` y `ADMIN_SECRET`.
- Al clonar: `npm install` (incluye `pg`, `connect-pg-simple`, `helmet`, `express-rate-limit`,
  Vitest y Supertest).
- Tras configurar `.env`: `npm run db:migrate` para crear/actualizar las tablas del chat.
- `npm run dev` / `npm start` ahora arrancan `server.js` (no `app.js`).
- Para retomar: pegar este archivo en la nueva sesión de opencode para restaurar el contexto.
---

## Cierre de la fase `refactor/chat-v1`

- La app abre directamente en el **chat**: se retiraron el muro de posts y el chat de admins
  de la interfaz (los endpoints siguen en el servidor, sin uso).
- Funcionalidad completa: salas públicas y privadas, mensajes directos, hilos, reacciones,
  citas, menciones, fijados, búsqueda, enlaces, presencia y “está escribiendo…”.
- Notificaciones con sonido y aviso del sistema, tres modos (sonido y aviso / solo sonido /
  silenciar), contador de no leídos en el título y silencio por conversación.
- Archivar y eliminar chats; borrar mensajes (propias o con permisos de moderación).
- Confirmaciones propias con el tema de la app, sin `window.confirm`.
- Identidad: logo «Círculo», favicon que sigue al tema e icono de app.
- Migraciones `002`–`004`, `Cache-Control: no-store` en `/api`, tests de integración (23).
