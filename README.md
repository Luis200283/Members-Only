# Members-Only — Guía de configuración

App de posts en grupos privados.

- Backend: Node + Express
- Frontend: React + Vite + Tailwind
- Base de datos: Neon (PostgreSQL serverless)
- Auth: Passport + bcryptjs

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
      <h1 className="text-4xl font-bold bg-red-300 text-red-500">
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

## Paso 5 — Express + Vite en dev (HMR)

Servidor único en puerto 3000; Express inyecta Vite como middleware.

`app.js`:
```js
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
```

Probar el proyecto desde la raíz:
```bash
node app.js
```
Abrir http://localhost:3000 → React se renderiza con estilos de Tailwind (HMR activo: editar
`client/src/App.jsx` y el navegador se actualiza sin recargar).

Nota: con esta arquitectura ya no se ejecuta `npx vite` por separado; el servidor de Vite
vive dentro de Express. Correr ambos a la vez causa conflicto de puerto del WebSocket de HMR.

```
Members-Only/
├── app.js        → servidor Express (pendiente de reescribir)
├── .env          → credenciales (gitignored)
├── db/
│   ├── neon.js   → cliente de la DB
│   └── test.js   → prueba de conexión
├── client/       → app React + Vite + Tailwind
│   ├── index.html
│   ├── vite.config.js
│   └── src/ (main.jsx, App.jsx, index.css)
├── config/       → (vacío, para passport en paso 7)
├── controllers/  → (vacío)
└── routes/       → (vacío)
```
