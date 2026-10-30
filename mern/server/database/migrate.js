import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { dbConfig } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

async function run() {
  const connection = await mysql.createConnection({
    ...dbConfig,
    multipleStatements: true
  });

  try {
    await connection.query("SET time_zone = '+00:00'");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    const [rows] = await connection.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip    ${file}`);
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      console.log(`apply   ${file}`);

      await connection.beginTransaction();
      try {
        await connection.query(sql);
        await connection.query(
          "INSERT INTO schema_migrations (filename) VALUES (?)",
          [file]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`Migration failed (${file}): ${error.message}`);
      }
    }

    console.log("Migrations complete");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
