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
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { WebSocketServer } = require("ws");

const SESSION_COOKIE = "cnx_sid";
const MAX_BODY = 2000;
const rnd = (p) => p + crypto.randomBytes(8).toString("hex");

/* users.photo has been written in two shapes over time ("avatars/x.jpg" from
   /portal/profile, "/uploads/avatars/x.jpg" from the avatar API). Both resolve
   to the one public URL the static route serves. */
function photoUrl(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return "/uploads/avatars/" + s.split("/").pop();
}

function photoDiskPath(v) {
  const url = photoUrl(v);
  if (!url) return "";
  return path.join(__dirname, "uploads", "avatars", path.basename(url));
}

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

  // ---- Avatar upload via multer ----
  const AVATAR_DIR = path.join(__dirname, "uploads", "avatars");
  if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
  const avatarStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
      cb(null, "avatar_" + req.user.id + ext);
    },
  });
  const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error("Only image files are allowed"));
    },
  }).single("avatar");

  // GET /api/profile — return current user profile info
  app.get("/api/profile", need, async (req, res) => {
    const user = req.user;
    res.json({
      ok: true,
      profile: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        phone: user.phone || "",
        role: user.role,
        photo: photoUrl(user.photo),
      },
    });
  });

  // POST /api/profile — update name and/or phone
  app.post("/api/profile", need, async (req, res) => {
    const user = req.user;
    const name = String(req.body.name || "").trim().slice(0, 120);
    const phone = String(req.body.phone || "").trim().slice(0, 30);
    if (!name) return res.status(400).json({ ok: false, error: "Name is required" });
    await q("UPDATE users SET full_name = ?, phone = ?, updated_at = NOW() WHERE id = ?", [name, phone, user.id]);
    res.json({ ok: true, name, phone });
  });

  // POST /api/profile/avatar — upload profile photo
  app.post("/api/profile/avatar", need, (req, res) => {
    uploadAvatar(req, res, async (err) => {
      if (err) return res.status(400).json({ ok: false, error: err.message });
      if (!req.file) return res.status(400).json({ ok: false, error: "No file uploaded" });
      const relPath = "/uploads/avatars/" + req.file.filename;
      await q("UPDATE users SET photo = ?, updated_at = NOW() WHERE id = ?", [relPath, req.user.id]);
      res.json({ ok: true, photo: relPath });
    });
  });

  // DELETE /api/profile/avatar — remove avatar
  app.delete("/api/profile/avatar", need, async (req, res) => {
    const user = req.user;
    const [rows] = await q("SELECT photo FROM users WHERE id = ? LIMIT 1", [user.id]);
    const disk = photoDiskPath(rows && rows[0] ? rows[0].photo : "");
    if (disk) {
      try { fs.unlinkSync(disk); } catch { /* already gone */ }
    }
    await q("UPDATE users SET photo = '', updated_at = NOW() WHERE id = ?", [user.id]);
    res.json({ ok: true });
  });

  // ---- Chat attachments (photos + documents) ----
  const CHAT_DIR = path.join(__dirname, "uploads", "chat");
  if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true });

  const chatStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CHAT_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safe = path.basename(file.originalname || "file", ext)
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .slice(0, 40);
      cb(null, "chat_" + Date.now().toString(36) + "_" + crypto.randomBytes(4).toString("hex") + (safe ? "_" + safe : "") + ext);
    },
  });
  const uploadChat = multer({
    storage: chatStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".webm", ".ogg", ".mp3", ".m4a", ".wav"];
      if (allowed.includes(ext)) return cb(null, true);
      cb(new Error("This file type is not allowed."));
    },
  }).single("file");

  app.post("/api/chat/upload", need, async (req, res) => {
    uploadChat(req, res, async (err) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "File must be 10 MB or smaller." : err.message || "Upload failed.";
        return res.status(422).json({ ok: false, error: msg });
      }
      if (!req.file) return res.status(400).json({ ok: false, error: "No file selected." });
      // Register the file immediately so only the uploader can open it until the
      // message is sent (message_id is filled in by the WebSocket handler).
      try {
        await q(
          "INSERT INTO chat_attachments (id, message_id, sender_id, original_name, stored_name, mime_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
          ["ca_" + crypto.randomBytes(10).toString("hex"), "", req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]
        );
      } catch (e) {
        console.error("chat attachment index failed:", e.message);
        try { fs.unlinkSync(req.file.path); } catch { /* already gone */ }
        return res.status(500).json({ ok: false, error: "Could not store the file. Please try again." });
      }
      res.json({
        ok: true,
        file: {
          original_name: req.file.originalname,
          stored_name: req.file.filename,
          mime_type: req.file.mimetype,
          size: req.file.size,
          url: "/api/chat/file/" + encodeURIComponent(req.file.filename),
        },
      });
    });
  });

  app.get("/api/chat/file/:name", need, async (req, res) => {
    const name = path.basename(req.params.name || "");
    const full = path.join(CHAT_DIR, name);
    if (!full.startsWith(CHAT_DIR)) return res.status(403).end();
    if (!fs.existsSync(full)) return res.status(404).end();
    // Privacy: only the uploader, the sender or the recipient of that message
    // may open an attachment. Being signed in is not enough.
    try {
      const [rows] = await q(
        `SELECT a.sender_id, m.sender_id AS m_sender, m.recipient_id, m.deleted_at
           FROM chat_attachments a
           LEFT JOIN chat_messages m ON m.id = a.message_id
          WHERE a.stored_name = ? LIMIT 1`,
        [name]
      );
      if (!rows.length) return res.status(404).end();
      const r = rows[0];
      if (r.deleted_at) return res.status(404).end();
      const allowed =
        r.sender_id === req.user.id || r.m_sender === req.user.id || r.recipient_id === req.user.id;
      if (!allowed) return res.status(403).end();
    } catch (e) {
      return res.status(500).end();
    }
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(full);
  });

  async function contactList(user) {
    let rows = [];
    if (user.role === "student") {
      [rows] = await q(
        `SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.photo
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
          "SELECT id, full_name, role, email, photo FROM users WHERE role = 'teacher' AND status = 'active' ORDER BY full_name"
        );
      }
    } else {
      [rows] = await q(
        `SELECT DISTINCT u.id, u.full_name, u.role, u.email, u.photo
           FROM users u
           JOIN enrollments e ON e.user_id = u.id
          WHERE u.role = 'student' AND u.status = 'active' AND e.status <> 'rejected'
            AND e.course_title IN (SELECT course_title FROM teacher_courses WHERE teacher_id = ?)
          ORDER BY u.full_name`,
        [user.id]
      );
      if (!rows.length) {
        [rows] = await q(
          "SELECT id, full_name, role, email, photo FROM users WHERE role = 'student' AND status = 'active' ORDER BY full_name"
        );
      }
    }
    return rows;
  }

  app.get("/portal/messages", need, async (req, res) => {
    /* Calls need a secure origin, so the chat page is served over HTTPS only.
       Behind Traefik, req.protocol follows X-Forwarded-Proto (trust proxy is on). */
    const proto = String(
      req.headers["x-forwarded-proto"] || req.protocol || "http"
    ).split(",")[0].trim().toLowerCase();
    const host = req.headers.host || "";
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    if (proto !== "https" && !isLocal && req.query.secure !== "1") {
      const sep = req.originalUrl.indexOf("?") === -1 ? "?" : "&";
      return res.redirect(302, "https://" + host + req.originalUrl + sep + "secure=1");
    }
    res.set("Cache-Control", "no-store, must-revalidate");
    const user = req.user;
    const contacts = await contactList(user);
    const [recent] = await q(
      `SELECT m.sender_id, m.recipient_id,
              CASE WHEN m.deleted_at IS NULL THEN m.body ELSE 'Message deleted' END AS body,
              (SELECT COUNT(*) FROM chat_attachments ca WHERE ca.message_id = m.id) AS att_n,
              m.created_at, m.read_at
         FROM chat_messages m
         LEFT JOIN chat_hidden h ON h.message_id = m.id AND h.user_id = ?
        WHERE (m.sender_id = ? OR m.recipient_id = ?) AND h.message_id IS NULL
        ORDER BY m.created_at DESC LIMIT 400`,
      [user.id, user.id, user.id]
    );
    const [unread] = await q(
      `SELECT m.sender_id, COUNT(*) AS n
         FROM chat_messages m
         LEFT JOIN chat_hidden h ON h.message_id = m.id AND h.user_id = ?
        WHERE m.recipient_id = ? AND m.read_at IS NULL AND h.message_id IS NULL
        GROUP BY m.sender_id`,
      [user.id, user.id]
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
      me: { id: user.id, name: user.full_name, role: user.role, photo: photoUrl(user.photo) },
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.full_name,
        role: c.role,
        photo: photoUrl(c.photo),
        unread: unreadBy[c.id] || 0,
        last: lastBy[c.id]
          ? (String(lastBy[c.id].body || "").trim() ||
             (Number(lastBy[c.id].att_n) ? "Photo or document" : ""))
              .slice(0, 70)
          : "",
        at: lastBy[c.id] ? lastBy[c.id].created_at : null,
      })),
      secure: req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https",
    };
    const json = JSON.stringify(data).replace(/</g, "\\u003c");

    const myPhoto = photoUrl(user.photo);
    const myInitials = (user.full_name || "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
    const avatarHtml = myPhoto
      ? `<img src="${esc(myPhoto)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<span style="font-size:14px;font-weight:700;color:var(--acc)">${esc(myInitials)}</span>`;

    const body = `
      <div class="msg-shell">
        <div class="msg-side">
          <div class="msg-my-profile" id="myProfileBar" title="Edit my profile" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #1e2a44;background:#0b1220">
            <div id="myAvatarThumb" style="width:36px;height:36px;border-radius:50%;background:#1a2540;border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
              ${avatarHtml}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="myNameLabel">${esc(user.full_name)}</div>
              <div style="font-size:11px;color:var(--acc)">${esc(user.role === "teacher" ? "Teacher" : "Student")} &middot; <span style="color:#6b7a99">Edit profile</span></div>
            </div>
            <i class="fa-solid fa-pen" style="font-size:11px;color:#6b7a99"></i>
          </div>
          <div class="msg-search"><input id="mq" placeholder="Search people" autocomplete="off"></div>
          <div id="people" class="people"></div>
        </div>
        <div class="msg-main">
          <div class="msg-head">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div id="peerAvatar" aria-hidden="true" style="width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:#1a2540;border:2px solid #1e2a44;display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--acc);font-weight:700"></div>
              <div style="min-width:0">
              <strong id="peerName">Select a person</strong>
              <div id="peerSub" class="muted" style="font-size:11px">${totalUnread ? totalUnread + " unread message(s)" : "Chat and call"}</div>
              </div>
            </div>
            <div class="row" style="gap:6px">
              <button type="button" class="btn ghost sm" id="btnAudio" disabled title="Voice call"><i class="fa-solid fa-phone"></i></button>
              <button type="button" class="btn ghost sm" id="btnVideo" disabled title="Video call"><i class="fa-solid fa-video"></i></button>
              <button type="button" class="btn ghost sm" id="btnMicTest" title="Test microphone"><i class="fa-solid fa-microphone-lines"></i></button>
            </div>
          </div>
          <div id="thread" class="thread"><p class="empty">Choose a ${user.role === "student" ? "teacher" : "student"} to start chatting.</p></div>
          <div id="attachPreview" class="attach-preview" style="display:none"></div>
          <div id="emojiPanel" class="emoji-panel" aria-hidden="true"></div>
          <div id="recBar" class="rec-bar" style="display:none">
            <span class="rec-dot"></span>
            <span>Recording</span>
            <span id="recTime">0:00</span>
            <button type="button" class="btn ghost sm" id="recCancel">Cancel</button>
            <button type="button" class="btn primary sm" id="recSend"><i class="fa-solid fa-paper-plane"></i> Send</button>
          </div>
          <form id="sendForm" class="sendbar">
            <input type="file" id="filePick" style="display:none" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv">
            <button type="button" class="btn ghost sm" id="attachBtn" disabled title="Attach photo or document"><i class="fa-solid fa-paperclip"></i></button>
            <button type="button" class="btn ghost sm" id="emojiBtn" disabled title="Emoji"><i class="fa-regular fa-face-smile"></i></button>
            <input id="msgIn" placeholder="Write a message" autocomplete="off" maxlength="${MAX_BODY}" disabled>
            <button type="button" class="btn ghost sm" id="voiceBtn" disabled title="Record voice message"><i class="fa-solid fa-microphone"></i></button>
            <button class="btn primary sm" type="submit" id="sendBtn" disabled><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </div>

      <!-- Profile Modal -->
      <div class="modal" id="profileModal">
        <div class="modal-box" style="max-width:440px">
          <h3 style="margin-bottom:16px"><i class="fa-solid fa-user-pen"></i> My Profile</h3>
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:20px">
            <div id="profileAvatarWrap" style="width:90px;height:90px;border-radius:50%;background:#1a2540;border:3px solid var(--acc);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;cursor:pointer" title="Click to change photo">
              <div id="profileAvatarInner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">
                ${myPhoto
                  ? `<img src="${esc(myPhoto)}" id="profileAvatarImg" alt="avatar" style="width:100%;height:100%;object-fit:cover">`
                  : `<span id="profileAvatarInitials" style="font-size:28px;font-weight:700;color:var(--acc)">${esc(myInitials)}</span>`}
              </div>
              <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.55);text-align:center;font-size:10px;padding:3px 0;pointer-events:none"><i class="fa-solid fa-camera"></i></div>
            </div>
            <input type="file" id="profileAvatarFile" accept="image/*" style="display:none">
            <div style="display:flex;gap:8px">
              <button type="button" class="btn ghost sm" id="profileChangePhoto"><i class="fa-solid fa-camera"></i> Change Photo</button>
              <button type="button" class="btn ghost sm" id="profileRemovePhoto" style="color:#e74c3c"><i class="fa-solid fa-trash"></i> Remove</button>
            </div>
            <div id="profileAvatarStatus" style="font-size:12px;color:var(--acc);min-height:16px"></div>
          </div>
          <form id="profileForm">
            <label style="font-size:12px;color:#6b7a99;display:block;margin-bottom:4px">Full Name</label>
            <input type="text" id="profileName" class="form-control" maxlength="120" placeholder="Your full name" required style="width:100%;margin-bottom:12px;padding:8px 12px;background:#1a2540;border:1px solid #1e2a44;border-radius:6px;color:#e0e8f4;font-size:14px">
            <label style="font-size:12px;color:#6b7a99;display:block;margin-bottom:4px">Phone (optional)</label>
            <input type="text" id="profilePhone" class="form-control" maxlength="30" placeholder="e.g. +92 300 1234567" style="width:100%;margin-bottom:16px;padding:8px 12px;background:#1a2540;border:1px solid #1e2a44;border-radius:6px;color:#e0e8f4;font-size:14px">
            <label style="font-size:12px;color:#6b7a99;display:block;margin-bottom:4px">Email</label>
            <input type="text" id="profileEmail" disabled style="width:100%;margin-bottom:16px;padding:8px 12px;background:#0f1a2e;border:1px solid #1e2a44;border-radius:6px;color:#6b7a99;font-size:14px;cursor:not-allowed">
            <div id="profileSaveStatus" style="font-size:12px;min-height:18px;margin-bottom:10px;color:var(--acc)"></div>
            <div class="row" style="gap:8px;justify-content:flex-end">
              <button type="button" class="btn ghost sm" id="profileClose">Cancel</button>
              <button type="submit" class="btn primary sm" id="profileSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <div class="modal" id="incoming">
        <div class="modal-box" style="max-width:380px;text-align:center">
          <h3 style="margin-bottom:6px"><i class="fa-solid fa-phone-volume"></i> Incoming call</h3>
          <div id="incAvatar" aria-hidden="true" style="width:64px;height:64px;margin:14px auto 8px;border-radius:50%;background:#1a2540;border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--acc);font-size:20px;font-weight:700"></div>
          <p class="muted" id="incWho">Someone is calling</p>
          <div class="row mt" style="justify-content:center">
            <button type="button" class="btn primary" id="incAccept"><i class="fa-solid fa-phone"></i> Accept</button>
            <button type="button" class="btn danger" id="incReject"><i class="fa-solid fa-phone-slash"></i> Reject</button>
          </div>
        </div>
      </div>

      <div class="modal" id="micTest">
        <div class="modal-box" style="max-width:380px">
          <h3 style="margin-bottom:6px"><i class="fa-solid fa-microphone-lines"></i> Microphone test</h3>
          <p class="muted" id="micDev" style="font-size:12px;word-break:break-word"></p>
          <label class="muted" style="font-size:12px;display:block;margin:8px 0 4px">Microphone</label>
          <select id="micSel" style="width:100%;margin-bottom:10px"></select>
          <div style="height:12px;background:#0b1220;border:1px solid #1e2a44;border-radius:6px;overflow:hidden;margin:12px 0">
            <div id="micBar" style="height:100%;width:0%;background:var(--acc);transition:width .08s linear"></div>
          </div>
          <p id="micMsg" class="muted" style="font-size:12px;min-height:18px">Say something...</p>
          <button type="button" class="btn" id="micClose">Close</button>
        </div>
      </div>

      <div class="callov" id="callov">
        <video id="remoteV" autoplay playsinline></video>
        <video id="localV" autoplay playsinline muted></video>
        <div class="call-avatar-big" id="callAvatarBig" aria-hidden="true">
          <div class="av" id="callAvatarImg"></div>
          <div class="av-name" id="callAvatarName"></div>
        </div>
        <div class="callbar">
          <div id="callPeerAvatar" aria-hidden="true" style="width:34px;height:34px;border-radius:50%;background:#1a2540;border:2px solid var(--acc);display:flex;align-items:center;justify-content:center;overflow:hidden;color:var(--acc);font-weight:700"></div>
          <strong id="callPeerName"></strong>
          <span id="callStatus">Connecting...</span>
          <span id="callNet" class="muted" style="font-size:11px"></span>
          <span id="callHealth" style="font-size:11px;color:#f5b301"></span>
          <button type="button" class="btn sm" id="btnMute" title="Mute microphone" style="display:none"><i class="fa-solid fa-microphone"></i></button>
          <button type="button" class="btn danger sm" id="endCall"><i class="fa-solid fa-phone-slash"></i> End</button>
        </div>
        <button type="button" class="btn primary" id="sndFix"
          style="display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5;padding:14px 22px;font-size:15px">
          <i class="fa-solid fa-volume-high"></i> Tap to hear the other person
        </button>
      </div>

      <script>window.CNX_CHAT = ${json};</script>
      <script src="/js/messages.js?v=20261026-private"></script>`;

    res.send(
      core.shell(user, "messages", "Messages", "Chat and call your " + (user.role === "student" ? "teachers" : "students") + " in real time.", body)
    );
  });

  app.get("/api/chat/contacts", need, async (req, res) => {
    const rows = await contactList(req.user);
    res.json({ ok: true, contacts: rows.map((c) => ({ id: c.id, name: c.full_name, role: c.role, photo: photoUrl(c.photo) })) });
  });

  app.get("/api/chat/history", need, async (req, res) => {
    const me = req.user.id;
    const withId = String(req.query.with || "");
    if (!withId) return res.status(400).json({ ok: false, error: "with is required" });
    const before = String(req.query.before || "");
    const params = [me, me, withId, withId, me];
    let sql = `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.delivered_at, m.read_at, m.edited_at, m.deleted_at
                 FROM chat_messages m
                 LEFT JOIN chat_hidden h ON h.message_id = m.id AND h.user_id = ?
                WHERE ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
                  AND h.message_id IS NULL`;
    if (before) {
      sql += " AND m.created_at < ?";
      params.push(before.replace("T", " ").slice(0, 19));
    }
    sql += " ORDER BY m.created_at DESC LIMIT 60";
    const [rows] = await q(sql, params);
    const ids = rows.map((r) => r.id);
    let atts = [];
    if (ids.length) {
      try {
        const [ar] = await q(
          `SELECT id, message_id, original_name, stored_name, mime_type, file_size FROM chat_attachments WHERE message_id IN (${ids.map(() => "?").join(",")})`,
          ids
        );
        atts = ar || [];
      } catch (e) {}
    }
    const byMsg = {};
    for (const a of atts) {
      if (!byMsg[a.message_id]) byMsg[a.message_id] = [];
      byMsg[a.message_id].push({
        original_name: a.original_name,
        stored_name: a.stored_name,
        mime_type: a.mime_type,
        size: a.file_size,
        url: "/api/chat/file/" + encodeURIComponent(a.stored_name),
      });
    }
    const messages = rows
      .reverse()
      .map((m) => ({ ...m, attachments: byMsg[m.id] || [] }));
    res.json({ ok: true, messages });
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
        const att = m.attachment || null;
        if (!to || (!body && !att)) return;
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
        if (att && att.stored_name) {
          try {
            const [upd] = await pool.query(
              "UPDATE chat_attachments SET message_id = ? WHERE stored_name = ? AND sender_id = ? AND message_id = ''",
              [id, att.stored_name, me.id]
            );
            if (!upd.affectedRows) {
              await pool.query(
                "INSERT INTO chat_attachments (id, message_id, sender_id, original_name, stored_name, mime_type, file_size, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
                [rnd("ca_"), id, me.id, att.original_name || "", att.stored_name, att.mime_type || null, Number(att.size || 0)]
              );
            }
          } catch (e) {
            /* ignore */
          }
        }
        const payload = {
          type: "msg",
          id,
          from: me.id,
          fromName: me.full_name,
          to,
          body,
          at: new Date().toISOString(),
          attachments: att && att.stored_name ? [att] : [],
        };
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

      if (m.type === "edit") {
        const id = String(m.id || "");
        const body = String(m.body || "").trim().slice(0, MAX_BODY);
        if (!id || !body) return;
        const [rows] = await pool.query(
          "SELECT sender_id, recipient_id, deleted_at FROM chat_messages WHERE id = ? LIMIT 1",
          [id]
        );
        if (!rows.length) return;
        const row = rows[0];
        if (row.sender_id !== me.id || row.deleted_at) return;
        await pool.query("UPDATE chat_messages SET body = ?, edited_at = NOW() WHERE id = ?", [body, id]);
        const ev = { type: "msg-edit", id, body, from: me.id, edited_at: new Date().toISOString() };
        sendTo(me.id, ev);
        sendTo(row.recipient_id, ev);
        return;
      }

      if (m.type === "del") {
        const id = String(m.id || "");
        if (!id) return;
        const [rows] = await pool.query(
          "SELECT sender_id, recipient_id, deleted_at FROM chat_messages WHERE id = ? LIMIT 1",
          [id]
        );
        if (!rows.length) return;
        const row = rows[0];
        const mine = row.sender_id === me.id;
        if (!mine && row.recipient_id !== me.id) return;
        if (mine && m.scope !== "me") {
          if (!row.deleted_at) {
            await pool.query("UPDATE chat_messages SET body = '', deleted_at = NOW() WHERE id = ?", [id]);
            // Remove any attachments from disk + DB so a deleted message can no
            // longer be downloaded through a saved link.
            try {
              const chatDir = path.join(__dirname, "uploads", "chat");
              const [atts] = await pool.query(
                "SELECT stored_name FROM chat_attachments WHERE message_id = ?",
                [id]
              );
              for (const a of atts) {
                try { fs.unlinkSync(path.join(chatDir, path.basename(a.stored_name))); } catch { /* already gone */ }
              }
              if (atts.length) await pool.query("DELETE FROM chat_attachments WHERE message_id = ?", [id]);
            } catch { /* best effort */ }
          }
          const ev = { type: "msg-del", id, from: me.id };
          sendTo(me.id, ev);
          sendTo(row.recipient_id, ev);
        } else {
          await pool.query(
            "INSERT IGNORE INTO chat_hidden (message_id, user_id, created_at) VALUES (?,?,NOW())",
            [id, me.id]
          );
          sendTo(me.id, { type: "msg-hide", id, from: me.id });
        }
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
          if (c) c.answered = true;
          try {
            await pool.query(
              "UPDATE call_logs SET status = 'answered', answered_at = COALESCE(answered_at, NOW()) WHERE call_key = ? AND ended_at IS NULL",
              [callId]
            );
          } catch {
            /* ignore */
          }
        } else if (action === "reject" || action === "end") {
          const c = calls.get(callId);
          try {
            await pool.query(
              `UPDATE call_logs
                  SET status = CASE WHEN status = 'answered' THEN 'ended' WHEN ? = 'reject' THEN 'rejected' ELSE 'missed' END,
                      ended_at = NOW()
                WHERE call_key = ? AND ended_at IS NULL`,
              [action, callId]
            );
          } catch {
            /* ignore */
          }
          if (c) calls.delete(callId);
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
          try {
            await pool.query("UPDATE call_logs SET ended_at = NOW() WHERE call_key = ? AND ended_at IS NULL", [callId]);
          } catch {
            /* ignore */
          }
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
            const pool = getPool();
            if (pool) {
              pool
                .query(
                  "UPDATE call_logs SET status = CASE WHEN status = 'answered' THEN 'ended' ELSE 'missed' END, ended_at = NOW() WHERE call_key = ? AND ended_at IS NULL",
                  [id]
                )
                .catch(() => {});
            }
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
