import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { dbConfig } from "../src/config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");

async function run() {
  const connection = await mysql.createConnection({
    ...dbConfig,
    multipleStatements: true
  });

  try {
    await connection.query("SET time_zone = '+00:00'");
    const files = (await fs.readdir(seedsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(seedsDir, file), "utf8");
      console.log(`seed    ${file}`);
      await connection.query(sql);
    }

    console.log("Seeds complete");
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
