import "dotenv/config";
import http from "node:http";
import app from "./app.js";
import { testConnection, pool } from "./config/db.js";
import { ensureCourses } from "./services/course.service.js";
import { initSockets } from "./sockets/index.js";

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    await testConnection();
    await ensureCourses();
    console.log("MySQL connected and course catalogue ready");
  } catch (error) {
    console.error("MySQL startup failed:", error.message);
  }

  const server = http.createServer(app);
  const io = initSockets(server);
  app.set("io", io);

  server.listen(PORT, () => {
    console.log(`TechNexa API listening on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start();
