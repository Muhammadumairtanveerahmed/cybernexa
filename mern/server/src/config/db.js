import mysql from "mysql2/promise";

export const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "technexa",
  charset: "utf8mb4",
  timezone: "Z"
};

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true
});

// Keep MySQL and Node on the same clock. DATETIME values are written as UTC
// strings by nowSql(), so every pooled connection must use the UTC session zone.
pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}
