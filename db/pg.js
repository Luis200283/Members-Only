import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;

pg.types.setTypeParser(20, (value) => Number(value));

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
});

export default pool;
