/**
 * CyberNexa realtime layer.
 *
 *  - WebSocket  : 1:1 chat, presence, typing and call signalling
 *  - WebRTC     : peer-to-peer audio / video between a student and a teacher
 *
 * HTTP routes (mounted by portal.js):
 *    GET /portal/messages          chat UI
 *    GET /api/chat/history         message history with one person
 *    GET /api/chat/contacts        contact list (JSON)
 *
 * The WebSocket server is attached to the same HTTP server, path /ws,
 * authenticated with the normal portal session cookie (cnx_sid).
 */
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const SESSION_COOKIE = "cnx_sid";
const MAX_BODY = 2000;
const rnd = (p) => p + crypto.randomBytes(8).toString("hex");

const clients = new Map(); // userId -> Set(ws)
const calls = new Map(); // callId -> { id, caller, callee, kind, answered }

function cookieOf(header, name) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i < 0) return;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out[name] || "";
}

function sendTo(userId, payload) {
  const set = clients.get(String(userId));
  if (!set || !set.size) return false;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    try {
      ws.send(data);
    } catch {
      /* socket closed */
    }
  }
  return true;
}

function broadcast(payload, exceptId = "") {
  const data = JSON.stringify(payload);
  for (const [uid, set] of clients) {
    if (uid === String(exceptId)) continue;
    for (const ws of set) {
      try {
        ws.send(data);
      } catch {
        /* ignore */
      }
    }
  }
}

function online() {
  return [...clients.keys()];
}

// ---------------------------------------------------------------- HTTP side
function mount(app, core) {
  const q = core.q;
  const esc = core.esc;
  const need = core.requireUser("student", "teacher");

  async function contactList(user) {
    let rows = [];
    if (user.role === "student") {
      [rows] = await q(
        `SELECT DISTINCT u.id, u.full_name, u.role, u.email
           FROM users u
           JOIN teacher_courses tc ON tc.teacher_id = u.id
          WHERE u.role = 'teacher' AND u.status = 'active'
            AND tc.course_title IN (
              SELECT course_title FROM enrollments
               WHERE user_id = ? AND status <> 'rejected' AND course_title <> ''
            )
          ORDER BY u.full_name`,
        [user.id]
      );
      if (!rows.length) {
        [rows] = await q(
          "SELECT id, full_name, role, email FROM users WHERE role = 'teacher' AND status = 'active' ORDER BY full_name"
        );
      }
    } else {
      [rows] = await q(
        `SELECT DISTINCT u.id, u.full_name, u.role, u.email
           FROM users u
           JOIN enrollments e ON e.user_id = u.id
          WHERE u.role = 'student' AND u.status = 'active' AND e.status <> 'rejected'
            AND e.course_title IN (SELECT course_title FROM teacher_courses WHERE teacher_id = ?)
          ORDER BY u.full_name`,
        [user.id]
      );
      if (!rows.length) {
        [rows] = await q(
          "SELECT id, full_name, role, email FROM users WHERE role = 'student' AND status = 'active' ORDER BY full_name"
        );
      }
    }
    return rows;
  }

  app.get("/portal/messages", need, async (req, res) => {
    const user = req.user;
    const contacts = await contactList(user);
    const [recent] = await q(
      `SELECT sender_id, recipient_id, body, created_at, read_at
         FROM chat_messages
        WHERE sender_id = ? OR recipient_id = ?
        ORDER BY created_at DESC LIMIT 400`,
      [user.id, user.id]
    );
    const [unread] = await q(
      `SELECT sender_id, COUNT(*) AS n FROM chat_messages
        WHERE recipient_id = ? AND read_at IS NULL GROUP BY sender_id`,
      [user.id]
    );

    const lastBy = {};
    for (const m of recent) {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!lastBy[other]) lastBy[other] = m;
    }
    const unreadBy = {};
    for (const r of unread) unreadBy[r.sender_id] = Number(r.n);
    const totalUnread = unread.reduce((a, r) => a + Number(r.n), 0);

    const data = {
      me: { id: user.id, name: user.full_name, role: user.role },
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.full_name,
        role: c.role,
        unread: unreadBy[c.id] || 0,
        last: lastBy[c.id] ? String(lastBy[c.id].body || "").slice(0, 70) : "",
        at: lastBy[c.id] ? lastBy[c.id].created_at : null,
      })),
      secure: req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https",
    };
    const json = JSON.stringify(data).replace(/</g, "\\u003c");

    const body = `
      <div class="msg-shell">
        <div class="msg-side">
          <div class="msg-search"><input id="mq" placeholder="Search people" autocomplete="off"></div>
          <div id="people" class="people"></div>
        </div>
        <div class="msg-main">
          <div class="msg-head">
            <div>
              <strong id="peerName">Select a person</strong>
              <div id="peerSub" class="muted" style="font-size:11px">${totalUnread ? totalUnread + " unread message(s)" : "Chat and call"}</div>
            </div>
            <div class="row" style="gap:6px">
              <button type="button" class="btn ghost sm" id="btnAudio" disabled title="Voice call"><i class="fa-solid fa-phone"></i></button>
              <button type="button" class="btn ghost sm" id="btnVideo" disabled title="Video call"><i class="fa-solid fa-video"></i></button>
            </div>
          </div>
          <div id="thread" class="thread"><p class="empty">Choose a ${user.role === "student" ? "teacher" : "student"} to start chatting.</p></div>
          <form id="sendForm" class="sendbar">
            <input id="msgIn" placeholder="Write a message" autocomplete="off" maxlength="${MAX_BODY}" disabled>
            <button class="btn primary sm" type="submit" id="sendBtn" disabled><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </div>

      <div class="modal" id="incoming">
        <div class="modal-box" style="max-width:380px;text-align:center">
          <h3 style="margin-bottom:6px"><i class="fa-solid fa-phone-volume"></i> Incoming call</h3>
          <p class="muted" id="incWho">Someone is calling</p>
          <div class="row mt" style="justify-content:center">
            <button type="button" class="btn primary" id="incAccept"><i class="fa-solid fa-phone"></i> Accept</button>
            <button type="button" class="btn danger" id="incReject"><i class="fa-solid fa-phone-slash"></i> Reject</button>
          </div>
        </div>
      </div>

      <div class="callov" id="callov">
        <video id="remoteV" autoplay playsinline></video>
        <video id="localV" autoplay playsinline muted></video>
        <div class="callbar">
          <span id="callStatus">Connecting...</span>
          <button type="button" class="btn danger sm" id="endCall"><i class="fa-solid fa-phone-slash"></i> End</button>
        </div>
      </div>

      <script>window.CNX_CHAT = ${json};</script>
      <script src="/js/messages.js?v=20261022"></script>`;

    res.send(
      core.shell(user, "messages", "Messages", "Chat and call your " + (user.role === "student" ? "teachers" : "students") + " in real time.", body)
    );
  });

  app.get("/api/chat/contacts", need, async (req, res) => {
    const rows = await contactList(req.user);
    res.json({ ok: true, contacts: rows.map((c) => ({ id: c.id, name: c.full_name, role: c.role })) });
  });

  app.get("/api/chat/history", need, async (req, res) => {
    const me = req.user.id;
    const withId = String(req.query.with || "");
    if (!withId) return res.status(400).json({ ok: false, error: "with is required" });
    const before = String(req.query.before || "");
    const params = [me, withId, withId, me];
    let sql = `SELECT id, sender_id, recipient_id, body, created_at, delivered_at, read_at
                 FROM chat_messages
                WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))`;
    if (before) {
      sql += " AND created_at < ?";
      params.push(before.replace("T", " ").slice(0, 19));
    }
    sql += " ORDER BY created_at DESC LIMIT 60";
    const [rows] = await q(sql, params);
    res.json({ ok: true, messages: rows.reverse() });
  });

  app.get("/api/chat/unread", need, async (req, res) => {
    const [rows] = await q(
      "SELECT COUNT(*) AS n FROM chat_messages WHERE recipient_id = ? AND read_at IS NULL",
      [req.user.id]
    );
    res.json({ ok: true, unread: Number(rows[0].n || 0) });
  });
}

