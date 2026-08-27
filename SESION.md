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
- [ ] **6. Express + build en prod** — rama `NODE_ENV=production`: `express.static(client/dist)`
      + `app.get("/*splat", ...)`. **← SIGUIENTE PASO (código abajo)**
- [ ] **7. Backend autenticación** — schema `users`/`posts`, `config/passport.js`, `authController` con bcryptjs.
- [ ] **8. Rutas API JSON** — `authRoutes` y `postRoutes` con controllers JSON + express-validator.
- [ ] **9. App React** — componentes App, Login, Register, PostList, PostForm.
- [ ] **10. react-router-dom** — BrowserRouter, Routes, Route, Link (proteger rutas por sesión).
- [ ] **11. Comunicación fetch** — helpers en `client/src/api/` (cookies de sesión).
- [ ] **12. Scripts npm** — actualizar `dev`/`start`/`build`; eliminar browser-sync/npm-run-all/nodeom
      (fuente de las vulnerabilidades de `npm audit`).
- [ ] **13. Verificación final** — flujo completo registro→login→postear→ver, en dev y prod.

## Código del siguiente paso (Paso 6)
`app.js` final (completo):
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
Prueba: `npx vite build` (desde `client/`) → `NODE_ENV=production node app.js` → abrir :3000.

## Lecciones y errores típicos aprendidos
- `vite.config.js` usa **`plugins`** (plural), no `plugin`.
- El **CSS se importa desde JS** (`import "./index.css"`); el `<link>` en HTML no es el patrón recomendado.
- Con el middleware de Vite **NO se corre `npx vite` por separado** junto a `node app.js`
  (choque del puerto 24678 del WebSocket de HMR).
- En **Express 5** el comodín de ruta es `/*splat` (antes era `*`, ahora rompe).
- `@neondatabase/serverless` devuelve arrays: `const { version } = (await sql\`SELECT version()\`)[0];`.
- Verificar paquetes con scope: `require('pkg/package.json')` puede dar falso negativo por el campo `exports`;
  usar `import('pkg')` o leer el archivo directamente.

## Archivos clave del proyecto
- `app.js` — servidor Express + middleware de Vite (dev/prod). *(tiene cambios sin commitear)*
- `client/` — React: `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/index.css`.
- `db/neon.js` — cliente de Neon. `db/test.js` — prueba de conexión.
- `config/passport.js` — existe (vacío, para el Paso 7).
- `README.md` — guía de configuración (Pasos 1-5 documentados; Paso 6 pendiente de documentar).

## ⚠️ IMPORTANTE al cambiar de PC
- `.env` **no está en git** (gitignored). En el otro PC hay que crearlo de nuevo:
  `DATABASE_URL='postgresql://...'` (string de conexión pooled de Neon).
- Al clonar: `npm install` y `npm install react-router-dom` ya queda en package.json.
- Para retomar: pegar este archivo en la nueva sesión de opencode para restaurar el contexto.