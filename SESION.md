# Sesión de trabajo — Members-Only

> Archivo de contexto para continuar el proyecto desde otro PC o una nueva sesión.
> Complementa a `README.md` (guía de configuración técnica). Aquí está el estado del trabajo y las decisiones.

- Fecha de inicio: 27 ago 2026
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
- [ ] **9. App React** — componentes App, Login, Register, PostList, PostForm.
- [ ] **10. react-router-dom** — BrowserRouter, Routes, Route, Link (proteger rutas por sesión).
- [ ] **11. Comunicación fetch** — helpers en `client/src/api/` (cookies de sesión).
- [ ] **12. Scripts npm** — actualizar `dev`/`start`/`build`; eliminar browser-sync/npm-run-all/nodeom
      (fuente de las vulnerabilidades de `npm audit`).
- [ ] **13. Verificación final** — flujo completo registro→login→postear→ver, en dev y prod.

## Código del siguiente paso (Paso 9)
App React: componentes App, Login, Register, PostList, PostForm. Front consumirá la API
`/api/*` documentada en el README (Pasos 6 y 7). Pendiente de documentar en README.

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

## Archivos clave del proyecto
- `app.js` — servidor Express + middleware de Vite (dev/prod). *(completo, Paso 6 terminado)*
- `client/` — React: `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`.
- `db/neon.js` — cliente de Neon. `db/test.js` — prueba de conexión.
- `config/passport.js` — estrategia local + serialize/deserialize (con `"isAdmin"`).
  `controllers/` (auth, post, admin), `middleware/` (auth, validate), `routes/` (auth, post, admin)
  — **Paso 8 cerrado, todo verificado con curl**.
- `README.md` — guía de configuración. Pasos 1-7 documentados (5 fusiona dev+prod) + Anexo de
  diagramas de sesión. **Paso 8 (App React) pendiente de documentar.**

## ⚠️ IMPORTANTE al cambiar de PC
- `.env` **no está en git** (gitignored). En el otro PC hay que crearlo de nuevo:
  `DATABASE_URL='postgresql://...'` (string de conexión pooled de Neon).
- Al clonar: `npm install` y `npm install react-router-dom` ya queda en package.json.
- Para retomar: pegar este archivo en la nueva sesión de opencode para restaurar el contexto.