// ----------------------------------------------------------- WebSocket side
function attach(server, getPool) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  async function userFromCookie(header) {
    const sid = cookieOf(header, SESSION_COOKIE);
    if (!sid) return null;
    const pool = getPool();
    if (!pool) return null;
    try {
      const [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.role, u.status
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = ? AND s.expires_at > NOW() LIMIT 1`,
        [sid]
      );
      if (!rows.length) return null;
      if (!["student", "teacher"].includes(rows[0].role)) return null;
      if (rows[0].status === "suspended" || rows[0].status === "rejected") return null;
      return rows[0];
    } catch {
      return null;
    }
  }

  server.on("upgrade", (req, socket, head) => {
    let pathname = "";
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {
      pathname = "";
    }
    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }
    userFromCookie(req.headers.cookie)
      .then((user) => {
        if (!user) {
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          ws.user = user;
          wss.emit("connection", ws, req);
        });
      })
      .catch(() => socket.destroy());
  });

  wss.on("connection", async (ws) => {
    const me = ws.user;
    ws.isAlive = true;
    ws.hits = 0;
    ws.hitAt = Date.now();
    if (!clients.has(me.id)) clients.set(me.id, new Set());
    clients.get(me.id).add(ws);

    try {
      ws.send(JSON.stringify({ type: "ready", me: me.id, online: online() }));
    } catch {
      /* ignore */
    }
    broadcast({ type: "presence", userId: me.id, online: true, name: me.full_name }, me.id);

    // Anything queued while this user was offline is now delivered.
    try {
      const pool = getPool();
      if (pool) {
        const [r] = await pool.query(
          "UPDATE chat_messages SET delivered_at = NOW() WHERE recipient_id = ? AND delivered_at IS NULL",
          [me.id]
        );
        if (r.affectedRows) {
          const [senders] = await pool.query(
            "SELECT DISTINCT sender_id FROM chat_messages WHERE recipient_id = ? AND delivered_at IS NOT NULL",
            [me.id]
          );
          for (const row of senders) sendTo(row.sender_id, { type: "delivered", by: me.id });
        }
      }
    } catch {
      /* ignore */
    }

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (raw) => {
      try {
      // simple flood guard: 30 messages / second
      const now = Date.now();
      if (now - ws.hitAt > 1000) {
        ws.hitAt = now;
        ws.hits = 0;
      }
      if (++ws.hits > 30) return;

      let m;
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!m || typeof m.type !== "string") return;
      const pool = getPool();
      if (!pool) return;

      if (m.type === "msg") {
        const to = String(m.to || "");
        const body = String(m.body || "").trim().slice(0, MAX_BODY);
        if (!to || !body) return;
        const [ok] = await pool.query(
          "SELECT id FROM users WHERE id = ? AND role IN ('student','teacher') AND status = 'active' LIMIT 1",
          [to]
        );
        if (!ok.length) return;
        const id = rnd("msg_");
        const isOnline = !!(clients.get(to) && clients.get(to).size);
        await pool.query(
          "INSERT INTO chat_messages (id, sender_id, recipient_id, body, created_at, delivered_at) VALUES (?,?,?,?,NOW(),?)",
          [id, me.id, to, body, isOnline ? new Date() : null]
        );
        const payload = { type: "msg", id, from: me.id, fromName: me.full_name, to, body, at: new Date().toISOString() };
        sendTo(me.id, { ...payload, self: true, tempId: m.tempId || null, delivered: isOnline });
        sendTo(to, payload);
        return;
      }

      if (m.type === "read") {
        const from = String(m.from || "");
        if (!from) return;
        const [r] = await pool.query(
          "UPDATE chat_messages SET read_at = NOW(), delivered_at = COALESCE(delivered_at, NOW()) WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL",
          [me.id, from]
        );
        sendTo(from, { type: "read", by: me.id, count: r.affectedRows || 0, at: new Date().toISOString() });
        return;
      }

      if (m.type === "typing") {
        const to = String(m.to || "");
        if (to) sendTo(to, { type: "typing", from: me.id, on: !!m.on });
        return;
      }

      if (m.type === "signal") {
        const to = String(m.to || "");
        const action = String(m.action || "");
        const callId = String(m.callId || "");
        if (!to || !action) return;
        const allowed = ["offer", "answer", "ice", "reject", "end"];
        if (!allowed.includes(action)) return;

        if (action === "offer") {
          calls.set(callId, { id: callId, caller: me.id, callee: to, kind: m.kind === "video" ? "video" : "audio", answered: false });
          try {
            await pool.query(
              "INSERT INTO call_logs (id, call_key, caller_id, callee_id, kind, status, started_at) VALUES (?,?,?,?,?,'missed',NOW())",
              [rnd("call_"), callId, me.id, to, m.kind === "video" ? "video" : "audio"]
            );
          } catch {
            /* ignore */
          }
        } else if (action === "answer") {
          const c = calls.get(callId);
          if (c) {
            c.answered = true;
            try {
              await pool.query("UPDATE call_logs SET status = 'answered' WHERE call_key = ?", [callId]);
            } catch {
              /* ignore */
            }
          }
        } else if (action === "reject" || action === "end") {
          const c = calls.get(callId);
          if (c) {
            try {
              await pool.query("UPDATE call_logs SET status = ?, ended_at = NOW() WHERE call_key = ? AND ended_at IS NULL", [
                action === "reject" ? "rejected" : c.answered ? "ended" : "missed",
                callId,
              ]);
            } catch {
              /* ignore */
            }
            calls.delete(callId);
          }
        }

        const delivered = sendTo(to, {
          type: "signal",
          action,
          from: me.id,
          fromName: me.full_name,
          callId,
          kind: m.kind === "video" ? "video" : "audio",
          payload: m.payload || null,
        });
        if (!delivered && action === "offer") {
          sendTo(me.id, { type: "signal", action: "offline", from: to, callId });
        }
        return;
      }
      } catch (e) {
        /* never let a bad frame take the server down */
      }
    });

    ws.on("close", () => {
      const set = clients.get(me.id);
      if (set) {
        set.delete(ws);
        if (!set.size) clients.delete(me.id);
      }
      if (!clients.has(me.id)) {
        broadcast({ type: "presence", userId: me.id, online: false }, me.id);
        for (const [id, c] of calls) {
          if (c.caller === me.id || c.callee === me.id) {
            sendTo(c.caller === me.id ? c.callee : c.caller, {
              type: "signal",
              action: "end",
              from: me.id,
              callId: id,
            });
            calls.delete(id);
          }
        }
      }
    });
  });

  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        try {
          ws.terminate();
        } catch {
          /* ignore */
        }
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30000);
  beat.unref && beat.unref();

  wss.on("close", () => clearInterval(beat));
  return wss;
}

module.exports = { mount, attach };
