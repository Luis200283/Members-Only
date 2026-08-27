import sql from "./neon.js";

const result = await sql`SELECT version()`;
const { version } = result[0];

console.log("Conenctado a Neon implementando:", version);
