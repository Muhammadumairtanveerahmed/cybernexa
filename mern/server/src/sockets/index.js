import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { pool } from "../config/db.js";
import { AUTH_COOKIE } from "../middleware/attachUser.js";
import { newId, nowSql } from "../utils/ids.js";

const online = new Map();

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const index = part.indexOf("=");
    if (index > -1) {
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (key) acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

export function initSockets(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie || "");
      const token = cookies[AUTH_COOKIE];
      if (!token) return next(new Error("Authentication required"));

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "technexa-development-secret"
      );
      const [rows] = await pool.query(
        "SELECT id, full_name, email, role, status FROM users WHERE id = ? LIMIT 1",
        [payload.sub]
      );
      if (!rows[0] || rows[0].status === "suspended" || rows[0].status === "rejected") {
        return next(new Error("Account is not active"));
      }
      socket.user = rows[0];
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    online.set(user.id, socket.id);
    socket.join(`user:${user.id}`);
    io.emit("presence:update", { userId: user.id, online: true });

    socket.on("chat:typing", ({ recipient_id, typing }) => {
      if (recipient_id) {
        io.to(`user:${recipient_id}`).emit("chat:typing", {
          user_id: user.id,
          typing: Boolean(typing)
        });
      }
    });

    socket.on("chat:send", async ({ recipient_id, body, temp_id }) => {
      try {
        const text = String(body || "").trim().slice(0, 4000);
        if (!recipient_id || !text) return;
        const id = newId("msg");
        const at = nowSql();
        await pool.query(
          `INSERT INTO chat_messages (id, sender_id, recipient_id, body, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [id, user.id, recipient_id, text, at]
        );
        const message = {
          id,
          sender_id: user.id,
          recipient_id,
          body: text,
          created_at: at,
          temp_id: temp_id || null
        };
        io.to(`user:${recipient_id}`).emit("chat:message", message);
        socket.emit("chat:message", message);
      } catch {
        socket.emit("chat:error", { message: "Could not send the message" });
      }
    });

    socket.on("call:invite", async ({ callee_id, call_key, kind }) => {
      try {
        if (!callee_id || !call_key) return;
        const callKind = kind === "video" ? "video" : "audio";
        const [rows] = await pool.query(
          "SELECT id, full_name, status FROM users WHERE id = ? LIMIT 1",
          [callee_id]
        );
        const callee = rows[0];
        if (!callee || !["active", "pending"].includes(callee.status)) {
          socket.emit("call:offline", { peer_id: callee_id, call_key });
          return;
        }

        const key = String(call_key).slice(0, 40);
        await pool.query(
          `INSERT IGNORE INTO call_logs
             (id, call_key, caller_id, callee_id, kind, status, started_at)
           VALUES (?, ?, ?, ?, ?, 'missed', ?)`,
          [newId("call"), key, user.id, callee_id, callKind, nowSql()]
        );

        if (!io.sockets.adapter.rooms.has(`user:${callee_id}`)) {
          await pool.query(
            "UPDATE call_logs SET ended_at = ? WHERE call_key = ? AND caller_id = ? AND ended_at IS NULL",
            [nowSql(), key, user.id]
          );
          socket.emit("call:offline", { peer_id: callee_id, call_key: key });
          return;
        }

        io.to(`user:${callee_id}`).emit("call:invite", {
          caller_id: user.id,
          caller_name: user.full_name,
          call_key: key,
          kind: callKind
        });
      } catch {
        socket.emit("call:error", { message: "Could not start the call" });
      }
    });

    socket.on("call:accept", async ({ caller_id, call_key }) => {
      try {
        if (!caller_id || !call_key) return;
        const key = String(call_key).slice(0, 40);
        await pool.query(
          `UPDATE call_logs
             SET status = 'answered', answered_at = COALESCE(answered_at, ?)
           WHERE call_key = ? AND (caller_id = ? OR callee_id = ?) AND ended_at IS NULL`,
          [nowSql(), key, user.id, user.id]
        );
        io.to(`user:${caller_id}`).emit("call:accept", {
          callee_id: user.id,
          call_key: key
        });
      } catch {
        socket.emit("call:error", { message: "Could not answer the call" });
      }
    });

    socket.on("call:reject", async ({ caller_id, call_key }) => {
      try {
        if (!caller_id || !call_key) return;
        const key = String(call_key).slice(0, 40);
        await pool.query(
          `UPDATE call_logs
             SET status = 'rejected', ended_at = COALESCE(ended_at, ?)
           WHERE call_key = ? AND (caller_id = ? OR callee_id = ?) AND ended_at IS NULL`,
          [nowSql(), key, user.id, user.id]
        );
        io.to(`user:${caller_id}`).emit("call:reject", {
          callee_id: user.id,
          call_key: key
        });
      } catch {
        socket.emit("call:error", { message: "Could not reject the call" });
      }
    });

    socket.on("call:end", async ({ peer_id, call_key }) => {
      try {
        if (!peer_id || !call_key) return;
        const key = String(call_key).slice(0, 40);
        await pool.query(
          `UPDATE call_logs
             SET status = CASE WHEN status = 'answered' THEN 'ended' ELSE 'missed' END,
                 ended_at = COALESCE(ended_at, ?)
           WHERE call_key = ? AND (caller_id = ? OR callee_id = ?) AND ended_at IS NULL`,
          [nowSql(), key, user.id, user.id]
        );
        io.to(`user:${peer_id}`).emit("call:end", {
          user_id: user.id,
          call_key: key
        });
      } catch {
        socket.emit("call:error", { message: "Could not end the call" });
      }
    });

    socket.on("call:signal", ({ peer_id, signal, call_key }) => {
      if (!peer_id || !call_key || !signal) return;
      io.to(`user:${peer_id}`).emit("call:signal", {
        user_id: user.id,
        signal,
        call_key: String(call_key).slice(0, 40)
      });
    });

    socket.on("call:recording", ({ peer_id, call_key }) => {
      if (!peer_id || !call_key) return;
      io.to(`user:${peer_id}`).emit("call:recording", {
        user_id: user.id,
        call_key: String(call_key).slice(0, 40)
      });
    });

    socket.on("disconnect", async () => {
      if (online.get(user.id) === socket.id) {
        online.delete(user.id);
        io.emit("presence:update", { userId: user.id, online: false });
      }
      if (io.sockets.adapter.rooms.has(`user:${user.id}`)) return;

      try {
        const [rows] = await pool.query(
          `SELECT call_key, caller_id, callee_id
             FROM call_logs
            WHERE (caller_id = ? OR callee_id = ?) AND ended_at IS NULL`,
          [user.id, user.id]
        );
        for (const row of rows) {
          const peer = row.caller_id === user.id ? row.callee_id : row.caller_id;
          io.to(`user:${peer}`).emit("call:end", {
            user_id: user.id,
            call_key: row.call_key
          });
          await pool.query(
            `UPDATE call_logs
                SET status = CASE WHEN status = 'answered' THEN 'ended' ELSE 'missed' END,
                    ended_at = COALESCE(ended_at, ?)
              WHERE call_key = ? AND ended_at IS NULL`,
            [nowSql(), row.call_key]
          );
        }
      } catch {
        /* best effort */
      }
    });
  });

  return io;
}
