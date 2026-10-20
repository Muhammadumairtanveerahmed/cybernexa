/**
 * CyberNexa Solutions — Node.js (Express) Backend
 * Run: node server.js
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------- .env loader (no external dependency) ----------
const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const dns = require("dns");
const mysql = require("mysql2/promise");
const nodemailer = require("nodemailer");
const portal = require("./portal");
const mountPortalAdmin = require("./portal-admin");
const mountPortalAcademics = require("./portal-academics");
const mountPortalCampus = require("./portal-campus");

const app = express();
const PORT = process.env.PORT || 3000;

// Behind the k3s ingress (traefik) — trust one proxy hop so req.ip is the real client IP.
app.set("trust proxy", 1);

const DATA_FILE = path.join(__dirname, "data", "messages.json");

// ---------- Middleware ----------
app.use(express.json({ limit: "10kb" }));

// Resolve the signed-in portal user (student/teacher) for /portal and /api routes — must run early.
app.use(portal.attachUser);

// Basic security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

// Simple rate limit: max 10 requests / minute / IP on contact & enroll APIs
const hits = new Map();
app.use(["/api/contact", "/api/enroll", "/api/subscribe"], (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (list.length >= 10) {
    return res.status(429).json({ ok: false, msg: "Too many requests, please wait a minute" });
  }
  list.push(now);
  hits.set(ip, list);
  next();
});

// ---------- Helpers ----------
function readMessages() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeMessages(messages) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), "utf-8");
}

// ---------- MySQL storage (falls back to JSON file when unavailable) ----------
const DB_CFG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cybernexa",
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true, // return "YYYY-MM-DD HH:MM:SS" strings for DATETIME
};

let pool = null; // null means JSON file mode
let storageMode = "JSON file";

async function initDb() {
  const { host, port, user, password, database } = DB_CFG;
  try {
    // Connect without a database first so we can create it
    const conn = await mysql.createConnection({ host, port, user, password });
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.end();

    pool = mysql.createPool(DB_CFG);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(40) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(190) NOT NULL,
        phone VARCHAR(30) DEFAULT '',
        message TEXT NOT NULL,
        \`read\` TINYINT(1) NOT NULL DEFAULT 0,
        ip VARCHAR(45) DEFAULT '',
        created_at DATETIME NOT NULL,
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // One-time migration: import existing JSON messages if the table is empty
    const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM messages");
    const jsonMsgs = readMessages();
    if (n === 0 && jsonMsgs.length > 0) {
      for (const m of jsonMsgs) {
        await pool.query(
          "INSERT INTO messages (id, name, email, phone, message, `read`, ip, created_at) VALUES (?,?,?,?,?,?,?,?)",
          [m.id, m.name, m.email, m.phone || "", m.message, m.read ? 1 : 0, m.ip || "", m.date]
        );
      }
      console.log(`  Migrated ${jsonMsgs.length} message(s) from JSON to MySQL`);
    }

    // Course catalog table + one-time migration from JSON
    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id VARCHAR(40) PRIMARY KEY,
        title VARCHAR(190) NOT NULL,
        category VARCHAR(80) NOT NULL,
        tag VARCHAR(60) DEFAULT '',
        short_desc VARCHAR(240) DEFAULT '',
        description TEXT,
        meta VARCHAR(160) DEFAULT '',
        price VARCHAR(40) DEFAULT 'PKR 20,000',
        featured TINYINT(1) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        sort_order INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    const [[{ nc }]] = await pool.query("SELECT COUNT(*) AS nc FROM courses");
    const jsonCourses = readCourses();
    if (nc === 0 && jsonCourses.length > 0) {
      for (const c of jsonCourses) await addCourse(c);
      console.log(`  Migrated ${jsonCourses.length} course(s) from JSON to MySQL`);
    }

    storageMode = "MySQL";
    // Portal tables (users, enrollments, documents, sessions, ...)
    await portal.initSchema(pool);
    console.log(`  MySQL connected (${host}:${port}/${database}) — data stored in database`);
  } catch (err) {
    pool = null;
    storageMode = "JSON file (MySQL offline)";
    console.warn("  MySQL unavailable — falling back to JSON file storage");
    console.warn(`   Reason: ${err.message}`);
    console.warn("   Start MySQL (XAMPP) or Docker, then restart the server to use the database.");
  }
}

function rowToMsg(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    message: r.message,
    ip: r.ip,
    date: r.created_at,
    read: !!r.read,
  };
}

async function getMessages() {
  if (pool) {
    const [rows] = await pool.query("SELECT * FROM messages ORDER BY created_at ASC, id ASC");
    return rows.map(rowToMsg);
  }
  return readMessages();
}

async function addMessage(m) {
  if (pool) {
    await pool.query(
      "INSERT INTO messages (id, name, email, phone, message, `read`, ip, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [m.id, m.name, m.email, m.phone, m.message, 0, m.ip, m.date]
    );
    return;
  }
  const msgs = readMessages();
  msgs.push({ ...m, read: false });
  writeMessages(msgs);
}

async function markRead(id) {
  if (pool) {
    await pool.query("UPDATE messages SET `read` = 1 WHERE id = ?", [id]);
    return;
  }
  const msgs = readMessages();
  const found = msgs.find((m) => m.id === id);
  if (found) {
    found.read = true;
    writeMessages(msgs);
  }
}

async function deleteMessage(id) {
  if (pool) {
    await pool.query("DELETE FROM messages WHERE id = ?", [id]);
    return;
  }
  writeMessages(readMessages().filter((m) => m.id !== id));
}

// ---------- Course storage (MySQL with JSON-file fallback) ----------
const COURSES_FILE = path.join(__dirname, "data", "courses.json");

function readCourses() {
  try {
    if (!fs.existsSync(COURSES_FILE)) return [];
    const d = JSON.parse(fs.readFileSync(COURSES_FILE, "utf-8"));
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

function writeCourses(list) {
  fs.mkdirSync(path.dirname(COURSES_FILE), { recursive: true });
  fs.writeFileSync(COURSES_FILE, JSON.stringify(list, null, 2), "utf-8");
}

function rowToCourse(r) {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    tag: r.tag,
    shortDesc: r.short_desc,
    description: r.description,
    meta: r.meta,
    price: r.price,
    featured: !!r.featured,
    active: !!r.active,
    sortOrder: r.sort_order,
  };
}

async function getCourses() {
  if (pool) {
    const [rows] = await pool.query(
      "SELECT * FROM courses ORDER BY sort_order ASC, title ASC"
    );
    return rows.map(rowToCourse);
  }
  return readCourses();
}

async function addCourse(c) {
  if (pool) {
    await pool.query(
      "INSERT INTO courses (id, title, category, tag, short_desc, description, meta, price, featured, active, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [
        c.id, c.title, c.category, c.tag || "", c.shortDesc || "", c.description || "",
        c.meta || "", c.price || "PKR 20,000", c.featured ? 1 : 0,
        c.active === false ? 0 : 1, c.sortOrder || 0,
      ]
    );
    return;
  }
  const list = readCourses();
  list.push({
    id: c.id,
    title: c.title,
    category: c.category,
    tag: c.tag || "",
    shortDesc: c.shortDesc || "",
    description: c.description || "",
    meta: c.meta || "",
    price: c.price || "PKR 20,000",
    featured: !!c.featured,
    active: c.active === false ? false : true,
    sortOrder: c.sortOrder || 0,
  });
  writeCourses(list);
}

async function updateCourse(id, patch) {
  if (pool) {
    await pool.query(
      "UPDATE courses SET title=?, category=?, tag=?, short_desc=?, description=?, meta=?, price=?, featured=?, active=?, sort_order=? WHERE id=?",
      [
        patch.title, patch.category, patch.tag || "", patch.shortDesc || "",
        patch.description || "", patch.meta || "", patch.price || "PKR 20,000",
        patch.featured ? 1 : 0, patch.active === false ? 0 : 1,
        patch.sortOrder || 0, id,
      ]
    );
    return;
  }
  const list = readCourses();
  const c = list.find((x) => x.id === id);
  if (c) {
    c.title = patch.title;
    c.category = patch.category;
    c.tag = patch.tag || "";
    c.shortDesc = patch.shortDesc || "";
    c.description = patch.description || "";
    c.meta = patch.meta || "";
    c.price = patch.price || "PKR 20,000";
    c.featured = !!patch.featured;
    c.active = patch.active === false ? false : true;
    if (patch.sortOrder != null) c.sortOrder = patch.sortOrder;
    writeCourses(list);
  }
}

async function deleteCourse(id) {
  if (pool) {
    await pool.query("DELETE FROM courses WHERE id = ?", [id]);
    return;
  }
  writeCourses(readCourses().filter((c) => c.id !== id));
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------- API: Contact form ----------
// ---------- Validation helpers ----------
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

// Common email typos and their suggested fix
const EMAIL_TYPOS = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmailo.com": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "hotmail.co": "hotmail.com",
};

// Throw-away email providers — not accepted
const DISPOSABLE_DOMAINS = [
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "yopmail.com", "throwaway.email", "trashmail.com",
  "fakeinbox.com", "maildrop.cc", "sharklasers.com",
];

function isValidEmail(v) {
  v = String(v || "").trim();
  return v.length <= 100 && EMAIL_RE.test(v) && !v.includes("..") && !v.includes(".@") && !v.includes("@.");
}

// Extra email check: typo or disposable address gives a helpful message, otherwise ""
function emailIssue(v) {
  const domain = String(v || "").trim().toLowerCase().split("@")[1] || "";
  if (EMAIL_TYPOS[domain]) return "This looks like a typo — did you mean " + EMAIL_TYPOS[domain] + "?";
  if (DISPOSABLE_DOMAINS.indexOf(domain) !== -1) return "Please use a permanent email like Gmail, Yahoo or Outlook";
  return "";
}

function isValidPKPhone(v) {
  let s = String(v || "").replace(/[\s()-]/g, "");
  if (!/^(\+92|0092|92|0)?3\d{9}$/.test(s)) return false;
  // Normalize to local 03XXXXXXXXX form
  if (s.indexOf("+92") === 0) s = "0" + s.slice(3);
  else if (s.indexOf("0092") === 0) s = "0" + s.slice(4);
  else if (s.length === 12 && s.indexOf("92") === 0) s = "0" + s.slice(2);
  else if (s.length === 10 && s[0] === "3") s = "0" + s;
  const prefix = Number(s.slice(0, 4));
  // Real Pakistani mobile ranges: 0300–0349 (+ SCOM 0355)
  if (!((prefix >= 300 && prefix <= 349) || prefix === 355)) return false;
  // Obviously fake repeating number (03000000000 etc.)
  if (/^(\d)\1{8}$/.test(s.slice(2))) return false;
  return true;
}

/** Deep email check: does the domain really exist (MX or A record)?
 *  Returns true when it cannot be verified (network trouble) so valid mail is never blocked. */
