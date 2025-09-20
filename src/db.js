const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "aws-1-us-east-1.pooler.supabase.com",
  port: Number(process.env.DB_PORT || 6543),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD, // ponla en .env sin caracteres codificados
  database: process.env.DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false }
});

// Garantiza schema
pool.on("connect", (client) => {
  client.query("SET search_path TO public;");
});

module.exports = pool;
