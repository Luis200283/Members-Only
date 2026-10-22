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