async function emailDomainExists(email) {
  const domain = String(email).split("@")[1] || "";
  if (!domain || !domain.includes(".")) return false;
  try {
    await dns.promises.resolveMx(domain);
    return true;
  } catch (err) {
    if (err.code !== "ENOTFOUND" && err.code !== "ENODATA") return true; // can't verify — allow
    try {
      await dns.promises.resolve4(domain);
      return true;
    } catch (e2) {
      return !(e2.code === "ENOTFOUND" || e2.code === "ENODATA");
    }
  }
}

app.post("/api/contact", async (req, res) => {
  const { name = "", email = "", phone = "", message = "" } = req.body || {};

  const errors = {};
  if (String(name).trim().length < 2) errors.name = "Name must be at least 2 characters";
  else if (String(name).trim().length > 80) errors.name = "Name must be under 80 characters";
  if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
  else { const issue = emailIssue(email); if (issue) errors.email = issue; }
  if (String(phone).trim() && !isValidPKPhone(phone)) errors.phone = "Enter a valid mobile number (e.g. 0300 1234567)";
  if (String(message).trim().length < 5) errors.message = "Message must be at least 5 characters";
  else if (String(message).trim().length > 1000) errors.message = "Message must be under 1000 characters";

  if (Object.keys(errors).length) {
    return res.status(422).json({ ok: false, errors });
  }

  // Deep email check — the domain must actually exist (catches typos like gmial.com)
  if (!(await emailDomainExists(String(email).trim()))) {
    return res.status(422).json({
      ok: false,
      errors: { email: "This email is not correct — its domain does not exist. Please check for typos." },
    });
  }

  try {
    await addMessage({
      id: "msg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(name).trim(),
      email: String(email).trim(),
      phone: String(phone).trim(),
      message: String(message).trim(),
      date: new Date().toISOString().slice(0, 19).replace("T", " "),
      ip: req.ip,
    });
  } catch (err) {
    console.error("Failed to save message:", err.message);
    return res.status(500).json({ ok: false, msg: "Sorry, something went wrong. Please try again." });
  }

  // Email the owner (best effort — doesn't slow down the response)
  notifyOwner(`New Contact Message — ${String(name).trim()}`, {
    Name: String(name).trim(),
    Email: String(email).trim(),
    Phone: String(phone).trim() || "-",
    Message: String(message).trim(),
    Time: new Date().toLocaleString("en-PK"),
    IP: String(req.ip),
  }, originOf(req)).then((m) => console.log(`Contact email: ${m || "FAILED (saved to admin only)"}`))
    .catch((err) => console.error("Contact notification failed:", err.message));

  res.json({ ok: true, msg: "Thank you! Your message has been received." });
});

