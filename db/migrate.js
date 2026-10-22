import { readdir, readFile } from "fs/promises";
import path from "path";
import pool from "./pg.js";

const migrationsDir = path.join(import.meta.dirname, "migrations");

async function run() {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE id = $1",
        [file],
      );

      if (applied.rowCount > 0) {
        console.log(`Migración ya aplicada: ${file}`);
        continue;
      }

      const sqlText = await readFile(path.join(migrationsDir, file), "utf8");

      await client.query("BEGIN");

      try {
        await client.query(sqlText);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
        console.log(`Migración aplicada: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  await run();
} catch (error) {
  console.error("Error al ejecutar migraciones:", error.message);
  process.exitCode = 1;
}