// ---------- Email (SMTP via .env, fallback to FormSubmit relay) ----------
const OWNER_EMAIL = process.env.OWNER_EMAIL || "umair799283@gmail.com";

function getMailer() {
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user, pass },
  });
}

/**
 * Notify the owner by email. Tries SMTP first (if configured),
 * then falls back to the FormSubmit relay (works with zero setup).
 * Returns "smtp" | "formsubmit" | null.
 */
/** Origin of the site that received the request (FormSubmit requires an Origin header). */
function originOf(req) {
  if (req.headers.origin) return String(req.headers.origin).replace(/\/$/, "");
  if (req.headers.referer) {
    try { return new URL(req.headers.referer).origin; } catch (e) { /* ignore */ }
  }
  return "http://localhost:3000";
}

async function notifyOwner(subject, fields, origin) {
  // 1) Direct SMTP (configured via .env)
  const mailer = getMailer();
  if (mailer) {
    try {
      const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");
      await mailer.sendMail({
        from: `"CyberNexa Website" <${process.env.SMTP_USER}>`,
        to: OWNER_EMAIL,
        subject,
        text: lines,
      });
      return "smtp";
    } catch (err) {
      console.error("SMTP send failed:", err.message);
    }
  }

  // 2) FormSubmit relay — no credentials needed.
  //    First ever submission sends an activation email to OWNER_EMAIL (check Gmail/Spam once).
  try {
    const base = origin || "http://localhost:3000";
    const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(OWNER_EMAIL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Origin: base,
        Referer: base + "/",
      },
      body: JSON.stringify({ _subject: subject, _template: "table", _captcha: "false", ...fields }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && String(data.success) !== "false") return "formsubmit";
    console.error("FormSubmit rejected:", JSON.stringify(data));
  } catch (err) {
    console.error("FormSubmit failed:", err.message);
  }

  return null;
}

// ---------- API: Course enrollment (saves request + emails the owner) ----------
const multer = require("multer");
const UPLOAD_DIR = path.join(__dirname, "uploads", "enrollments");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path.basename(file.originalname || "file", ext).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
    cb(null, "enroll_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6) + (base ? "_" + base : "") + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".heic", ".heif"];
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only JPG, PNG, PDF files are allowed."));
  },
});

function buildAttachmentsMeta(files) {
  if (!files || !files.length) return [];
  const LABEL = { cnic: "CNIC/B-Form", photo: "Photograph", payment: "Payment Proof", qualification: "Qualification", other: "Other" };
  return files.map((f) => ({
    field: f.fieldname,
    label: LABEL[f.fieldname] || "Document",
    originalname: f.originalname,
    filename: f.filename,
  }));
}

app.post(
  "/api/enroll",
  (req, res, next) => {
    upload.any()(req, res, (err) => {
      if (err) {
        const msg =
          err.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 10 MB or smaller."
            : err.message || "File upload failed.";
        return res.status(422).json({ ok: false, errors: { files: msg }, msg });
      }
      next();
    });
  },
  async (req, res) => {
  const { course = "", price = "", name = "", email = "", phone = "", enrollmentType = "" } = req.body || {};

  const errors = {};
  if (String(course).trim().length < 2) errors.course = "Course is required";
  else if (String(course).trim().length > 120) errors.course = "Course name too long";
  if (String(name).trim().length < 2) errors.name = "Name must be at least 2 characters";
  else if (String(name).trim().length > 80) errors.name = "Name must be under 80 characters";
  if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
  else { const issue = emailIssue(email); if (issue) errors.email = issue; }
  if (String(phone).trim() && !isValidPKPhone(phone)) errors.phone = "Enter a valid mobile number (e.g. 0300 1234567)";
  if (!["Online", "On-Site"].includes(String(enrollmentType).trim())) {
    errors.enrollmentType = "Select enrollment type — Online or On-Site";
  }

  // Required documents (checked by form field name)
  const files = req.files || [];
  const byField = (name) => files.filter((f) => f.fieldname === name);
  if (byField("cnic").length === 0) errors.cnic = "CNIC / B-Form is required (JPG, PNG or PDF)";
  if (byField("photo").length === 0) errors.photo = "Recent Photograph is required (JPG or PNG)";
  if (byField("payment").length === 0) errors.payment = "Payment Proof / Receipt is required (JPG, PNG or PDF)";

  if (Object.keys(errors).length) {
    return res.status(422).json({ ok: false, errors });
  }

  // Deep email check — the domain must actually exist (catches typos like gmial.com)
  if (!(await emailDomainExists(String(email).trim()))) {
    return res.status(422).json({
      ok: false,
      errors: { email: "This email is not correct — its domain does not exist. Please check for typos." },
    });
  }

  const courseName = String(course).trim();
  const coursePrice = String(price).trim() || "Contact us";
  const displayName = String(name).trim();
  const displayEmail = String(email).trim();
  const displayPhone = String(phone).trim();
  const enrollType = String(enrollmentType).trim();

  // 1) Always save the request (admin dashboard)
  const attachMeta = buildAttachmentsMeta(files);
  const msgBody = `Enrollment request — ${courseName} (${coursePrice})\nEnrollment Type: ${enrollType}\nAttachments: ${attachMeta.length}\n${attachMeta.map((a) => "- " + a.originalname + " :: " + a.filename).join("\n")}`;

  try {
    await addMessage({
      id: "msg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
      message: msgBody,
      date: new Date().toISOString().slice(0, 19).replace("T", " "),
      ip: req.ip,
    });
  } catch (err) {
    console.error("Failed to save enrollment:", err.message);
    return res.status(500).json({ ok: false, msg: "Sorry, something went wrong. Please try again." });
  }

  // 1b) Also create a managed enrollment record for the portal (linked when a student is signed in)
  try {
    const LABEL = { cnic: "CNIC/B-Form", photo: "Photograph", payment: "Payment Proof", qualification: "Qualification", other: "Other" };
    await portal.recordEnrollment({
      user: req.user || null,
      course: courseName,
      courseId: String(req.body.courseId || req.body.course_id || ""),
      price: coursePrice,
      enrollmentType: enrollType,
      name: displayName,
      email: displayEmail,
      phone: displayPhone,
      files: (req.files || []).map((f) => ({ ...f, label: LABEL[f.fieldname] || "Document" })),
    });
  } catch (err) {
    console.error("Portal enrollment record failed:", err.message);
  }

  // 2) Email the owner (SMTP if configured, otherwise FormSubmit relay)
  let mailed = null;
  try {
    const fields = {
      Course: courseName,
      Fee: coursePrice,
      "Enrollment Type": enrollType,
      Name: displayName,
      Email: displayEmail,
      Phone: displayPhone || "-",
      Time: new Date().toLocaleString("en-PK"),
      IP: String(req.ip),
      Attachments: attachMeta.length
        ? attachMeta.map((a) => a.originalname).join(", ") + "  (open the admin panel to download)"
        : "-",
    };
    mailed = await notifyOwner(`New Enrollment Request — ${courseName}`, fields, originOf(req));
  } catch (err) {
    console.error("Enrollment notification failed:", err.message);
  }

  console.log(` Enrollment: ${courseName} — ${displayName} (${displayEmail}) | email: ${mailed || "FAILED (saved to admin only)"}`);
  res.json({
    ok: true,
    msg: "Enrollment request sent! We will contact you shortly.",
    mailed: !!mailed,
  });
  }
);

// ---------- API: Newsletter subscription ----------
app.post("/api/subscribe", async (req, res) => {
  const { email = "" } = req.body || {};
  const clean = String(email).trim();

  if (!isValidEmail(clean)) {
    return res.status(422).json({ ok: false, errors: { email: "Please enter a valid email address" } });
  }
  const issue = emailIssue(clean);
  if (issue) {
    return res.status(422).json({ ok: false, errors: { email: issue } });
  }
  if (!(await emailDomainExists(clean))) {
    return res.status(422).json({
      ok: false,
      errors: { email: "This email is not correct — its domain does not exist. Please check for typos." },
    });
  }

  // Already subscribed? (case-insensitive)
  try {
    const all = await getMessages();
    const exists = all.some(
      (m) => String(m.message || "").indexOf("Newsletter subscription") !== -1 &&
             String(m.email || "").toLowerCase() === clean.toLowerCase()
    );
    if (exists) {
      return res.json({ ok: true, msg: "You're already subscribed — thank you!" });
    }
  } catch (err) {
    console.error("Subscribe duplicate check failed:", err.message);
  }

  try {
    await addMessage({
      id: "msg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: "Newsletter Subscriber",
      email: clean,
      phone: "",
      message: "Newsletter subscription",
      date: new Date().toISOString().slice(0, 19).replace("T", " "),
      ip: req.ip,
    });
  } catch (err) {
    console.error("Failed to save subscriber:", err.message);
    return res.status(500).json({ ok: false, msg: "Sorry, something went wrong. Please try again." });
  }

  notifyOwner("New Newsletter Subscriber", {
    Email: clean,
    Time: new Date().toLocaleString("en-PK"),
    IP: String(req.ip),
  }, originOf(req))
    .then((m) => console.log(` Newsletter: ${clean} | email: ${m || "not sent"}`))
    .catch((err) => console.error("Newsletter notification failed:", err.message));

  res.json({ ok: true, msg: "Subscribed! You'll hear from us soon." });
});

// ---------- API: Course catalog (public, active courses only) ----------
app.get("/api/courses", async (req, res) => {
  try {
    const all = await getCourses();
    const list = all
      .filter((c) => c.active)
      .map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        tag: c.tag,
        shortDesc: c.shortDesc,
        description: c.description,
        meta: c.meta,
        price: c.price,
        featured: !!c.featured,
      }));
    res.json({ ok: true, courses: list });
  } catch (err) {
    console.error("Failed to load courses:", err.message);
    res.status(500).json({ ok: false, msg: "Could not load courses" });
  }
});

// ---------- Admin authentication (form login, no browser popup) ----------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_COOKIE = "cnx_admin";
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_SECRET = crypto
  .createHmac("sha256", "cybernexa-admin-session-v1")
  .update(String(ADMIN_PASSWORD))
  .digest("hex");
const adminFails = new Map();

function adminCookie(header, name) {
  const parts = String(header || "").split(";");
  for (const part of parts) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return "";
      }
    }
  }
  return "";
}
function adminToken() {
  const exp = Date.now() + ADMIN_TTL_MS;
  const sig = crypto.createHmac("sha256", ADMIN_SECRET).update(String(exp)).digest("hex");
  return exp + "." + sig;
}
function adminTokenValid(token) {
  try {
    const [exp, sig] = String(token || "").split(".");
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const good = crypto.createHmac("sha256", ADMIN_SECRET).update(String(exp)).digest("hex");
    return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
  } catch {
    return false;
  }
}
function isAdmin(req) {
  // Basic Auth stays supported for scripts/curl — but we never send the
  // WWW-Authenticate header, so visitors get our login page instead of a popup.
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf-8");
      const pass = decoded.substring(decoded.indexOf(":") + 1);
      if (pass === ADMIN_PASSWORD) return true;
    } catch {
      /* ignore */
    }
  }
  return adminTokenValid(adminCookie(req.headers.cookie || "", ADMIN_COOKIE));
}
function adminAuth(req, res, next) {
  if (isAdmin(req)) return next();
  return res.redirect("/admin/login");
}
function adminRateLimited(ip) {
  const now = Date.now();
  const list = (adminFails.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  adminFails.set(ip, list);
  return list.length >= 10;
}
function adminLoginPage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin login | CyberNexa</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  :root { --bg:#0a0a17; --card:#12122a; --border:#26264a; --violet:#3b82f6; --indigo:#2563eb; --cyan:#60a5fa; --text:#ececf5; --muted:#9a9ab5; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { min-height:100vh; display:grid; place-items:center; padding:24px; background:radial-gradient(900px 500px at 15% 0%, rgba(59,130,246,.16), transparent 60%), radial-gradient(700px 500px at 100% 100%, rgba(37,99,235,.14), transparent 55%), var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Segoe UI",sans-serif; }
  .card { width:100%; max-width:410px; background:var(--card); border:1px solid var(--border); border-radius:18px; padding:34px 30px; box-shadow:0 30px 80px -40px rgba(0,0,0,.9); }
  .brand { display:flex; align-items:center; gap:10px; font-weight:800; font-size:1.25rem; margin-bottom:6px; }
  .brand i, .brand b { color:var(--violet); }
  .sub { color:var(--muted); font-size:.88rem; margin-bottom:24px; }
  label { display:block; font-size:.78rem; color:var(--muted); margin:0 0 6px; }
  input { width:100%; background:#0d0d22; border:1px solid var(--border); color:var(--text); padding:11px 13px; border-radius:10px; font-size:.95rem; outline:none; }
  input:focus { border-color:var(--violet); box-shadow:0 0 0 3px rgba(59,130,246,.18); }
  .btn { width:100%; margin-top:18px; padding:12px; border:0; border-radius:10px; background:linear-gradient(120deg,var(--violet),var(--indigo)); color:#fff; font-size:.95rem; font-weight:700; cursor:pointer; font-family:inherit; }
  .btn:hover { filter:brightness(1.08); }
  .err { background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.35); color:#f87171; padding:10px 13px; border-radius:10px; font-size:.85rem; margin-bottom:16px; }
  .back { display:block; text-align:center; margin-top:18px; color:var(--muted); font-size:.83rem; text-decoration:none; }
  .back:hover { color:var(--cyan); }
</style>
</head>
<body>
  <form class="card" method="post" action="/admin/login">
    <div class="brand"><i class="fa-solid fa-shield-halved"></i> Cyber<b>Nexa</b> Admin</div>
    <div class="sub">Sign in to manage the website, students and academy.</div>
    ${error ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${error}</div>` : ""}
    <label for="password">Admin password</label>
    <input id="password" type="password" name="password" required autofocus autocomplete="current-password" placeholder="Enter admin password">
    <button class="btn" type="submit"><i class="fa-solid fa-key"></i> Sign in</button>
    <a class="back" href="/"><i class="fa-solid fa-globe"></i> Back to website</a>
  </form>
</body>
</html>`;
}

app.get("/admin/login", (req, res) => {
  if (isAdmin(req)) return res.redirect("/admin");
  res.send(adminLoginPage(""));
});
app.post("/admin/login", express.urlencoded({ extended: false }), (req, res) => {
  const ip = req.ip;
  if (adminRateLimited(ip)) {
    return res.status(429).send(adminLoginPage("Too many attempts. Please wait 15 minutes and try again."));
  }
  const pw = String(req.body.password || "");
  if (pw && pw === ADMIN_PASSWORD) {
    adminFails.delete(ip);
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_COOKIE}=${encodeURIComponent(adminToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ADMIN_TTL_MS / 1000)}`
    );
    return res.redirect("/admin");
  }
  const list = adminFails.get(ip) || [];
  list.push(Date.now());
  adminFails.set(ip, list);
  res.status(401).send(adminLoginPage("Wrong password. Please try again."));
});
app.post("/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.redirect("/admin/login");
});

// ---------- Admin: Dashboard ----------
app.use("/admin", (req, res, next) => {
  if (req.path === "/login" || req.path === "/logout") return next();
  return adminAuth(req, res, next);
});

function adminLayout(title, active, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  :root { --bg:#0a0a17; --card:#12122a; --border:#26264a; --violet:#3b82f6; --indigo:#2563eb; --cyan:#60a5fa; --text:#ececf5; --muted:#9a9ab5; --green:#22c55e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:system-ui,sans-serif; display:flex; min-height:100vh; }
  .side { width:230px; flex-shrink:0; background:var(--card); border-right:1px solid var(--border); padding:26px 18px; display:flex; flex-direction:column; }
  .brand { font-weight:800; font-size:1.2rem; margin-bottom:30px; display:flex; gap:8px; align-items:center; }
  .brand b { color:var(--violet); }
  .side a { display:block; padding:11px 14px; border-radius:10px; color:var(--muted); text-decoration:none; font-size:.93rem; margin-bottom:5px; transition:.2s; }
  .side a:hover { background:rgba(255,255,255,.05); color:var(--text); }
  .side a.active { background:linear-gradient(120deg,var(--violet),var(--indigo)); color:#fff; }
  .side .foot { margin-top:auto; font-size:.78rem; color:var(--muted); border-top:1px solid var(--border); padding-top:14px; }
  .side .logout-btn { display:block; width:100%; text-align:left; background:transparent; border:0; padding:11px 14px; border-radius:10px; color:var(--muted); font-size:.93rem; font-family:inherit; cursor:pointer; margin-bottom:5px; transition:.2s; }
  .side .logout-btn:hover { background:rgba(239,68,68,.12); color:#f87171; }
  .main { flex:1; padding:34px; min-width:0; }
  h1 { font-size:1.5rem; margin-bottom:4px; }
  .sub { color:var(--muted); margin-bottom:26px; font-size:.92rem; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:26px; }
  .box { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px; }
  .box b { display:block; font-size:1.9rem; color:var(--cyan); }
  .box span { font-size:.8rem; color:var(--muted); }
  .box.v b { color:var(--violet); } .box.g b { color:var(--green); } .box.o b { color:#f97316; }
  .panel { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:22px; margin-bottom:26px; overflow-x:auto; }
  .panel h2 { font-size:1.05rem; margin-bottom:18px; }
  .chart { display:flex; align-items:flex-end; gap:12px; height:160px; padding-top:10px; }
  .bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:8px; height:100%; justify-content:flex-end; }
  .bar { width:100%; max-width:52px; background:linear-gradient(180deg,var(--violet),var(--indigo)); border-radius:8px 8px 0 0; min-height:4px; }
  .bar-val { font-size:.75rem; color:var(--cyan); font-weight:700; }
  .bar-lbl { font-size:.72rem; color:var(--muted); }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--border); font-size:.9rem; }
  th { color:var(--cyan); font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  tr:last-child td { border-bottom:0; }
  tr.unread td { background:rgba(59,130,246,.07); }
  .msg { color:var(--muted); max-width:320px; white-space:pre-wrap; }
  a { color:var(--cyan); }
  .btn { display:inline-block; padding:6px 13px; border-radius:8px; text-decoration:none; font-size:.8rem; font-weight:600; margin-right:6px; cursor:pointer; border:0; font-family:inherit; }
  .b-read { background:rgba(96,165,250,.15); color:var(--cyan); border:1px solid rgba(96,165,250,.4); }
  .b-del  { background:rgba(239,68,68,.15); color:#f87171; border:1px solid rgba(239,68,68,.4); }
  .empty  { text-align:center; padding:40px; color:var(--muted); }
  .head-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
  label { display:block; font-size:.78rem; color:var(--muted); margin:12px 0 4px; }
  input[type=text], input[type=number], input[type=password], textarea, select { width:100%; background:#0d0d22; border:1px solid var(--border); color:var(--text); padding:9px 12px; border-radius:8px; font-family:inherit; font-size:.9rem; outline:none; }
  input:focus, textarea:focus, select:focus { border-color:var(--violet); box-shadow:0 0 0 3px rgba(59,130,246,.18); }
  textarea { min-height:70px; resize:vertical; }
  .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; }
  .check-row { display:flex; gap:22px; margin-top:16px; flex-wrap:wrap; }
  .check-row label { display:flex; gap:8px; align-items:center; margin:0; color:var(--text); font-size:.88rem; }
  .check-row input { width:auto; }
  .b-add { background:linear-gradient(120deg,var(--violet),var(--indigo)); color:#fff; padding:10px 22px; font-size:.85rem; }
  .badge { display:inline-block; padding:3px 9px; border-radius:999px; font-size:.7rem; font-weight:700; white-space:nowrap; }
  .badge.on { background:rgba(34,197,94,.14); color:var(--green); border:1px solid rgba(34,197,94,.35); }
  .badge.off { background:rgba(148,163,184,.12); color:var(--muted); border:1px solid rgba(148,163,184,.3); }
  .badge.feat { background:rgba(96,165,250,.12); color:var(--cyan); border:1px solid rgba(96,165,250,.35); }
  .notice { background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.3); color:var(--green); padding:10px 14px; border-radius:10px; margin-bottom:18px; font-size:.85rem; }
  @media (max-width:900px){ .form-grid{ grid-template-columns:1fr; } }
  @media (max-width: 900px) {
    body { flex-direction:column; }
    .side { width:100%; flex-direction:row; align-items:center; padding:14px 18px; gap:8px; overflow-x:auto; }
    .brand { margin:0 16px 0 0; white-space:nowrap; }
    .side a { white-space:nowrap; margin:0; }
    .side .foot { display:none; }
    .stats { grid-template-columns:repeat(2,1fr); }
    .main { padding:22px 16px; }
  }
</style>
</head>
<body>
<aside class="side">
  <div class="brand"><i class="fa-solid fa-shield-halved"></i> Cyber<b>Nexa</b></div>
  <a href="/admin" class="${active === "dash" ? "active" : ""}"><i class="fa-solid fa-chart-column"></i> Dashboard</a>
  <a href="/admin/messages" class="${active === "msgs" ? "active" : ""}"><i class="fa-solid fa-envelope"></i> Messages</a>
  <a href="/admin/courses" class="${active === "courses" ? "active" : ""}"><i class="fa-solid fa-graduation-cap"></i> Courses</a>
  <a href="/admin/students" class="${active === "students" ? "active" : ""}"><i class="fa-solid fa-user-graduate"></i> Students</a>
  <a href="/admin/teachers" class="${active === "teachers" ? "active" : ""}"><i class="fa-solid fa-chalkboard-user"></i> Teachers</a>
  <a href="/admin/enrollments" class="${active === "enrollments" ? "active" : ""}"><i class="fa-solid fa-folder-tree"></i> Enrollments</a>
  <a href="/admin/assignments" class="${active === "assignments" ? "active" : ""}"><i class="fa-solid fa-pen-to-square"></i> Assignments</a>
  <a href="/admin/campus" class="${active === "campus" ? "active" : ""}"><i class="fa-solid fa-school"></i> Campus</a>
  <a href="/admin/notices" class="${active === "notices" ? "active" : ""}"><i class="fa-solid fa-bell"></i> Notices</a>
  <a href="/admin/resets" class="${active === "resets" ? "active" : ""}"><i class="fa-solid fa-lock"></i> Password resets</a>
  <a href="/" target="_blank"><i class="fa-solid fa-globe"></i> View Website</a>
  <form method="post" action="/admin/logout"><button type="submit" class="logout-btn"><i class="fa-solid fa-power-off"></i> Log out</button></form>
  <div class="foot">Signed in as <b>admin</b></div>
</aside>
<main class="main">${body}</main>
</body>
</html>`;
}

// ---------- Admin: Dashboard home ----------
app.get("/admin", async (req, res) => {
  const messages = await getMessages();
  const total = messages.length;
  const unread = messages.filter((m) => !m.read).length;
  const read = total - unread;

  // Messages per day (last 7 days)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: messages.filter((m) => String(m.date || "").startsWith(key)).length,
    });
  }
  const last7 = days.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const chart = days
    .map(
      (d) => `
    <div class="bar-wrap">
      <span class="bar-val">${d.count}</span>
      <div class="bar" style="height:${Math.max(4, Math.round((d.count / maxCount) * 110))}px"></div>
      <span class="bar-lbl">${d.label}</span>
    </div>`
    )
    .join("");

  const recent = messages.slice(-5).reverse();
  const recentRows = recent.length
    ? recent
        .map(
          (m) => `
      <tr class="${m.read ? "" : "unread"}">
        <td>${esc(m.name)}</td>
        <td>${esc(m.email)}</td>
        <td class="msg">${esc(m.message).slice(0, 90)}${String(m.message).length > 90 ? "…" : ""}</td>
        <td>${esc(m.date)}</td>
        <td>${m.read ? "<i class='fa-solid fa-circle-check'></i>" : "<i class='fa-solid fa-envelope'></i>"}</td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No messages yet. <i class="fa-solid fa-face-smile"></i></td></tr>`;

  res.send(
    adminLayout(
      "Admin — Dashboard",
      "dash",
      `
    <h1><i class="fa-solid fa-chart-column"></i> Dashboard</h1>
    <p class="sub">Overview of your contact form activity · Storage: ${storageMode}</p>

    <div class="stats">
      <div class="box"><b>${total}</b><span>Total Messages</span></div>
      <div class="box v"><b>${unread}</b><span>Unread</span></div>
      <div class="box g"><b>${read}</b><span>Read</span></div>
      <div class="box o"><b>${last7}</b><span>Last 7 Days</span></div>
    </div>

    <div class="panel">
      <h2>Messages — Last 7 Days</h2>
      <div class="chart">${chart}</div>
    </div>

    <div class="panel">
      <h2>Recent Messages</h2>
      <table>
        <tr><th>Name</th><th>Email</th><th>Message</th><th>Date</th><th>Status</th></tr>
        ${recentRows}
      </table>
      <p style="margin-top:16px"><a href="/admin/messages" style="font-weight:600">View all messages</a></p>
    </div>`
    )
  );
});

// ---------- Admin: All messages ----------
function attachmentsCell(m) {
  const txt = String(m.message || "");
  const re = /-\s*(.+?)\s*::\s*(enroll_[^\s]+?\.(?:jpg|jpeg|png|pdf|webp|heic|heif))/gi;
  const links = [];
  let mm;
  while ((mm = re.exec(txt)) !== null) {
    links.push(
      `<a class="btn b-read" style="margin:2px 0" href="/admin/file/${encodeURIComponent(mm[2])}" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> ${esc(mm[1])}</a>`
    );
  }
  return links.length ? `<div style="display:flex;flex-direction:column;gap:4px">${links.join("")}</div>` : "-";
}

// Protected download of an uploaded enrollment document (admin only)
app.get("/admin/file/:name", (req, res) => {
  const name = path.basename(String(req.params.name || ""));
  const full = path.join(UPLOAD_DIR, name);
  if (!full.startsWith(UPLOAD_DIR) || !fs.existsSync(full)) {
    return res.status(404).send("<h1>404 — File not found</h1>");
  }
  res.download(full, name);
});

app.get("/admin/messages", async (req, res) => {
  const messages = (await getMessages()).reverse();
  const unread = messages.filter((m) => !m.read).length;

  const rows = messages.length
    ? messages
        .map(
          (m, i) => `
      <tr class="${m.read ? "" : "unread"}">
        <td>${i + 1}</td>
        <td>${esc(m.date)}</td>
        <td>${esc(m.name)}</td>
        <td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
        <td>${esc(m.phone) || "-"}</td>
        <td class="msg">${esc(m.message)}</td>
        <td>${attachmentsCell(m)}</td>
        <td>
          ${m.read ? "" : `<form method="post" action="/admin/read" style="display:inline">
            <input type="hidden" name="id" value="${esc(m.id)}">
            <button class="btn b-read" type="submit"><i class="fa-solid fa-check"></i> Read</button></form>`}
          <a class="btn b-del" href="/admin/delete?id=${encodeURIComponent(m.id)}"
             onclick="return confirm('Delete this message?')"><i class="fa-solid fa-xmark"></i> Delete</a>
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="empty">No messages yet. <i class="fa-solid fa-face-smile"></i></td></tr>`;

  res.send(
    adminLayout(
      "Admin — Messages",
      "msgs",
      `
    <div class="head-row">
      <div>
        <h1><i class="fa-solid fa-envelope"></i> Messages</h1>
        <p class="sub">${messages.length} total · ${unread} unread</p>
      </div>
      <a href="/admin" class="btn b-read">Dashboard</a>
    </div>
    <div class="panel">
      <table>
        <tr><th>#</th><th>Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Message</th><th>Attachments</th><th>Action</th></tr>
        ${rows}
      </table>
    </div>`
    )
  );
});

app.post("/admin/read", express.urlencoded({ extended: false }), async (req, res) => {
  await markRead(req.body.id);
  res.redirect("/admin/messages");
});

app.get("/admin/delete", async (req, res) => {
  await deleteMessage(req.query.id);
  res.redirect("/admin/messages");
});

// ---------- Admin: Course manager ----------
const COURSE_CATEGORIES = [
  "Cybersecurity", "Networking", "DevOps", "Linux & Unix", "Cloud Computing",
  "System Administration", "Digital Marketing", "Programming", "Designing",
];

function courseForm(c, addMode) {
  const v = (k, d) => esc((c && c[k] != null ? c[k] : d) ?? "");
  const metaParts = c ? String(c.meta || "").split("|").map((p) => p.trim()) : [];
  return `
  <form method="post" action="${addMode ? "/admin/courses/add" : "/admin/courses/update"}">
    ${addMode ? "" : `<input type="hidden" name="id" value="${esc(c.id)}">`}
    <div class="form-grid">
      <div><label>Course title *</label><input type="text" name="title" required maxlength="190" value="${v("title", "")}"></div>
      <div><label>Short tag (e.g. CEH)</label><input type="text" name="tag" maxlength="60" value="${v("tag", "")}"></div>
      <div><label>Category *</label><input type="text" name="category" list="catList" required maxlength="80" value="${v("category", "")}">
        <datalist id="catList">${COURSE_CATEGORIES.map((cat) => `<option value="${esc(cat)}">`).join("")}</datalist></div>
      <div><label>Price</label><input type="text" name="price" maxlength="40" value="${v("price", "PKR 20,000")}"></div>
      <div><label>Duration</label><input type="text" name="duration" maxlength="30" value="${esc(metaParts[0] || "")}"></div>
      <div><label>Level</label><input type="text" name="level" maxlength="30" value="${esc(metaParts[1] || "")}"></div>
      <div><label>Meta extras (| separated, optional)</label><input type="text" name="extra" maxlength="80" value="${esc(metaParts.slice(2).join(" | "))}"></div>
      <div style="grid-column:1/-1"><label>Short description (course card)</label><textarea name="shortDesc" maxlength="240">${v("shortDesc", "")}</textarea></div>
      <div style="grid-column:1/-1"><label>Full description (enroll popup)</label><textarea name="description">${v("description", "")}</textarea></div>
    </div>
    <div class="check-row">
      <label><input type="checkbox" name="featured" value="1" ${c && c.featured ? "checked" : ""}> <i class="fa-solid fa-star"></i> Featured on homepage</label>
      <label><input type="checkbox" name="active" value="1" ${c ? (c.active ? "checked" : "") : "checked"}> <i class="fa-solid fa-circle-check"></i> Active (visible on site)</label>
    </div>
    <p style="margin-top:16px"><button class="btn b-add" type="submit">${addMode ? "Save Course" : "Update Course"}</button>
    ${addMode ? "" : `<a class="btn b-read" href="/admin/courses">Cancel</a>`}</p>
  </form>`;
}

app.get("/admin/courses", async (req, res) => {
  const courses = await getCourses();
  const total = courses.length;
  const activeN = courses.filter((c) => c.active).length;
  const featuredN = courses.filter((c) => c.featured).length;
  const cats = new Set(courses.map((c) => c.category)).size;
  const msg = req.query.saved
    ? `<div class="notice"><i class="fa-solid fa-circle-check"></i> Course saved successfully.</div>`
    : req.query.deleted
      ? `<div class="notice"><i class="fa-solid fa-trash"></i> Course deleted.</div>`
      : req.query.added
        ? `<div class="notice"><i class="fa-solid fa-plus"></i> Course added — it is now live on the website.</div>`
        : req.query.error
          ? `<div class="notice" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.35);color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.error)}</div>`
          : "";
  const rows = courses
    .map(
      (c) => `
    <tr>
      <td>${esc(c.tag) || "-"}</td>
      <td><strong>${esc(c.title)}</strong></td>
      <td>${esc(c.category)}</td>
      <td class="msg">${esc(c.meta)}</td>
      <td>${esc(c.price)}</td>
      <td>${c.featured ? `<span class="badge feat"><i class="fa-solid fa-star"></i> Featured</span> ` : ""}${c.active ? `<span class="badge on"><i class="fa-solid fa-circle-check"></i> Active</span>` : `<span class="badge off"><i class="fa-solid fa-ban"></i> Hidden</span>`}</td>
      <td style="white-space:nowrap">
        <a class="btn b-read" href="/admin/courses/edit?id=${encodeURIComponent(c.id)}"><i class="fa-solid fa-pen"></i> Edit</a>
        <a class="btn b-del" href="/admin/courses/delete?id=${encodeURIComponent(c.id)}"
           onclick="return confirm('Delete “${esc(c.title)}”?')"><i class="fa-solid fa-xmark"></i> Delete</a>
      </td>
    </tr>`
    )
    .join("");

  res.send(
    adminLayout(
      "Admin — Courses",
      "courses",
      `
    <div class="head-row">
      <div>
        <h1><i class="fa-solid fa-graduation-cap"></i> Courses</h1>
        <p class="sub">${total} total · ${activeN} active · ${featuredN} featured · ${cats} categories · Storage: ${storageMode}</p>
      </div>
      <a href="/admin" class="btn b-read">Dashboard</a>
    </div>
    ${msg}
    <div class="panel">
      <h2><i class="fa-solid fa-plus"></i> Add New Course</h2>
      ${courseForm(null, true)}
    </div>
    <div class="panel">
      <h2>All Courses (${total})</h2>
      <table>
        <tr><th>Tag</th><th>Title</th><th>Category</th><th>Meta</th><th>Price</th><th>Flags</th><th>Action</th></tr>
        ${rows || `<tr><td colspan="7" class="empty">No courses yet — add your first course above. <i class="fa-solid fa-graduation-cap"></i></td></tr>`}
      </table>
    </div>`
    )
  );
});

app.post("/admin/courses/add", express.urlencoded({ extended: false }), async (req, res) => {
  const { title, category, tag, price, duration, level, extra, shortDesc, description } = req.body || {};
  if (String(title).trim().length < 2 || !String(category).trim()) {
    return res.redirect("/admin/courses?error=Title and category are required");
  }
  const all = await getCourses();
  const meta = [duration, level, extra]
    .filter((x) => String(x || "").trim())
    .map((x) => String(x).trim())
    .join(" | ");
  const lastInCat = Math.max(
    -1,
    ...all.filter((c) => c.category === String(category).trim()).map((c) => c.sortOrder || 0)
  );
  await addCourse({
    id: "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: String(title).trim(),
    category: String(category).trim(),
    tag: String(tag || "").trim(),
    shortDesc: String(shortDesc || "").trim(),
    description: String(description || "").trim(),
    meta,
    price: String(price || "").trim() || "PKR 20,000",
    featured: req.body.featured === "1",
    active: req.body.active !== "1" ? false : true,
    sortOrder: lastInCat + 1,
  });
  res.redirect("/admin/courses?added=1");
});

app.get("/admin/courses/edit", async (req, res) => {
  const all = await getCourses();
  const c = all.find((x) => x.id === req.query.id);
  if (!c) return res.redirect("/admin/courses?error=Course not found");
  res.send(
    adminLayout(
      "Admin — Edit Course",
      "courses",
      `
    <div class="head-row">
      <div><h1><i class="fa-solid fa-pen"></i> Edit Course</h1><p class="sub">${esc(c.title)} · ${esc(c.category)}</p></div>
      <a href="/admin/courses" class="btn b-read">All Courses</a>
    </div>
    <div class="panel">${courseForm(c, false)}</div>`
    )
  );
});

app.post("/admin/courses/update", express.urlencoded({ extended: false }), async (req, res) => {
  const { id, title, category, tag, price, duration, level, extra, shortDesc, description } = req.body || {};
  if (!id || String(title).trim().length < 2 || !String(category).trim()) {
    return res.redirect("/admin/courses?error=Title and category are required");
  }
  const meta = [duration, level, extra]
    .filter((x) => String(x || "").trim())
    .map((x) => String(x).trim())
    .join(" | ");
  await updateCourse(id, {
    title: String(title).trim(),
    category: String(category).trim(),
    tag: String(tag || "").trim(),
    shortDesc: String(shortDesc || "").trim(),
    description: String(description || "").trim(),
    meta,
    price: String(price || "").trim() || "PKR 20,000",
    featured: req.body.featured === "1",
    active: req.body.active !== "1" ? false : true,
  });
  res.redirect("/admin/courses?saved=1");
});

app.get("/admin/courses/delete", async (req, res) => {
  await deleteCourse(req.query.id);
  res.redirect("/admin/courses?deleted=1");
});

// ---------- Health check (uptime monitors, Render, AWS load balancer) ----------
app.get("/healthz", (req, res) =>
  res.json({ ok: true, name: "CyberNexa Solutions", time: new Date().toISOString() })
);

// ---------- Student & Teacher Portal ----------
// Mounts /portal/*, /api/me, and the portal admin pages under /admin/*.
portal.mount(app, {
  getPool: () => pool,
  uploadRoot: path.join(__dirname, "uploads"),
  esc,
  isValidEmail,
  isValidPKPhone,
  emailIssue,
  emailDomainExists,
  notifyOwner,
  originOf,
  adminLayout,
  getCourses,
});
mountPortalAdmin(app);
mountPortalAcademics(app);
mountPortalCampus(app);

// ---------- Static frontend (public allow-list only) ----------
// Uploaded enrollment documents must NOT be publicly reachable.
app.use("/uploads", (req, res) => res.status(403).send("<h1>403 — Forbidden</h1>"));

// Only the public front-end is served. Anything else that happens to sit in the
// project root (server.js, portal*.js, package.json, data/, deploy/, k8s/,
// scripts/, docs, handover/) is private and must never be downloadable.
const PUBLIC_PAGES = new Set([
  "/", "/index", "/index.html",
  "/about", "/about.html",
  "/courses", "/courses.html",
  "/industries", "/industries.html",
  "/legal", "/legal.html",
]);
const PUBLIC_DIRS = ["/css/", "/js/", "/services/"];
app.use((req, res, next) => {
  let p = req.path;
  try {
    p = decodeURIComponent(p);
  } catch (_) {
    return res.status(400).send("<h1>400 — Bad request</h1>");
  }
  // Normalise so tricks like /js/../server.js or /%2e%2e/server.js cannot pass.
  p = path.posix.normalize(p);
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);

  if (PUBLIC_PAGES.has(p)) return next();
  if (PUBLIC_DIRS.some((dir) => p.startsWith(dir))) return next();
  return res.status(404).send("<h1>404 — Page not found</h1>");
});
app.use(express.static(__dirname, { extensions: ["html"] }));

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).send("<h1>404 — Page not found</h1>");
});

// ---------- Error handler ----------
// Catches errors forwarded by the portal's async-route wrapper (and any other
// next(err)) so a single bad request can never crash the server.
app.use((err, req, res, next) => {
  console.error(" Route error:", (err && err.message) || err);
  if (res.headersSent) return next(err);
  if (req.path.startsWith("/portal") || req.path.startsWith("/api/")) {
    try {
      return res.status(500).send(
        portal.core.errorPage("Something went wrong", "Please go back and try again in a moment.")
      );
    } catch (_) {
      /* fall through to the plain response below */
    }
  }
  res.status(500).send("<h1>500 — Something went wrong</h1>");
});

// Last-resort safety nets: log instead of crashing the live site.
process.on("unhandledRejection", (err) => console.error("  Unhandled rejection:", (err && err.message) || err));
process.on("uncaughtException", (err) => console.error("  Uncaught exception:", (err && err.stack) || err));

// Initialize the database (and portal schema) BEFORE accepting traffic, so the
// very first request never races against table creation. initDb never throws and
// we cap the wait so an unreachable MySQL can never keep the site offline.
const startup = initDb().catch((err) => console.error("Startup init failed:", err && err.message));
const deadline = new Promise((resolve) => setTimeout(resolve, 20000));
Promise.race([startup, deadline]).then(() => {
  app.listen(PORT, () => {
    console.log(` Server running: http://localhost:${PORT}`);
    console.log(` Admin panel:    http://localhost:${PORT}/admin`);
  });
});
