/**
 * CyberNexa Solutions — Student & Teacher Portal
 * ---------------------------------------------------------------
 * Server-rendered portal mounted into the main Express app:
 *   • Student registration, profile, enrollments, documents, fees
 *   • Teacher registration (admin approved), profile, courses
 *   • Password reset (admin mediated) + notices
 *
 * Storage: MySQL (the portal requires the database).
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// ---------------------------------------------------------------------------
// Context (injected by mount) — lets us reuse helpers from server.js
// ---------------------------------------------------------------------------
let ctx = null;
let UPLOAD_ROOT = "";
const SESSION_COOKIE = "cnx_sid";
const SESSION_DAYS = 7;

function esc(s) {
  return ctx.esc(s);
}
function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function getPool() {
  return ctx && ctx.getPool ? ctx.getPool() : null;
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt — built in, no native deps)
// ---------------------------------------------------------------------------
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + hash;
}
function verifyPassword(pw, stored) {
  try {
    const [algo, salt, hash] = String(stored || "").split("$");
    if (algo !== "scrypt" || !salt || !hash) return false;
    const a = Buffer.from(hash, "hex");
    const b = crypto.scryptSync(String(pw), salt, 64);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function passwordProblems(pw) {
  const s = String(pw || "");
  if (s.length < 8) return "Password must be at least 8 characters";
  if (s.length > 200) return "Password is too long";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Password must contain letters and numbers";
  return "";
}

// ---------------------------------------------------------------------------
// Cookies / sessions
// ---------------------------------------------------------------------------
function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function setSessionCookie(res, id, days = SESSION_DAYS) {
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${id}; Path=/; Max-Age=${days * 86400}; HttpOnly; SameSite=Lax`
  );
}
function clearSessionCookie(res) {
  res.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

// Middleware — resolve the signed-in portal user for /portal and /api routes.
// Registered early in server.js so routes like /api/enroll can see req.user.
function attachUser(req, res, next) {
  if (!/^\/(portal|api)(\/|$)/.test(req.url)) return next();
  currentUser(req)
    .then((u) => { req.user = u; next(); })
    .catch(() => { req.user = null; next(); });
}

async function currentUser(req) {
  const pool = getPool();
  if (!pool) return null;
  const sid = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!sid) return null;
  try {
    const [rows] = await pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > NOW() LIMIT 1`,
      [sid]
    );
    return rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
async function initSchema(pool) {
  const t = [
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(40) PRIMARY KEY,
      role ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(120) NOT NULL,
      phone VARCHAR(30) DEFAULT '',
      status ENUM('pending','active','suspended','rejected') NOT NULL DEFAULT 'active',
      photo VARCHAR(255) DEFAULT '',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      last_login DATETIME NULL,
      INDEX idx_role_status (role, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS student_profiles (
      user_id VARCHAR(40) PRIMARY KEY,
      dob VARCHAR(20) DEFAULT '',
      gender VARCHAR(20) DEFAULT '',
      cnic VARCHAR(20) DEFAULT '',
      address VARCHAR(240) DEFAULT '',
      city VARCHAR(80) DEFAULT '',
      guardian_name VARCHAR(120) DEFAULT '',
      guardian_phone VARCHAR(30) DEFAULT '',
      last_qualification VARCHAR(160) DEFAULT '',
      interests VARCHAR(240) DEFAULT '',
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS teacher_profiles (
      user_id VARCHAR(40) PRIMARY KEY,
      qualification VARCHAR(200) DEFAULT '',
      expertise VARCHAR(240) DEFAULT '',
      experience_years INT NOT NULL DEFAULT 0,
      bio TEXT,
      portfolio_url VARCHAR(240) DEFAULT '',
      cv_file VARCHAR(255) DEFAULT '',
      expected_fee VARCHAR(60) DEFAULT '',
      availability VARCHAR(120) DEFAULT '',
      applied_at DATETIME NOT NULL,
      reviewed_at DATETIME NULL,
      rejection_reason VARCHAR(240) DEFAULT '',
      updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS enrollments (
      id VARCHAR(40) PRIMARY KEY,
      user_id VARCHAR(40) NULL,
      course_id VARCHAR(40) DEFAULT '',
      course_title VARCHAR(190) NOT NULL,
      price VARCHAR(40) DEFAULT '',
      enrollment_type VARCHAR(20) DEFAULT 'Online',
      status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
      payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
      amount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
      notes VARCHAR(240) DEFAULT '',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_user (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(40) PRIMARY KEY,
      scope VARCHAR(20) NOT NULL,
      ref_id VARCHAR(40) DEFAULT '',
      user_id VARCHAR(40) DEFAULT '',
      kind VARCHAR(40) DEFAULT 'other',
      label VARCHAR(80) DEFAULT '',
      originalname VARCHAR(200) DEFAULT '',
      relpath VARCHAR(255) NOT NULL,
      size INT NOT NULL DEFAULT 0,
      uploaded_by VARCHAR(20) DEFAULT 'public',
      uploaded_at DATETIME NOT NULL,
      INDEX idx_scope (scope, ref_id),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(40) PRIMARY KEY,
      enrollment_id VARCHAR(40) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      method VARCHAR(40) DEFAULT '',
      note VARCHAR(200) DEFAULT '',
      paid_at DATETIME NOT NULL,
      INDEX idx_enrollment (enrollment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(80) PRIMARY KEY,
      user_id VARCHAR(40) NOT NULL,
      created_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      ip VARCHAR(45) DEFAULT '',
      user_agent VARCHAR(255) DEFAULT '',
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(40) PRIMARY KEY,
      token VARCHAR(80) NOT NULL UNIQUE,
      user_id VARCHAR(40) NOT NULL,
      requested_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS notices (
      id VARCHAR(40) PRIMARY KEY,
      audience VARCHAR(20) NOT NULL DEFAULT 'all',
      target_user VARCHAR(40) DEFAULT '',
      title VARCHAR(160) NOT NULL,
      body TEXT,
      created_at DATETIME NOT NULL,
      INDEX idx_audience (audience)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS teacher_courses (
      id VARCHAR(40) PRIMARY KEY,
      teacher_id VARCHAR(40) NOT NULL,
      course_title VARCHAR(190) NOT NULL,
      created_at DATETIME NOT NULL,
      INDEX idx_teacher (teacher_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Academics: assignments posted by teachers -------------------------
    `CREATE TABLE IF NOT EXISTS assignments (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      due_date DATETIME NULL,
      max_marks INT NOT NULL DEFAULT 100,
      doc_id VARCHAR(40) DEFAULT '',
      status ENUM('draft','published','closed') NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_course (course_title),
      INDEX idx_teacher (teacher_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Academics: student submissions + teacher grades -------------------
    `CREATE TABLE IF NOT EXISTS submissions (
      id VARCHAR(40) PRIMARY KEY,
      assignment_id VARCHAR(40) NOT NULL,
      student_id VARCHAR(40) NOT NULL,
      doc_id VARCHAR(40) DEFAULT '',
      note TEXT,
      submitted_at DATETIME NOT NULL,
      status ENUM('submitted','graded') NOT NULL DEFAULT 'submitted',
      marks DECIMAL(6,2) NULL,
      feedback TEXT,
      graded_at DATETIME NULL,
      graded_by VARCHAR(40) DEFAULT '',
      updated_at DATETIME NOT NULL,
      UNIQUE KEY uniq_sub (assignment_id, student_id),
      INDEX idx_student (student_id),
      INDEX idx_assignment (assignment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: attendance sessions (one class meeting) --------------------
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) NOT NULL,
      session_date DATE NOT NULL,
      topic VARCHAR(200) DEFAULT '',
      created_at DATETIME NOT NULL,
      INDEX idx_course (course_title),
      INDEX idx_teacher (teacher_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: per-student attendance marks -------------------------------
    `CREATE TABLE IF NOT EXISTS attendance (
      id VARCHAR(40) PRIMARY KEY,
      session_id VARCHAR(40) NOT NULL,
      student_id VARCHAR(40) NOT NULL,
      status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
      created_at DATETIME NOT NULL,
      UNIQUE KEY uniq_att (session_id, student_id),
      INDEX idx_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: weekly timetable slots -------------------------------------
    `CREATE TABLE IF NOT EXISTS timetable (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) DEFAULT '',
      day_of_week TINYINT NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      room VARCHAR(60) DEFAULT '',
      created_at DATETIME NOT NULL,
      INDEX idx_course (course_title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: course materials / lecture notes ---------------------------
    `CREATE TABLE IF NOT EXISTS materials (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      doc_id VARCHAR(40) DEFAULT '',
      external_url VARCHAR(500) DEFAULT '',
      created_at DATETIME NOT NULL,
      INDEX idx_course (course_title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: course announcements ---------------------------------------
    `CREATE TABLE IF NOT EXISTS announcements (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT,
      pinned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_course (course_title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    // ---- Campus: quizzes (MCQ online tests) ---------------------------------
    `CREATE TABLE IF NOT EXISTS quizzes (
      id VARCHAR(40) PRIMARY KEY,
      course_title VARCHAR(190) NOT NULL,
      teacher_id VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      description VARCHAR(400) DEFAULT '',
      duration_minutes INT NOT NULL DEFAULT 15,
      pass_percent INT NOT NULL DEFAULT 50,
      status ENUM('draft','published','closed') NOT NULL DEFAULT 'published',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_course (course_title),
      INDEX idx_teacher (teacher_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS quiz_questions (
      id VARCHAR(40) PRIMARY KEY,
      quiz_id VARCHAR(40) NOT NULL,
      q_no INT NOT NULL DEFAULT 1,
      question TEXT NOT NULL,
      option_a VARCHAR(400) NOT NULL,
      option_b VARCHAR(400) NOT NULL,
      option_c VARCHAR(400) DEFAULT '',
      option_d VARCHAR(400) DEFAULT '',
      correct CHAR(1) NOT NULL,
      marks DECIMAL(6,2) NOT NULL DEFAULT 1,
      INDEX idx_quiz (quiz_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS quiz_attempts (
      id VARCHAR(40) PRIMARY KEY,
      quiz_id VARCHAR(40) NOT NULL,
      student_id VARCHAR(40) NOT NULL,
      started_at DATETIME NOT NULL,
      submitted_at DATETIME NULL,
      score DECIMAL(8,2) DEFAULT NULL,
      total DECIMAL(8,2) DEFAULT NULL,
      status ENUM('in_progress','submitted') NOT NULL DEFAULT 'in_progress',
      UNIQUE KEY uniq_attempt (quiz_id, student_id),
      INDEX idx_student (student_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS quiz_answers (
      id VARCHAR(40) PRIMARY KEY,
      attempt_id VARCHAR(40) NOT NULL,
      question_id VARCHAR(40) NOT NULL,
      choice CHAR(1) DEFAULT '',
      correct TINYINT(1) NOT NULL DEFAULT 0,
      marks DECIMAL(6,2) NOT NULL DEFAULT 0,
      INDEX idx_attempt (attempt_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS login_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(40) NULL,
      email VARCHAR(190) NOT NULL DEFAULT '',
      role VARCHAR(20) NOT NULL DEFAULT '',
      full_name VARCHAR(120) NOT NULL DEFAULT '',
      status ENUM('success','failed','suspended','blocked') NOT NULL DEFAULT 'success',
      ip VARCHAR(64) DEFAULT '',
      user_agent VARCHAR(255) DEFAULT '',
      created_at DATETIME NOT NULL,
      INDEX idx_created (created_at),
      INDEX idx_email (email),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];
  for (const sql of t) await pool.query(sql);
  // Keep the audit trail for 180 days only.
  try {
    await pool.query("DELETE FROM login_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)");
  } catch {
    /* ignore */
  }
  console.log(" Portal schema ready");
}

// ---------------------------------------------------------------------------
// Data accessors
// ---------------------------------------------------------------------------
const q = (sql, params) => getPool().query(sql, params);

// ---------------------------------------------------------------------------
// Login audit trail
// ---------------------------------------------------------------------------
async function logLogin(entry) {
  try {
    const pool = getPool();
    if (!pool) return;
    const status = ["success", "failed", "suspended", "blocked"].includes(entry.status)
      ? entry.status
      : "success";
    await pool.query(
      `INSERT INTO login_logs (user_id, email, role, full_name, status, ip, user_agent, created_at)
       VALUES (?,?,?,?,?,?,?,NOW())`,
      [
        entry.userId || null,
        String(entry.email || "").slice(0, 190),
        String(entry.role || "").slice(0, 20),
        String(entry.fullName || "").slice(0, 120),
        status,
        String(entry.ip || "").slice(0, 64),
        String(entry.userAgent || "").slice(0, 255),
      ]
    );
  } catch {
    // Never let audit logging break authentication.
  }
}

async function getUserById(id) {
  const [r] = await q("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return r[0] || null;
}
async function getUserByEmail(email) {
  const [r] = await q("SELECT * FROM users WHERE email = ? LIMIT 1", [String(email).toLowerCase()]);
  return r[0] || null;
}
async function getStudentProfile(userId) {
  const [r] = await q("SELECT * FROM student_profiles WHERE user_id = ? LIMIT 1", [userId]);
  return r[0] || null;
}
async function getTeacherProfile(userId) {
  const [r] = await q("SELECT * FROM teacher_profiles WHERE user_id = ? LIMIT 1", [userId]);
  return r[0] || null;
}
async function getEnrollmentsForUser(userId) {
  const [r] = await q(
    "SELECT * FROM enrollments WHERE user_id = ? ORDER BY created_at DESC",
    [userId]
  );
  return r;
}
async function getEnrollment(id) {
  const [r] = await q("SELECT * FROM enrollments WHERE id = ? LIMIT 1", [id]);
  return r[0] || null;
}
async function getEnrollmentDocs(enrollmentId) {
  const [r] = await q("SELECT * FROM documents WHERE scope = 'enrollment' AND ref_id = ? ORDER BY uploaded_at ASC", [enrollmentId]);
  return r;
}
async function getPayments(enrollmentId) {
  const [r] = await q("SELECT * FROM payments WHERE enrollment_id = ? ORDER BY paid_at ASC", [enrollmentId]);
  return r;
}
async function paidTotal(enrollmentId) {
  const [[r]] = await q("SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE enrollment_id = ?", [enrollmentId]);
  return Number(r.s || 0);
}
async function getDocument(id) {
  const [r] = await q("SELECT * FROM documents WHERE id = ? LIMIT 1", [id]);
  return r[0] || null;
}
async function getUserDocuments(userId) {
  const [r] = await q("SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
  return r;
}
async function getNotices(user) {
  const [r] = await q(
    `SELECT * FROM notices
     WHERE audience IN ('all', ?) OR (audience = 'user' AND target_user = ?)
     ORDER BY created_at DESC LIMIT 30`,
    [user.role === "teacher" ? "teachers" : "students", user.id]
  );
  return r;
}
async function createNotice(audience, targetUser, title, body) {
  await q("INSERT INTO notices (id, audience, target_user, title, body, created_at) VALUES (?,?,?,?,?,NOW())", [
    uid("note_"), audience || "all", targetUser || "", title, body || "",
  ]);
}
async function createSession(userId, ip, ua) {
  const id = crypto.randomBytes(32).toString("hex");
  await q(
    "INSERT INTO sessions (id, user_id, created_at, expires_at, ip, user_agent) VALUES (?,?,NOW(), DATE_ADD(NOW(), INTERVAL ? DAY),?,?)",
    [id, userId, SESSION_DAYS, String(ip || "").slice(0, 45), String(ua || "").slice(0, 250)]
  );
  return id;
}
async function saveDocument({ scope, refId, userId, kind, label, file, uploadedBy, subdir }) {
  const rel = (subdir || "documents") + "/" + file.filename;
  const id = uid("doc_");
  await q(
    "INSERT INTO documents (id, scope, ref_id, user_id, kind, label, originalname, relpath, size, uploaded_by, uploaded_at) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())",
    [id, scope, refId || "", userId || "", kind || "other", label || "", file.originalname || file.filename, rel, file.size || 0, uploadedBy || "public"]
  );
  return id;
}
async function setPaymentStatus(enrollmentId) {
  const en = await getEnrollment(enrollmentId);
  if (!en) return;
  const paid = await paidTotal(enrollmentId);
  const total = Number(en.amount_total || 0);
  let status = "unpaid";
  if (paid > 0) status = total > 0 && paid >= total ? "paid" : "partial";
  await q("UPDATE enrollments SET payment_status = ?, updated_at = NOW() WHERE id = ?", [status, enrollmentId]);
}

/**
 * Called from the public /api/enroll route to create a managed enrollment record.
 * Returns { id } or null when the portal DB is unavailable.
 */
async function recordEnrollment({ user, course, courseId, price, enrollmentType, name, email, phone, files, notes }) {
  const pool = getPool();
  if (!pool) return null;
  try {
    const id = uid("enr_");
    const numeric = String(price || "").replace(/[^0-9.]/g, "");
    await q(
      `INSERT INTO enrollments (id, user_id, course_id, course_title, price, enrollment_type, status, payment_status, amount_total, notes, created_at, updated_at)
       VALUES (?,?,?,?,?,?, 'pending', 'unpaid', ?, ?, NOW(), NOW())`,
      [id, user ? user.id : null, courseId || "", course, price || "", enrollmentType || "Online",
        numeric ? Number(numeric) : 0, notes || ""]
    );
    // Attach uploaded documents
    for (const f of files || []) {
      await saveDocument({
        scope: "enrollment", refId: id, userId: user ? user.id : "",
        kind: f.fieldname, label: (f.label || f.fieldname), file: f,
        uploadedBy: user ? user.role : "public", subdir: "enrollments",
      });
    }
    return { id };
  } catch (err) {
    console.error("recordEnrollment failed:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
function uploadName(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const base = path.basename(file.originalname || "file", ext).replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40);
  return uid("f_") + (base ? "_" + base : "") + ext;
}

function makeUpload(subdir, exts, maxFiles = 6) {
  const dest = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dest, { recursive: true });
  return multer({
    storage: multer.diskStorage({ destination: dest, filename: (req, f, cb) => cb(null, uploadName(f)) }),
    limits: { fileSize: 10 * 1024 * 1024, files: maxFiles },
    fileFilter: (req, f, cb) => {
      const ext = path.extname(f.originalname || "").toLowerCase();
      if (exts.includes(ext)) return cb(null, true);
      cb(new Error("Allowed file types: " + exts.map((e) => e.slice(1).toUpperCase()).join(", ")));
    },
  });
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
function deny(res, msg, status = 403) {
  res.status(status).send(
    publicPage("Access denied", `<div class="card narrow"><h1><i class="fa-solid fa-ban"></i> ${esc(msg)}</h1>
      <p class="muted">Please sign in with the right account.</p>
      <p><a class="btn primary" href="/portal/login">Go to sign in</a></p></div>`)
  );
}
function requireUser(...roles) {
  return (req, res, next) => {
    if (!getPool()) return res.status(503).send(publicPage("Portal unavailable", `<div class="card narrow"><h1><i class="fa-solid fa-screwdriver-wrench"></i> Portal offline</h1><p class="muted">The portal needs the database. Please try again shortly.</p></div>`));
    if (!req.user) return res.redirect("/portal/login?next=" + encodeURIComponent(req.originalUrl));
    if (roles.length && !roles.includes(req.user.role)) return deny(res, "This area is for " + roles.join(" / ") + " accounts only");
    if (req.user.status === "suspended") return deny(res, "Your account is suspended. Please contact the academy.");
    if (req.user.status === "rejected") return deny(res, "Your application was not approved.");
    next();
  };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const CSS = `
:root{--bg:#060912;--bg2:#0a0e1c;--bg3:#0d1224;--line:rgba(148,163,255,.14);--line2:rgba(148,163,255,.22);
--p:#3b82f6;--p2:#2563eb;--acc:#60a5fa;--green:#22c55e;--amber:#f59e0b;--red:#ef4444;--txt:#eff0fb;--mut:#9aa2c6;}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--txt);font-family:"Inter",system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
h1,h2,h3{font-family:"Sora",system-ui,sans-serif;line-height:1.25}
.wrap{min-height:100vh;display:flex;flex-direction:column}
.nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:18px;padding:14px 26px;background:rgba(6,9,18,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.logo{font-family:"Sora",sans-serif;font-weight:800;font-size:1.05rem}
.logo b{color:var(--acc)}
.nav .sp{flex:1}
.nav a.lnk{color:var(--mut);font-size:.9rem}
.nav a.lnk:hover{color:var(--txt)}
.chip{display:inline-flex;align-items:center;gap:8px;background:var(--bg3);border:1px solid var(--line);border-radius:999px;padding:5px 12px 5px 6px;font-size:.85rem}
.av{width:26px;height:26px;border-radius:50%;object-fit:cover;background:linear-gradient(135deg,var(--p),var(--p2));display:grid;place-items:center;font-size:.75rem;font-weight:700;color:#fff}
.center{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 18px}
.card{background:linear-gradient(180deg,var(--bg2),var(--bg3));border:1px solid var(--line);border-radius:18px;padding:30px;width:100%;max-width:520px;box-shadow:0 24px 60px rgba(0,0,0,.45)}
.card.wide{max-width:1020px}
.card.narrow{max-width:520px;text-align:center}
.card h1{font-size:1.35rem;margin-bottom:6px}
.muted{color:var(--mut);font-size:.92rem}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}
label{display:block;font-size:.78rem;color:var(--mut);margin:13px 0 5px;font-weight:500}
input,select,textarea{width:100%;height:42px;background:#0b1020;border:1px solid var(--line);color:var(--txt);padding:0 12px;border-radius:3px;font-family:inherit;font-size:.9rem;outline:none}
textarea{height:auto;min-height:90px;padding:10px 12px}
input[type=checkbox],input[type=radio]{height:auto;width:auto;padding:0}
input:focus,select:focus,textarea:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(59,130,246,.18)}
textarea{min-height:90px;resize:vertical}
input[type=file]{padding:9px;font-size:.85rem}
.btn{display:inline-block;padding:11px 20px;border-radius:10px;font-weight:600;font-size:.9rem;border:0;cursor:pointer;font-family:inherit;transition:.2s}
.btn.primary{background:linear-gradient(120deg,var(--p),var(--p2));color:#fff}
.btn.primary:hover{filter:brightness(1.12)}
.btn.ghost{background:var(--surface,rgba(255,255,255,.05));border:1px solid var(--line2);color:var(--txt)}
.btn.sm{padding:6px 12px;font-size:.8rem;border-radius:8px}
.btn.danger{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#fca5a5}
.btn.ok{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#86efac}
.err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.4);color:#fca5a5;padding:11px 14px;border-radius:10px;font-size:.87rem;margin-bottom:8px}
.ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.4);color:#86efac;padding:11px 14px;border-radius:10px;font-size:.87rem;margin-bottom:8px}
.row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.mt{margin-top:18px}
.center-txt{text-align:center}
.muted a{color:var(--acc)}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.side{background:var(--bg2);border-right:1px solid var(--line);padding:16px 10px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto}
.side .brand{font-family:"Sora",sans-serif;font-weight:800;margin-bottom:16px;font-size:1.05rem}
.side .brand b{color:var(--acc)}
.side a{padding:8px 10px;border-radius:3px;color:var(--mut);font-size:12px;line-height:1.35}
.side a:hover{background:rgba(255,255,255,.05);color:var(--txt)}
.side a.on{background:linear-gradient(120deg,var(--p),var(--p2));color:#fff}
.side .who{margin-top:auto;border-top:1px solid var(--line);padding-top:14px;font-size:.8rem;color:var(--mut)}
.who .nm{color:var(--txt);font-weight:600;font-size:.9rem}
.main{padding:30px;min-width:0}
.main h1{font-size:1.45rem}
.sub{color:var(--mut);font-size:.9rem;margin-bottom:22px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;margin-bottom:22px}
.stat{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:18px}
.stat b{display:block;font-family:"Sora",sans-serif;font-size:1.7rem;color:var(--acc)}
.stat span{color:var(--mut);font-size:.82rem}
.panel{background:var(--bg2);border:1px solid var(--line);border-radius:14px;padding:22px;margin-bottom:20px;overflow-x:auto}
.panel h2{font-size:1.05rem;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th,td{padding:11px 13px;text-align:left;border-bottom:1px solid var(--line);font-size:.88rem;vertical-align:top}
th{color:var(--acc);font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
tr:last-child td{border-bottom:0}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700;white-space:nowrap}
.b-pending{background:rgba(245,158,11,.15);color:#fcd34d;border:1px solid rgba(245,158,11,.35)}
.b-approved{background:rgba(96,165,250,.14);color:var(--acc);border:1px solid rgba(96,165,250,.4)}
.b-completed{background:rgba(34,197,94,.14);color:#86efac;border:1px solid rgba(34,197,94,.4)}
.b-rejected{background:rgba(239,68,68,.14);color:#fca5a5;border:1px solid rgba(239,68,68,.4)}
.b-unpaid{background:rgba(148,163,184,.14);color:var(--mut);border:1px solid var(--line2)}
.b-partial{background:rgba(245,158,11,.14);color:#fcd6a0;border:1px solid rgba(245,158,11,.35)}
.b-paid{background:rgba(34,197,94,.14);color:#86efac;border:1px solid rgba(34,197,94,.4)}
.b-submitted{background:rgba(96,165,250,.14);color:var(--acc);border:1px solid rgba(96,165,250,.4)}
.b-graded{background:rgba(34,197,94,.14);color:#86efac;border:1px solid rgba(34,197,94,.4)}
.empty{text-align:center;color:var(--mut);padding:34px}
.note{border-left:3px solid var(--p);background:rgba(59,130,246,.07);border-radius:0 10px 10px 0;padding:12px 16px;margin-bottom:10px}
.note h4{font-size:.95rem}
.note p{color:var(--mut);font-size:.88rem;white-space:pre-wrap}
.progress{height:8px;border-radius:99px;background:#131a2e;overflow:hidden;margin-top:8px}
.progress i{display:block;height:100%;background:linear-gradient(90deg,var(--p),var(--acc))}
.file{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#0b1020;margin-bottom:8px;font-size:.88rem}
.file .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pill{font-size:.72rem;padding:2px 9px;border-radius:99px;background:rgba(59,130,246,.14);color:var(--acc);border:1px solid rgba(59,130,246,.3)}
.side .grp{font-size:.66rem;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);opacity:.75;padding:15px 13px 3px;font-weight:700}
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}
.acard{background:var(--bg3);border:1px solid var(--line);border-radius:12px;padding:15px}
.acard h3{font-size:.92rem;margin-bottom:8px;color:var(--acc)}
.slot{display:flex;gap:9px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:#0b1020;margin-bottom:7px;font-size:.82rem}
.slot .tm{color:var(--acc);font-weight:600;white-space:nowrap;line-height:1.25;font-size:.78rem}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.tag{font-size:.7rem;padding:2px 8px;border-radius:6px;background:rgba(148,163,255,.12);color:var(--mut);border:1px solid var(--line)}
@media(max-width:860px){.shell{grid-template-columns:1fr}.side{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line);align-items:center;position:static;height:auto}.side .brand,.side .who{display:none}.grid2{grid-template-columns:1fr}.main{padding:18px}}
/* Modals */
.modal{position:fixed;inset:0;background:rgba(3,6,15,.72);display:none;align-items:center;justify-content:center;z-index:120;padding:20px}
.modal.open{display:flex}
.modal-box{background:var(--bg2);border:1px solid var(--line);border-radius:6px;width:100%;max-width:620px;max-height:90vh;overflow:auto;padding:22px}
.modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}
.modal-head h3{font-size:1.02rem}
.modal-close{background:none;border:0;color:var(--mut);font-size:1.5rem;line-height:1;cursor:pointer}
.modal-close:hover{color:var(--txt)}
/* DataTables (dark theme overrides) */
.dataTables_wrapper{font-size:.84rem;margin-top:12px;color:var(--mut)}
.dataTables_wrapper .dataTables_filter input{width:200px;height:34px;margin-left:6px;border-radius:3px;border:1px solid var(--line);background:#0b1020;color:var(--txt);padding:0 10px}
.dataTables_wrapper .dataTables_length select{width:auto;height:34px;display:inline-block;margin:0 4px;border-radius:3px;background:#0b1020;color:var(--txt);border:1px solid var(--line);padding:0 8px}
.dataTables_wrapper .dataTables_info,.dataTables_wrapper .dataTables_length,.dataTables_wrapper .dataTables_filter{color:var(--mut);padding-top:10px}
.dataTables_wrapper .dataTables_paginate{padding-top:10px}
.dataTables_wrapper .dataTables_paginate .paginate_button{color:var(--mut)!important;border-radius:3px!important;border:1px solid transparent!important;padding:4px 9px!important}
.dataTables_wrapper .dataTables_paginate .paginate_button.current,.dataTables_wrapper .dataTables_paginate .paginate_button.current:hover{background:var(--p)!important;border-color:var(--p)!important;color:#fff!important}
.dataTables_wrapper .dataTables_paginate .paginate_button:hover{background:rgba(59,130,246,.15)!important;color:var(--txt)!important}
table.dataTable thead th{border-bottom:1px solid var(--line)!important;color:var(--acc)}
table.dataTable.no-footer{border-bottom:1px solid var(--line)}
table.dataTable tbody tr{background:transparent!important}
table.dataTable.stripe tbody tr.odd,table.dataTable.display tbody tr.odd{background:rgba(148,163,255,.04)!important}
table.dataTable.hover tbody tr:hover,table.dataTable.display tbody tr:hover{background:rgba(59,130,246,.08)!important}
`;

const DT_INIT = `<script>(function(){document.addEventListener("click",function(e){var o=e.target.closest("[data-open]");if(o){var m=document.querySelector(o.getAttribute("data-open"));if(m){m.classList.add("open");e.preventDefault();return}}var c=e.target.closest("[data-close]");if(c){var mm=c.closest(".modal");if(mm)mm.classList.remove("open");return}if(e.target.classList&&e.target.classList.contains("modal"))e.target.classList.remove("open")});function boot(){if(!window.jQuery||!jQuery.fn.DataTable)return;document.querySelectorAll("table").forEach(function(t){if(t.getAttribute("data-dt")==="off")return;if(!t.tHead){var first=t.rows[0];if(!first||!first.querySelector("th"))return;var thead=document.createElement("thead");var tbody=document.createElement("tbody");thead.appendChild(first);var rest=[];for(var i=1;i<t.rows.length;i++)rest.push(t.rows[i]);t.insertBefore(thead,t.firstChild);rest.forEach(function(r){tbody.appendChild(r)});t.appendChild(tbody)}try{jQuery(t).DataTable({pageLength:10,lengthMenu:[[10,25,50,-1],[10,25,50,"All"]],order:[],autoWidth:false,columnDefs:[{targets:-1,orderable:false,searchable:false}],language:{search:"",searchPlaceholder:"Search...",emptyTable:"No records",info:"Showing _START_ to _END_ of _TOTAL_",infoEmpty:"No records",zeroRecords:"No matching records",paginate:{previous:"Prev",next:"Next"}}})}catch(e){}})}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot()})();</script>`;

function head(title) {
  return `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<link rel="stylesheet" href="https://cdn.datatables.net/1.13.8/css/jquery.dataTables.min.css">
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/1.13.8/js/jquery.dataTables.min.js"></script>
<style>${CSS}</style>`;
}

function publicPage(title, body) {
  return `<!DOCTYPE html><html lang="en"><head>${head(title + " — CyberNexa Portal")}</head>
<body><div class="wrap">
  <nav class="nav">
    <a href="/" class="logo">Cyber<b>Nexa</b></a>
    <span class="sp"></span>
    <a class="lnk" href="/">Website</a>
    <a class="lnk" href="/portal/login">Sign in</a>
    <a class="btn primary sm" href="/portal/register">Register</a>
  </nav>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px 18px">${body}</div>
</div></body></html>`;
}

function errorPage(title, message) {
  return publicPage(title, `<div class="panel" style="max-width:520px;width:100%;text-align:center">
    <h1 style="font-size:1.25rem;margin-bottom:8px">${esc(title)}</h1>
    <p class="muted">${esc(message)}</p>
    <p style="margin-top:16px"><a class="btn primary sm" href="/portal">Back to portal</a></p>
  </div>`);
}

function shell(user, active, title, sub, body, extraNav = "") {
  const groups = user.role === "teacher"
    ? [{ t: "Overview", items: [["/portal/dashboard", "<i class='fa-solid fa-chart-column'></i> Dashboard", "dash"]] },
       { t: "Teaching", items: [
           ["/portal/courses", "<i class='fa-solid fa-book-open'></i> My Courses", "courses"],
           ["/portal/assignments", "<i class='fa-solid fa-pen-to-square'></i> Assignments", "assign"],
           ["/portal/quizzes", "<i class='fa-solid fa-flask'></i> Quizzes", "quizzes"],
           ["/portal/students", "<i class='fa-solid fa-user-graduate'></i> My Students", "students"]] },
       { t: "Class", items: [
           ["/portal/timetable", "<i class='fa-solid fa-calendar-days'></i> Timetable", "timetable"],
           ["/portal/attendance", "<i class='fa-solid fa-circle-check'></i> Attendance", "attend"],
           ["/portal/materials", "<i class='fa-solid fa-folder'></i> Materials", "materials"]] },
       { t: "Communication", items: [
           ["/portal/announcements", "<i class='fa-solid fa-bullhorn'></i> Announcements", "announce"],
           ["/portal/notices", "<i class='fa-solid fa-bell'></i> Notices", "notices"]] },
       { t: "Account", items: [
           ["/portal/profile", "<i class='fa-solid fa-user'></i> My Profile", "profile"],
           ["/portal/documents", "<i class='fa-solid fa-file-lines'></i> My Documents", "docs"]] }]
    : [{ t: "Overview", items: [["/portal/dashboard", "<i class='fa-solid fa-chart-column'></i> Dashboard", "dash"]] },
       { t: "Academics", items: [
           ["/portal/enrollments", "<i class='fa-solid fa-graduation-cap'></i> My Enrollments", "enroll"],
           ["/portal/assignments", "<i class='fa-solid fa-pen-to-square'></i> Assignments", "assign"],
           ["/portal/quizzes", "<i class='fa-solid fa-flask'></i> Quizzes", "quizzes"],
           ["/portal/marks", "<i class='fa-solid fa-chart-column'></i> My Marks & Result", "marks"]] },
       { t: "Class", items: [
           ["/portal/timetable", "<i class='fa-solid fa-calendar-days'></i> Timetable", "timetable"],
           ["/portal/attendance", "<i class='fa-solid fa-circle-check'></i> Attendance", "attend"],
           ["/portal/materials", "<i class='fa-solid fa-folder'></i> Materials", "materials"]] },
       { t: "Records", items: [
           ["/portal/documents", "<i class='fa-solid fa-file-lines'></i> My Documents", "docs"],
           ["/portal/fees", "<i class='fa-solid fa-sack-dollar'></i> Fees & Payments", "fees"]] },
       { t: "Communication", items: [
           ["/portal/announcements", "<i class='fa-solid fa-bullhorn'></i> Announcements", "announce"],
           ["/portal/notices", "<i class='fa-solid fa-bell'></i> Notices", "notices"]] },
       { t: "Account", items: [["/portal/profile", "<i class='fa-solid fa-user'></i> My Profile", "profile"]] }];
  const nav = groups.map((g) =>
    `<div class="grp">${g.t}</div>` +
    g.items.map(([href, label, key]) => `<a href="${href}" class="${active === key ? "on" : ""}">${label}</a>`).join("")
  ).join("");
  const pending = user.status !== "active"
    ? `<div class="note" style="margin:14px 0 0"><h4><i class="fa-solid fa-hourglass-half"></i> Account ${esc(user.status)}</h4><p>${user.role === "teacher" ? "Your teacher application is waiting for admin approval. You can complete your profile meanwhile." : "Your account is " + esc(user.status) + "."}</p></div>`
    : "";
  return `<!DOCTYPE html><html lang="en"><head>${head(title + " — CyberNexa Portal")}</head>
<body><div class="shell">
  <aside class="side">
    <div class="brand">Cyber<b>Nexa</b> Portal</div>
    ${nav}
    ${extraNav}
    <a href="/" target="_blank"><i class="fa-solid fa-globe"></i> View Website</a>
    <div class="who">
      <div class="nm">${esc(user.full_name)}</div>
      <div>${esc(user.role)} · ${esc(user.email)}</div>
      <form method="post" action="/portal/logout" style="margin-top:10px">
        <button class="btn ghost sm" type="submit">Sign out</button>
      </form>
    </div>
  </aside>
  <main class="main">
    <h1>${esc(title)}</h1>
    <p class="sub">${sub}</p>
    ${pending}
    ${body}
  </main>
</div>${DT_INIT}</body></html>`;
}

function statusBadge(s) {
  return `<span class="badge b-${esc(s)}">${esc(s)}</span>`;
}

async function completeProfile(user) {
  if (user.role !== "student") return null;
  const p = await getStudentProfile(user.id);
  const checks = [
    ["Full name", !!user.full_name],
    ["Phone", !!user.phone],
    ["Date of birth", !!(p && p.dob)],
    ["CNIC / B-Form", !!(p && p.cnic)],
    ["City", !!(p && p.city)],
    ["Address", !!(p && p.address)],
    ["Guardian", !!(p && (p.guardian_name || p.guardian_phone))],
    ["Last qualification", !!(p && p.last_qualification)],
  ];
  const done = checks.filter((c) => c[1]).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter((c) => !c[1]).map((c) => c[0]) };
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
function mount(app, context) {
  ctx = context;
  UPLOAD_ROOT = ctx.uploadRoot;
  for (const d of ["documents", "avatars", "enrollments"]) fs.mkdirSync(path.join(UPLOAD_ROOT, d), { recursive: true });

  const form = express.urlencoded({ extended: false, limit: "300kb" });
  const avatarUpload = makeUpload("avatars", [".jpg", ".jpeg", ".png", ".webp"], 1);
  const docUpload = makeUpload("documents", [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".heic", ".heif"], 10);
  const cvUpload = makeUpload("documents", [".pdf", ".jpg", ".jpeg", ".png"], 1);

  // Wrap only async non-error handlers we register here. Avoid wrapping
  // the error handlers already mounted (Express 4 treats the 4-arg fn
  // differently). We only wrap when a handler is explicitly async.
  const wrap = (fn) => {
    if (typeof fn !== "function") return fn;
    // Don't wrap error-handling middleware (4 args) or upload middlewares.
    if (fn.length >= 4) return fn;
    return function (req, res, next) {
      try {
        const out = fn(req, res, next);
        if (out && typeof out.then === "function") {
          out.catch((err) => next(err));
        }
      } catch (err) {
        next(err);
      }
    };
  };
  ["get", "post", "put", "patch", "delete"].forEach((method) => {
    const original = app[method];
    if (typeof original !== "function") return;
    app[method] = function (route, ...handlers) {
      // If called as app.get(route, ...) keep wrapping; if called as
      // app.get(fn) (rare) do not blindly wrap.
      if (typeof route === "function") {
        return original.call(this, wrap(route));
      }
      return original.call(this, route, ...handlers.map(wrap));
    }.bind(app);
  });

  // ---- attach req.user is registered early from server.js (attachUser) ----

  // ---- nav helper for the public website ----
  app.get("/api/me", (req, res) => {
    if (!req.user) return res.json({ ok: true, user: null });
    res.json({ ok: true, user: { name: req.user.full_name, role: req.user.role, status: req.user.status } });
  });

  // ============================= PUBLIC =============================
  app.get("/portal", (req, res) => {
    if (req.user) return res.redirect("/portal/dashboard");
    res.redirect("/portal/login");
  });

  app.get("/portal/login", (req, res) => {
    if (req.user) return res.redirect("/portal/dashboard");
    const notice = req.query.reset === "1" ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> Password updated — please sign in.</div>` : "";
    const err = req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : "";
    res.send(publicPage("Sign in", `
      <div class="card narrow">
        <h1>Sign in</h1>
        <p class="muted" style="margin-bottom:16px">One login for students, teachers and the admin panel.</p>
        ${notice}${err}
        <form method="post" action="/portal/login">
          <input type="hidden" name="next" value="${esc(req.query.next || "")}">
          <label>Email</label><input type="email" name="email" required autocomplete="email">
          <label>Password</label><input type="password" name="password" required autocomplete="current-password">
          <button class="btn primary mt" style="width:100%" type="submit">Sign in</button>
        </form>
        <p class="mt center-txt"><a class="muted" href="/portal/forgot">Forgot password?</a></p>
        <p class="mt center-txt muted">New here? <a href="/portal/register">Create an account</a></p>
      </div>`));
  });

  app.post("/portal/login", form, async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const next = String(req.body.next || "");
    // Admin credentials are accepted here too — one sign-in page for everyone.
    const admin = ctx.tryAdminLogin ? ctx.tryAdminLogin(email, password, res, req) : "skip";
    if (admin === "ok") return res.redirect("/admin/dashboard");
    if (admin === "blocked") {
      return res.redirect("/portal/login?e=" + encodeURIComponent("Too many attempts. Please wait 15 minutes and try again."));
    }
    if (admin === "fail") {
      return res.redirect("/portal/login?e=" + encodeURIComponent("Wrong email or password") + (next ? "&next=" + encodeURIComponent(next) : ""));
    }
    if (!getPool()) return res.redirect("/portal/login?e=Portal+is+offline");
    try {
      const user = await getUserByEmail(email);
      const ua = req.headers["user-agent"];
      if (!user || !verifyPassword(password, user.password_hash)) {
        await logLogin({
          userId: user ? user.id : null,
          email,
          role: user ? user.role : "",
          fullName: user ? user.full_name : "",
          status: "failed",
          ip: req.ip,
          userAgent: ua,
        });
        return res.redirect("/portal/login?e=" + encodeURIComponent("Wrong email or password") + (next ? "&next=" + encodeURIComponent(next) : ""));
      }
      if (user.status === "suspended") {
        await logLogin({
          userId: user.id,
          email: user.email,
          role: user.role,
          fullName: user.full_name,
          status: "suspended",
          ip: req.ip,
          userAgent: ua,
        });
        return res.redirect("/portal/login?e=" + encodeURIComponent("Account suspended — contact the academy"));
      }
      const sid = await createSession(user.id, req.ip, req.headers["user-agent"]);
      await q("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);
      await logLogin({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.full_name,
        status: "success",
        ip: req.ip,
        userAgent: ua,
      });
      setSessionCookie(res, sid);
      res.redirect(next && next.startsWith("/") ? next : "/portal/dashboard");
    } catch (err) {
      console.error("login failed:", err.message);
      res.redirect("/portal/login?e=" + encodeURIComponent("Something went wrong. Try again."));
    }
  });

  app.post("/portal/logout", (req, res) => {
    const sid = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
    if (sid && getPool()) q("DELETE FROM sessions WHERE id = ?", [sid]).catch(() => {});
    clearSessionCookie(res);
    res.redirect("/portal/login");
  });

  app.get("/portal/register", (req, res) => {
    if (req.user) return res.redirect("/portal/dashboard");
    res.send(publicPage("Register", `
      <div class="card narrow">
        <h1>Join the CyberNexa Academy</h1>
        <p class="muted" style="margin-bottom:18px">Choose how you want to join.</p>
        <a class="file" href="/portal/register/student" style="padding:18px">
          <span style="font-size:1.6rem"><i class="fa-solid fa-graduation-cap"></i></span>
          <span class="nm"><strong>Student</strong><br><span class="muted">Enroll in courses, upload documents, track your progress</span></span>
        </a>
        <a class="file" href="/portal/register/teacher" style="padding:18px">
          <span style="font-size:1.6rem"><i class="fa-solid fa-chalkboard-user"></i></span>
          <div class="nm"><strong>Teacher / Instructor</strong>
          <div class="muted" style="white-space:normal">Apply to teach. Your application is reviewed and approved by the academy.</div></div>
        </a>
      </div>`));
  });

  app.get("/portal/register/student", (req, res) => {
    res.send(publicPage("Student registration", `
      <div class="card">
        <h1><i class="fa-solid fa-graduation-cap"></i> Student registration</h1>
        <p class="muted" style="margin-bottom:8px">Create your account, then complete your profile.</p>
        ${req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : ""}
        <form method="post" action="/portal/register/student">
          <label>Full name *</label><input name="full_name" required maxlength="120">
          <div class="grid2">
            <div><label>Email *</label><input type="email" name="email" required maxlength="190"></div>
            <div><label>Mobile *</label><input name="phone" required placeholder="03001234567"></div>
          </div>
          <div class="grid2">
            <div><label>Password *</label><input type="password" name="password" required minlength="8"></div>
            <div><label>Confirm password *</label><input type="password" name="password2" required minlength="8"></div>
          </div>
          <p class="muted mt" style="font-size:.82rem">Password: at least 8 characters, with letters and numbers.</p>
          <button class="btn primary mt" style="width:100%" type="submit">Create student account</button>
        </form>
        <p class="mt center-txt muted">Already registered? <a href="/portal/login">Sign in</a></p>
      </div>`));
  });

  app.post("/portal/register/student", form, async (req, res) => {
    const back = (msg) => res.redirect("/portal/register/student?e=" + encodeURIComponent(msg));
    if (!getPool()) return back("Portal is offline, try later");
    const full_name = String(req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");

    if (full_name.length < 2) return back("Please enter your full name");
    if (!ctx.isValidEmail(email)) return back("Please enter a valid email address");
    if (!ctx.isValidPKPhone(phone)) return back("Enter a valid Pakistani mobile number (e.g. 0300 1234567)");
    const pp = passwordProblems(password);
    if (pp) return back(pp);
    if (password !== password2) return back("Passwords do not match");

    try {
      if (await getUserByEmail(email)) return back("An account with this email already exists — please sign in");
      const id = uid("usr_");
      await q(
        "INSERT INTO users (id, role, email, password_hash, full_name, phone, status, created_at, updated_at) VALUES (?,?,?,?,?,?, 'active', NOW(), NOW())",
        [id, "student", email, hashPassword(password), full_name, phone]
      );
      await q("INSERT INTO student_profiles (user_id, updated_at) VALUES (?, NOW())", [id]);
      await createNotice("user", id, "Welcome to CyberNexa", "Your student account is ready. Complete your profile and explore our courses.");
      const sid = await createSession(id, req.ip, req.headers["user-agent"]);
      setSessionCookie(res, sid);
      ctx.notifyOwner("New Student Registration", { Name: full_name, Email: email, Phone: phone }, ctx.originOf(req)).catch(() => {});
      res.redirect("/portal/profile?welcome=1");
    } catch (err) {
      console.error("student register failed:", err.message);
      back("Could not create the account. Please try again.");
    }
  });

  app.get("/portal/register/teacher", (req, res) => {
    res.send(publicPage("Teacher application", `
      <div class="card">
        <h1><i class="fa-solid fa-chalkboard-user"></i> Teacher application</h1>
        <p class="muted" style="margin-bottom:8px">Apply to teach at CyberNexa. An admin reviews every application.</p>
        ${req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : ""}
        <form method="post" action="/portal/register/teacher" enctype="multipart/form-data">
          <label>Full name *</label><input name="full_name" required maxlength="120">
          <div class="grid2">
            <div><label>Email *</label><input type="email" name="email" required maxlength="190"></div>
            <div><label>Mobile *</label><input name="phone" required placeholder="03001234567"></div>
          </div>
          <div class="grid2">
            <div><label>Password *</label><input type="password" name="password" required minlength="8"></div>
            <div><label>Confirm password *</label><input type="password" name="password2" required minlength="8"></div>
          </div>
          <label>Highest qualification *</label><input name="qualification" required maxlength="200" placeholder="e.g. MS Computer Science">
          <div class="grid2">
            <div><label>Subjects / expertise *</label><input name="expertise" required maxlength="240" placeholder="Networking, CEH, Linux"></div>
            <div><label>Teaching experience (years)</label><input type="number" name="experience_years" min="0" max="60" value="0"></div>
          </div>
          <label>Short bio</label><textarea name="bio" maxlength="1200" placeholder="Tell us about your teaching experience"></textarea>
          <label>CV / Resume (PDF or image, optional)</label><input type="file" name="cv" accept=".pdf,.jpg,.jpeg,.png">
          <label>Portfolio / LinkedIn (optional)</label><input name="portfolio_url" maxlength="240">
          <button class="btn primary mt" style="width:100%" type="submit">Submit application</button>
        </form>
        <p class="mt center-txt muted">Already applied? <a href="/portal/login">Sign in</a></p>
      </div>`));
  });

  app.post("/portal/register/teacher", (req, res, next) => {
    cvUpload.single("cv")(req, res, (err) => {
      if (err) return res.redirect("/portal/register/teacher?e=" + encodeURIComponent(err.message || "Upload failed"));
      next();
    });
  }, form, async (req, res) => {
    const back = (msg) => res.redirect("/portal/register/teacher?e=" + encodeURIComponent(msg));
    if (!getPool()) return back("Portal is offline, try later");
    const full_name = String(req.body.full_name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");
    const qualification = String(req.body.qualification || "").trim();
    const expertise = String(req.body.expertise || "").trim();
    const experience_years = Math.max(0, Math.min(60, Number(req.body.experience_years || 0)));
    const bio = String(req.body.bio || "").trim();
    const portfolio_url = String(req.body.portfolio_url || "").trim();

    if (full_name.length < 2) return back("Please enter your full name");
    if (!ctx.isValidEmail(email)) return back("Please enter a valid email address");
    if (!ctx.isValidPKPhone(phone)) return back("Enter a valid Pakistani mobile number");
    const pp = passwordProblems(password);
    if (pp) return back(pp);
    if (password !== password2) return back("Passwords do not match");
    if (qualification.length < 2) return back("Please enter your highest qualification");
    if (expertise.length < 2) return back("Please list your subjects / expertise");

    try {
      if (await getUserByEmail(email)) return back("An account with this email already exists — please sign in");
      const id = uid("usr_");
      await q(
        "INSERT INTO users (id, role, email, password_hash, full_name, phone, status, created_at, updated_at) VALUES (?,?,?,?,?,?, 'pending', NOW(), NOW())",
        [id, "teacher", email, hashPassword(password), full_name, phone]
      );
      await q(
        `INSERT INTO teacher_profiles (user_id, qualification, expertise, experience_years, bio, portfolio_url, applied_at, updated_at)
         VALUES (?,?,?,?,?,?, NOW(), NOW())`,
        [id, qualification, expertise, experience_years, bio, portfolio_url]
      );
      if (req.file) {
        await saveDocument({ scope: "teacher", refId: id, userId: id, kind: "cv", label: "CV / Resume", file: req.file, uploadedBy: "teacher", subdir: "documents" });
      }
      await createNotice("user", id, "Application received", "Thank you for applying. Our academy team will review your application and contact you soon.");
      const sid = await createSession(id, req.ip, req.headers["user-agent"]);
      setSessionCookie(res, sid);
      const fields = { Name: full_name, Email: email, Phone: phone, Qualification: qualification, Expertise: expertise, Experience: experience_years + " years" };
      ctx.notifyOwner("New Teacher Application", fields, ctx.originOf(req)).catch(() => {});
      res.redirect("/portal/dashboard?applied=1");
    } catch (err) {
      console.error("teacher register failed:", err.message);
      back("Could not submit the application. Please try again.");
    }
  });

  // ---- forgot / reset password (admin mediated) ----
  app.get("/portal/forgot", (req, res) => {
    res.send(publicPage("Forgot password", `
      <div class="card narrow">
        <h1>Forgot your password?</h1>
        <p class="muted" style="margin-bottom:8px">Enter your email. Our team will verify and send you a reset link.</p>
        ${req.query.sent ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> Request received. Our admin will send you a reset link shortly.</div>` : ""}
        ${req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : ""}
        <form method="post" action="/portal/forgot">
          <label>Email</label><input type="email" name="email" required>
          <button class="btn primary mt" style="width:100%" type="submit">Submit request</button>
        </form>
        <p class="mt center-txt muted"><a href="/portal/login">Back to sign in</a></p>
      </div>`));
  });

  app.post("/portal/forgot", form, async (req, res) => {
    if (!getPool()) return res.redirect("/portal/forgot?e=Portal+offline");
    const email = String(req.body.email || "").trim().toLowerCase();
    try {
      const user = await getUserByEmail(email);
      if (user) {
        const token = crypto.randomBytes(24).toString("hex");
        await q(
          "INSERT INTO password_resets (id, token, user_id, requested_at, expires_at) VALUES (?,?,?,NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY))",
          [uid("rst_"), token, user.id]
        );
        await createNotice("user", user.id, "Password reset requested", "An admin will contact you with a reset link.");
      }
    } catch (err) {
      console.error("forgot failed:", err.message);
    }
    // Always the same reply (no account enumeration)
    res.redirect("/portal/forgot?sent=1");
  });

  app.get("/portal/reset", async (req, res) => {
    const token = String(req.query.token || "");
    let valid = false;
    if (getPool() && token) {
      const [r] = await q(
        "SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1", [token]
      );
      valid = r.length > 0;
    }
    if (!valid) {
      return res.send(publicPage("Reset link", `<div class="card narrow"><h1><i class="fa-solid fa-triangle-exclamation"></i> Link not valid</h1>
        <p class="muted">This reset link is invalid or has expired. Please request a new one.</p>
        <p class="mt"><a class="btn primary" href="/portal/forgot">Request new link</a></p></div>`));
    }
    res.send(publicPage("Set a new password", `
      <div class="card narrow">
        <h1>Set a new password</h1>
        ${req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : ""}
        <form method="post" action="/portal/reset">
          <input type="hidden" name="token" value="${esc(token)}">
          <label>New password</label><input type="password" name="password" required minlength="8">
          <label>Confirm new password</label><input type="password" name="password2" required minlength="8">
          <button class="btn primary mt" style="width:100%" type="submit">Update password</button>
        </form>
      </div>`));
  });

  app.post("/portal/reset", form, async (req, res) => {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");
    const fail = (m) => res.redirect("/portal/reset?token=" + encodeURIComponent(token) + "&e=" + encodeURIComponent(m));
    const pp = passwordProblems(password);
    if (pp) return fail(pp);
    if (password !== password2) return fail("Passwords do not match");
    if (!getPool()) return fail("Portal is offline");
    const [r] = await q("SELECT * FROM password_resets WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1", [token]);
    if (!r.length) return fail("This reset link has expired");
    await q("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?", [hashPassword(password), r[0].user_id]);
    await q("UPDATE password_resets SET used = 1 WHERE id = ?", [r[0].id]);
    await q("DELETE FROM sessions WHERE user_id = ?", [r[0].user_id]);
    res.redirect("/portal/login?reset=1");
  });

  // ============================= DASHBOARD =============================
  app.get("/portal/dashboard", requireUser("student", "teacher"), async (req, res) => {
    if (req.user.role === "teacher") return teacherDashboard(req, res);
    return studentDashboard(req, res);
  });

  async function studentDashboard(req, res) {
    const u = req.user;
    const enrollments = await getEnrollmentsForUser(u.id);
    const docs = await getUserDocuments(u.id);
    const notices = await getNotices(u);
    let due = 0;
    for (const en of enrollments) {
      const paid = await paidTotal(en.id);
      due += Math.max(0, Number(en.amount_total || 0) - paid);
    }
    const comp = await completeProfile(u);
    const asg = (await q(
      `SELECT a.id, a.title, a.course_title, a.due_date, a.max_marks,
              s.status AS sub_status, s.marks AS sub_marks
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
       WHERE a.status <> 'draft' AND a.course_title IN (
         SELECT course_title FROM enrollments
         WHERE user_id = ? AND status <> 'rejected' AND course_title <> ''
       )
       ORDER BY (a.due_date IS NULL), a.due_date ASC LIMIT 20`,
      [u.id, u.id]
    ))[0];
    const pendingCount = asg.filter((a) => !a.sub_status).length;
    const gradedCount = asg.filter((a) => a.sub_status === "graded").length;
    // attendance snapshot
    const [[att]] = await q(
      `SELECT COUNT(*) AS total, COALESCE(SUM(a.status IN ('present','late')),0) AS attended
       FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id
       WHERE a.student_id = ? AND a.status <> 'excused'`,
      [u.id]
    );
    const attPct = Number(att.total) > 0 ? Math.round((Number(att.attended) / Number(att.total)) * 100) : null;
    // quizzes available / pending
    const qz = (await q(
      `SELECT z.id, z.title, z.course_title, z.duration_minutes, z.status,
              a.status AS at_status, a.score, a.total
       FROM quizzes z
       LEFT JOIN quiz_attempts a ON a.quiz_id = z.id AND a.student_id = ?
       WHERE z.status = 'published' AND z.course_title IN (
         SELECT course_title FROM enrollments WHERE user_id = ? AND status <> 'rejected' AND course_title <> ''
       )
       ORDER BY (a.status = 'submitted'), z.created_at DESC LIMIT 20`,
      [u.id, u.id]
    ))[0];
    const quizPending = qz.filter((z) => z.at_status !== "submitted").length;
    // latest announcements
    const announcements = (await q(
      `SELECT n.*, t.full_name AS teacher FROM announcements n LEFT JOIN users t ON t.id = n.teacher_id
       WHERE n.course_title IN (
         SELECT course_title FROM enrollments WHERE user_id = ? AND status <> 'rejected' AND course_title <> ''
       ) ORDER BY n.pinned DESC, n.created_at DESC LIMIT 3`,
      [u.id]
    ))[0];
    // today's classes
    const dayNum = ((new Date().getDay() + 6) % 7) + 1; // Mon=1 .. Sun=7
    const todaySlots = (await q(
      `SELECT * FROM timetable WHERE day_of_week = ? AND course_title IN (
         SELECT course_title FROM enrollments WHERE user_id = ? AND status <> 'rejected' AND course_title <> ''
       ) ORDER BY start_time LIMIT 10`,
      [dayNum, u.id]
    ))[0];
    const asgRows = asg.slice(0, 5).map((a) => `
      <tr><td><strong>${esc(a.title)}</strong><div class="muted" style="font-size:.78rem">${esc(a.course_title)}</div></td>
      <td class="muted">${esc(a.due_date || "—")}</td>
      <td>${a.sub_status === "graded" ? `${esc(a.sub_marks)} / ${esc(a.max_marks)}` : a.sub_status ? statusBadge("submitted") : statusBadge("pending")}</td>
      <td><a class="btn ghost sm" href="/portal/assignments/view?id=${esc(a.id)}">Open</a></td></tr>`).join("");
    const rows = enrollments.slice(0, 5).map((en) => `
      <tr><td><strong>${esc(en.course_title)}</strong><div class="muted" style="font-size:.8rem">${esc(en.enrollment_type)}</div></td>
      <td>${esc(en.price)}</td><td>${statusBadge(en.status)}</td><td>${statusBadge(en.payment_status)}</td>
      <td>${esc(en.created_at)}</td></tr>`).join("");
    const welcome = req.query.applied ? `<div class="ok"><i class="fa-solid fa-champagne-glasses"></i> Welcome! Your account is ready.</div>` : "";
    res.send(shell(u, "dash", "Welcome, " + u.full_name.split(" ")[0],
      "Here is your learning overview.",
      `${welcome}
      <div class="cards">
        <div class="stat"><b>${enrollments.length}</b><span>Enrollments</span></div>
        <div class="stat"><b>${attPct === null ? "—" : attPct + "%"}</b><span>Attendance</span></div>
        <div class="stat"><b>${pendingCount}</b><span>Pending tasks</span></div>
        <div class="stat"><b>${quizPending}</b><span>Quizzes to attempt</span></div>
        <div class="stat"><b>${gradedCount}</b><span>Graded</span></div>
        <div class="stat"><b>PKR ${due.toLocaleString("en-PK")}</b><span>Fee due</span></div>
      </div>
      <div class="panel">
        <h2><i class="fa-solid fa-pen-to-square"></i> Assignments &amp; tasks</h2>
        ${asg.length ? `<table><tr><th>Assignment</th><th>Due</th><th>Status</th><th></th></tr>${asgRows}</table>
          <p class="mt"><a class="btn ghost sm" href="/portal/assignments">View all assignments</a></p>`
        : `<p class="muted">No assignments yet. They will appear here once your teacher posts them.</p>`}
      </div>
      <div class="panel">
        <h2><i class="fa-solid fa-calendar-days"></i> Today's classes</h2>
        ${todaySlots.length
          ? `<table><tr><th>Time</th><th>Course</th><th>Room</th></tr>${todaySlots.map((s) => `<tr>
              <td class="muted">${esc(String(s.start_time).slice(0, 5))} – ${esc(String(s.end_time).slice(0, 5))}</td>
              <td><strong>${esc(s.course_title)}</strong></td><td class="muted">${esc(s.room) || "—"}</td></tr>`).join("")}</table>
             <p class="mt"><a class="btn ghost sm" href="/portal/timetable">Full timetable</a></p>`
          : `<p class="muted">No classes scheduled for today. <a href="/portal/timetable">View your timetable</a></p>`}
      </div>
      <div class="panel">
        <h2><i class="fa-solid fa-flask"></i> Quizzes</h2>
        ${qz.length
          ? `<table><tr><th>Quiz</th><th>Duration</th><th>Status</th><th>Score</th><th></th></tr>${qz.slice(0, 5).map((z) => {
              const done = z.at_status === "submitted";
              return `<tr>
                <td><strong>${esc(z.title)}</strong><div class="muted" style="font-size:.78rem">${esc(z.course_title)}</div></td>
                <td class="muted">${Number(z.duration_minutes)} min</td>
                <td>${done ? `<span class="badge b-graded">completed</span>` : `<span class="badge b-pending">to attempt</span>`}</td>
                <td>${done ? `<strong>${esc(z.score)}</strong> / ${esc(z.total)}` : `<span class="muted">—</span>`}</td>
                <td><a class="btn ${done ? "ghost" : "primary"} sm" href="/portal/quizzes/${done ? "result" : "take"}?id=${esc(z.id)}">${done ? "Result" : "Attempt"}</a></td>
              </tr>`;
            }).join("")}</table>
             <p class="mt"><a class="btn ghost sm" href="/portal/quizzes">All quizzes</a></p>`
          : `<p class="muted">No quizzes available right now.</p>`}
      </div>
      <div class="panel">
        <h2>Profile completeness — ${comp.pct}%</h2>
        <div class="progress"><i style="width:${comp.pct}%"></i></div>
        ${comp.missing.length ? `<p class="muted mt">Still missing: ${esc(comp.missing.join(", "))}</p>` : `<p class="mt" style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> Your profile is complete.</p>`}
        <p class="mt"><a class="btn primary sm" href="/portal/profile">${comp.pct === 100 ? "View profile" : "Complete profile"}</a></p>
      </div>
      <div class="panel">
        <h2>Recent enrollments</h2>
        <table><tr><th>Course</th><th>Fee</th><th>Status</th><th>Payment</th><th>Date</th></tr>
        ${rows || `<tr><td colspan="5" class="empty">No enrollments yet. <a href="/courses">Browse courses</a></td></tr>`}</table>
        ${enrollments.length ? `<p class="mt"><a class="btn ghost sm" href="/portal/enrollments">View all</a></p>` : ""}
      </div>
      ${announcements.length ? `<div class="panel"><h2><i class="fa-solid fa-bullhorn"></i> Announcements</h2>${announcements.map((n) => `<div class="note"><h4>${esc(n.title)} <span class="pill">${esc(n.course_title)}</span></h4><p>${esc(n.body || "")}</p><p class="muted" style="font-size:.76rem;margin-top:4px">${esc(n.created_at)} · ${esc(n.teacher || "Teacher")}</p></div>`).join("")}
        <p class="mt"><a class="btn ghost sm" href="/portal/announcements">All announcements</a></p></div>` : ""}
      ${notices.length ? `<div class="panel"><h2><i class="fa-solid fa-bell"></i> Notices</h2>${notices.slice(0, 3).map(noteHtml).join("")}</div>` : ""}
      <div class="panel"><h2>Quick actions</h2><div class="row">
        <a class="btn primary sm" href="/courses"><i class="fa-solid fa-graduation-cap"></i> Enroll in a course</a>
        <a class="btn ghost sm" href="/portal/assignments"><i class="fa-solid fa-pen-to-square"></i> Assignments</a>
        <a class="btn ghost sm" href="/portal/timetable"><i class="fa-solid fa-calendar-days"></i> Timetable</a>
        <a class="btn ghost sm" href="/portal/materials"><i class="fa-solid fa-folder"></i> Materials</a>
        <a class="btn ghost sm" href="/portal/transcript"><i class="fa-solid fa-print"></i> Result card</a>
        <a class="btn ghost sm" href="/portal/fees"><i class="fa-solid fa-sack-dollar"></i> Fee details</a>
      </div></div>`));
  }

  async function teacherDashboard(req, res) {
    const u = req.user;
    const tp = (await getTeacherProfile(u.id)) || {};
    const mine = (await q("SELECT * FROM teacher_courses WHERE teacher_id = ? ORDER BY created_at DESC", [u.id]))[0];
    const notices = await getNotices(u);
    const docs = await getUserDocuments(u.id);
    const [[asgStat]] = await q(
      `SELECT COUNT(*) AS total,
        (SELECT COUNT(*) FROM submissions s JOIN assignments a2 ON a2.id = s.assignment_id
          WHERE a2.teacher_id = ? AND s.status = 'submitted') AS tograde
       FROM assignments WHERE teacher_id = ?`,
      [u.id, u.id]
    );
    const recentAsg = (await q(
      `SELECT a.*, (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS subs
       FROM assignments a WHERE a.teacher_id = ? ORDER BY a.created_at DESC LIMIT 5`,
      [u.id]
    ))[0];
    const [[qzStat]] = await q("SELECT COUNT(*) AS total FROM quizzes WHERE teacher_id = ?", [u.id]);
    const [[matStat]] = await q("SELECT COUNT(*) AS total FROM materials WHERE teacher_id = ?", [u.id]);
    const [[attStat]] = await q(
      `SELECT COUNT(*) AS sessions,
              (SELECT COUNT(*) FROM attendance_sessions s WHERE s.teacher_id = ? AND s.session_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)) AS week
       FROM attendance_sessions WHERE teacher_id = ?`,
      [u.id, u.id]
    );
    const dayNum = ((new Date().getDay() + 6) % 7) + 1;
    const todaySlots = (await q(
      `SELECT * FROM timetable WHERE day_of_week = ? AND course_title IN (
         SELECT course_title FROM teacher_courses WHERE teacher_id = ?
       ) ORDER BY start_time LIMIT 10`,
      [dayNum, u.id]
    ))[0];
    const asgRows = recentAsg.map((a) => `<tr>
      <td><strong>${esc(a.title)}</strong><div class="muted" style="font-size:.78rem">${esc(a.course_title)}</div></td>
      <td class="muted">${esc(a.due_date || "—")}</td>
      <td>${Number(a.subs || 0)}</td>
      <td><a class="btn ghost sm" href="/portal/assignments/view?id=${esc(a.id)}">Open</a></td></tr>`).join("");
    const rows = mine
      .map((c) => `<tr><td><strong>${esc(c.course_title)}</strong></td><td class="muted">${esc(c.created_at)}</td></tr>`)
      .join("");
    res.send(shell(u, "dash", "Welcome, " + u.full_name.split(" ")[0], "Your instructor dashboard.",
      `${req.query.applied ? `<div class="ok"><i class="fa-solid fa-champagne-glasses"></i> Application submitted! Our academy team will review it soon.</div>` : ""}
      ${u.status === "pending" ? `<div class="note"><h4><i class="fa-solid fa-hourglass-half"></i> Application under review</h4><p>You can complete your profile meanwhile. An admin will approve your account before you start teaching.</p></div>` : ""}
      ${u.status === "active" ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> Your teacher account is approved.</div>` : ""}
      <div class="cards">
        <div class="stat"><b style="text-transform:capitalize">${esc(u.status)}</b><span>Account status</span></div>
        <div class="stat"><b>${mine.length}</b><span>Assigned courses</span></div>
        <div class="stat"><b>${Number(asgStat.total || 0)}</b><span>Assignments</span></div>
        <div class="stat"><b>${Number(asgStat.tograde || 0)}</b><span>To grade</span></div>
        <div class="stat"><b>${Number(qzStat.total || 0)}</b><span>Quizzes</span></div>
        <div class="stat"><b>${Number(matStat.total || 0)}</b><span>Materials</span></div>
      </div>
      <div class="panel">
        <h2><i class="fa-solid fa-pen-to-square"></i> Recent assignments</h2>
        ${recentAsg.length ? `<table><tr><th>Assignment</th><th>Due</th><th>Submissions</th><th></th></tr>${asgRows}</table>` : `<p class="muted">No assignments posted yet.</p>`}
        <p class="mt"><a class="btn primary sm" href="/portal/assignments/new"><i class="fa-solid fa-plus"></i> Create assignment</a>
          <a class="btn ghost sm" href="/portal/assignments">Manage all</a></p>
      </div>
      <div class="panel"><h2>My courses</h2>
        ${rows
          ? `<table><tr><th>Course</th><th>Assigned</th></tr>${rows}</table>`
          : `<p class="muted">No courses assigned yet. The academy will assign courses after approval.</p>`}
      </div>
      <div class="panel"><h2><i class="fa-solid fa-calendar-days"></i> Today's classes</h2>
        ${todaySlots.length
          ? `<table><tr><th>Time</th><th>Course</th><th>Room</th><th></th></tr>${todaySlots.map((s) => `<tr>
              <td class="muted">${esc(String(s.start_time).slice(0, 5))} – ${esc(String(s.end_time).slice(0, 5))}</td>
              <td><strong>${esc(s.course_title)}</strong></td><td class="muted">${esc(s.room) || "—"}</td>
              <td><a class="btn ghost sm" href="/portal/attendance?course=${encodeURIComponent(s.course_title)}">Take attendance</a></td></tr>`).join("")}</table>`
          : `<p class="muted">No classes scheduled for today. <a href="/portal/timetable">Manage timetable</a></p>`}
      </div>
      <div class="panel"><h2>Quick actions</h2><div class="row">
        <a class="btn primary sm" href="/portal/assignments/new"><i class="fa-solid fa-pen-to-square"></i> New assignment</a>
        <a class="btn ghost sm" href="/portal/quizzes/new"><i class="fa-solid fa-flask"></i> New quiz</a>
        <a class="btn ghost sm" href="/portal/materials"><i class="fa-solid fa-folder"></i> Share material</a>
        <a class="btn ghost sm" href="/portal/attendance"><i class="fa-solid fa-circle-check"></i> Attendance</a>
        <a class="btn ghost sm" href="/portal/announcements"><i class="fa-solid fa-bullhorn"></i> Announcement</a>
        <a class="btn ghost sm" href="/portal/timetable"><i class="fa-solid fa-calendar-days"></i> Timetable</a>
      </div></div>
      ${notices.length ? `<div class="panel"><h2><i class="fa-solid fa-bell"></i> Notices</h2>${notices.slice(0, 5).map(noteHtml).join("")}</div>` : ""}`));
  }

  function noteHtml(n) {
    return `<div class="note"><h4>${esc(n.title)}</h4><p>${esc(n.body || "")}</p>
      <p class="muted" style="font-size:.76rem;margin-top:4px">${esc(n.created_at)}</p></div>`;
  }

  // ============================= PROFILE =============================
  app.get("/portal/profile", requireUser("student", "teacher"), async (req, res) => {
    const u = req.user;
    const ok = req.query.saved ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> Profile saved.</div>` : "";
    if (u.role === "teacher") {
      const t = (await getTeacherProfile(u.id)) || {};
      const cv = (await q("SELECT * FROM documents WHERE user_id = ? AND kind = 'cv' ORDER BY uploaded_at DESC LIMIT 1", [u.id]))[0][0];
      res.send(shell(u, "profile", "My Profile", "Keep your details up to date.",
        `${ok}
        <div class="panel"><h2>Account</h2>
          <form method="post" action="/portal/profile" enctype="multipart/form-data">
            <div class="grid2">
              <div><label>Full name *</label><input name="full_name" value="${esc(u.full_name)}" required></div>
              <div><label>Mobile</label><input name="phone" value="${esc(u.phone)}"></div>
            </div>
            <label>Email (not editable)</label><input value="${esc(u.email)}" disabled>
            <div class="grid2">
              <div><label>Highest qualification</label><input name="qualification" value="${esc(t.qualification)}"></div>
              <div><label>Teaching experience (years)</label><input type="number" name="experience_years" min="0" max="60" value="${Number(t.experience_years || 0)}"></div>
            </div>
            <label>Subjects / expertise</label><input name="expertise" value="${esc(t.expertise)}">
            <label>Bio</label><textarea name="bio">${esc(t.bio || "")}</textarea>
            <div class="grid2">
              <div><label>Portfolio / LinkedIn</label><input name="portfolio_url" value="${esc(t.portfolio_url)}"></div>
              <div><label>Expected fee</label><input name="expected_fee" value="${esc(t.expected_fee)}"></div>
            </div>
            <label>Availability</label><input name="availability" value="${esc(t.availability)}" placeholder="Evenings, weekends...">
            <label>Profile photo</label><input type="file" name="photo" accept=".jpg,.jpeg,.png,.webp">
            <label>CV / Resume (PDF or image)</label><input type="file" name="cv" accept=".pdf,.jpg,.jpeg,.png">
            ${cv ? `<p class="muted mt">Current CV: <a href="/portal/file/${esc(cv.id)}" target="_blank"><i class="fa-solid fa-paperclip"></i> ${esc(cv.originalname || "CV")}</a></p>` : ""}
            <button class="btn primary mt" type="submit">Save profile</button>
          </form></div>`));
      return;
    }
    const p = (await getStudentProfile(u.id)) || {};
    res.send(shell(u, "profile", "My Profile", "Complete your profile for faster enrollment approval.",
      `${ok}
      <div class="panel"><h2>Personal details</h2>
        <form method="post" action="/portal/profile" enctype="multipart/form-data">
          <div class="grid2">
            <div><label>Full name *</label><input name="full_name" value="${esc(u.full_name)}" required></div>
            <div><label>Mobile</label><input name="phone" value="${esc(u.phone)}"></div>
          </div>
          <label>Email (not editable)</label><input value="${esc(u.email)}" disabled>
          <div class="grid2">
            <div><label>Date of birth</label><input type="date" name="dob" value="${esc(p.dob)}"></div>
            <div><label>Gender</label><select name="gender">
              ${["", "Male", "Female", "Other"].map((g) => `<option ${p.gender === g ? "selected" : ""}>${g}</option>`).join("")}
            </select></div>
          </div>
          <div class="grid2">
            <div><label>CNIC / B-Form</label><input name="cnic" value="${esc(p.cnic)}" placeholder="35202-1234567-1"></div>
            <div><label>City</label><input name="city" value="${esc(p.city)}"></div>
          </div>
          <label>Address</label><input name="address" value="${esc(p.address)}">
          <div class="grid2">
            <div><label>Guardian name</label><input name="guardian_name" value="${esc(p.guardian_name)}"></div>
            <div><label>Guardian mobile</label><input name="guardian_phone" value="${esc(p.guardian_phone)}"></div>
          </div>
          <label>Last qualification</label><input name="last_qualification" value="${esc(p.last_qualification)}">
          <label>Interests</label><input name="interests" value="${esc(p.interests)}" placeholder="Cybersecurity, Cloud...">
          <label>Profile photo</label><input type="file" name="photo" accept=".jpg,.jpeg,.png,.webp">
          <button class="btn primary mt" type="submit">Save profile</button>
        </form></div>`));
  });

  app.post("/portal/profile", requireUser("student", "teacher"), (req, res, next) => {
    avatarUpload.any()(req, res, (err) => next(err));
  }, form, async (req, res) => {
    const u = req.user;
    try {
      const b = req.body;
      const photoFile = (req.files || []).find((f) => f.fieldname === "photo");
      const cvFile = (req.files || []).find((f) => f.fieldname === "cv");
      await q("UPDATE users SET full_name = ?, phone = ?, updated_at = NOW() WHERE id = ?", [
        String(b.full_name || u.full_name).trim() || u.full_name, String(b.phone || "").trim(), u.id,
      ]);
      if (photoFile) {
        await q("UPDATE users SET photo = ? WHERE id = ?", ["avatars/" + photoFile.filename, u.id]);
      }
      if (u.role === "teacher") {
        await q(
          `UPDATE teacher_profiles SET qualification=?, expertise=?, experience_years=?, bio=?, portfolio_url=?, expected_fee=?, availability=?, updated_at=NOW() WHERE user_id = ?`,
          [String(b.qualification || ""), String(b.expertise || ""), Math.max(0, Math.min(60, Number(b.experience_years || 0))),
            String(b.bio || ""), String(b.portfolio_url || ""), String(b.expected_fee || ""), String(b.availability || ""), u.id]
        );
        if (cvFile) await saveDocument({ scope: "teacher", refId: u.id, userId: u.id, kind: "cv", label: "CV / Resume", file: cvFile, uploadedBy: "teacher", subdir: "documents" });
      } else {
        await q(
          `INSERT INTO student_profiles (user_id, dob, gender, cnic, address, city, guardian_name, guardian_phone, last_qualification, interests, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,NOW())
           ON DUPLICATE KEY UPDATE dob=VALUES(dob), gender=VALUES(gender), cnic=VALUES(cnic), address=VALUES(address),
             city=VALUES(city), guardian_name=VALUES(guardian_name), guardian_phone=VALUES(guardian_phone),
             last_qualification=VALUES(last_qualification), interests=VALUES(interests), updated_at=NOW()`,
          [u.id, String(b.dob || "").slice(0, 20), String(b.gender || "").slice(0, 20), String(b.cnic || "").slice(0, 20),
            String(b.address || "").slice(0, 240), String(b.city || "").slice(0, 80), String(b.guardian_name || "").slice(0, 120),
            String(b.guardian_phone || "").slice(0, 30), String(b.last_qualification || "").slice(0, 160), String(b.interests || "").slice(0, 240)]
        );
      }
      res.redirect("/portal/profile?saved=1");
    } catch (err) {
      console.error("profile save failed:", err.message);
      res.redirect("/portal/profile?saved=0&e=" + encodeURIComponent("Save failed"));
    }
  });

  // ============================= STUDENT: ENROLLMENTS / FEES / DOCS =============================
  app.get("/portal/enrollments", requireUser("student"), async (req, res) => {
    const list = await getEnrollmentsForUser(req.user.id);
    const rows = [];
    for (const en of list) {
      const paid = await paidTotal(en.id);
      const docs = await getEnrollmentDocs(en.id);
      const total = Number(en.amount_total || 0);
      rows.push(`
        <div class="panel">
          <div class="row" style="justify-content:space-between">
            <div><strong>${esc(en.course_title)}</strong>
              <div class="muted" style="font-size:.83rem">${esc(en.enrollment_type)} · enrolled ${esc(en.created_at)}</div></div>
            <div class="row">${statusBadge(en.status)} ${statusBadge(en.payment_status)}</div>
          </div>
          <div class="row mt" style="gap:26px">
            <div><div class="muted" style="font-size:.78rem">Course fee</div><strong>${esc(en.price || (total ? "PKR " + total.toLocaleString("en-PK") : "-"))}</strong></div>
            <div><div class="muted" style="font-size:.78rem">Paid</div><strong>PKR ${paid.toLocaleString("en-PK")}</strong></div>
            <div><div class="muted" style="font-size:.78rem">Balance</div><strong>PKR ${Math.max(0, total - paid).toLocaleString("en-PK")}</strong></div>
          </div>
          ${docs.length ? `<div class="mt">${docs.map((d) => docLink(d, "/portal/file/")).join("")}</div>` : ""}
          ${en.notes ? `<p class="muted mt"><i class="fa-solid fa-pen-to-square"></i> ${esc(en.notes)}</p>` : ""}
        </div>`);
    }
    res.send(shell(req.user, "enroll", "My Enrollments", "Track your courses, documents and status.",
      rows.join("") || `<div class="panel"><p class="empty">No enrollments yet. <a href="/courses">Browse courses</a></p></div>`));
  });

  function docLink(d, base) {
    const icon = /pdf$/i.test(d.originalname || "") ? "<i class='fa-solid fa-file-pdf'></i>" : "<i class='fa-solid fa-image'></i>";
    return `<div class="file"><span>${icon}</span><span class="nm">${esc(d.originalname || d.relpath)}</span>
      <span class="pill">${esc(d.label || d.kind)}</span>
      <a class="btn ghost sm" href="${base}${esc(d.id)}" target="_blank">Download</a></div>`;
  }

  app.get("/portal/fees", requireUser("student"), async (req, res) => {
    const list = await getEnrollmentsForUser(req.user.id);
    let out = "";
    for (const en of list) {
      const paid = await paidTotal(en.id);
      const total = Number(en.amount_total || 0);
      const payments = await getPayments(en.id);
      const receipt = (await q("SELECT * FROM documents WHERE scope='enrollment' AND ref_id=? AND kind='receipt' ORDER BY uploaded_at DESC LIMIT 1", [en.id]))[0][0];
      const cert = (await q("SELECT * FROM documents WHERE scope='enrollment' AND ref_id=? AND kind='certificate' ORDER BY uploaded_at DESC LIMIT 1", [en.id]))[0][0];
      out += `<div class="panel">
        <div class="row" style="justify-content:space-between"><strong>${esc(en.course_title)}</strong>${statusBadge(en.payment_status)}</div>
        <div class="row mt" style="gap:26px">
          <div><div class="muted" style="font-size:.78rem">Total</div><strong>PKR ${total.toLocaleString("en-PK")}</strong></div>
          <div><div class="muted" style="font-size:.78rem">Paid</div><strong>PKR ${paid.toLocaleString("en-PK")}</strong></div>
          <div><div class="muted" style="font-size:.78rem">Balance</div><strong>PKR ${Math.max(0, total - paid).toLocaleString("en-PK")}</strong></div>
        </div>
        ${payments.length ? `<table class="mt"><tr><th>Date</th><th>Amount</th><th>Method</th><th>Note</th><th></th></tr>
          ${payments.map((p) => `<tr><td>${esc(p.paid_at)}</td><td>PKR ${Number(p.amount).toLocaleString("en-PK")}</td><td>${esc(p.method)}</td><td class="muted">${esc(p.note)}</td><td><a class="btn ghost sm" href="/portal/fees/receipt/${esc(p.id)}" target="_blank"><i class="fa-solid fa-receipt"></i> Receipt</a></td></tr>`).join("")}</table>` : `<p class="muted mt">No payments recorded yet.</p>`}
        <div class="row mt">
          <a class="btn ghost sm" href="/portal/fees/statement/${esc(en.id)}" target="_blank"><i class="fa-solid fa-print"></i> Print statement</a>
          ${receipt ? `<a class="btn ghost sm" href="/portal/file/${esc(receipt.id)}" target="_blank"><i class="fa-solid fa-receipt"></i> Download receipt</a>` : ""}
          ${cert ? `<a class="btn ok sm" href="/portal/file/${esc(cert.id)}" target="_blank"><i class="fa-solid fa-medal"></i> Download certificate</a>` : ""}
        </div>
      </div>`;
    }
    res.send(shell(req.user, "fees", "Fees & Payments", "Your fee status, payment history and documents.",
      out || `<div class="panel"><p class="empty">Nothing here yet.</p></div>`));
  });

  app.get("/portal/documents", requireUser("student", "teacher"), async (req, res) => {
    const docs = await getUserDocuments(req.user.id);
    const ok = req.query.up ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${Number(req.query.up)} file(s) uploaded.</div>` : "";
    const err = req.query.e ? `<div class="err">${esc(req.query.e)}</div>` : "";
    res.send(shell(req.user, "docs", "My Documents", "Upload and manage your documents.",
      `${ok}${err}
      <div class="panel"><h2><i class="fa-solid fa-upload"></i> Upload documents</h2>
        <form method="post" action="/portal/documents" enctype="multipart/form-data">
          <div class="grid2">
            <div><label>Document type</label><select name="kind">
              ${[["cnic", "CNIC / B-Form"], ["photo", "Photograph"], ["payment", "Payment proof"], ["qualification", "Qualification"], ["other", "Other"]]
                .map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
            </select></div>
            <div><label>Files (JPG, PNG, PDF, max 10 MB)</label><input type="file" name="files" multiple required></div>
          </div>
          <button class="btn primary mt" type="submit">Upload</button>
        </form></div>
      <div class="panel"><h2>My files (${docs.length})</h2>
        ${docs.map((d) => docLink(d, "/portal/file/")).join("") || `<p class="muted">No documents uploaded yet.</p>`}
      </div>`));
  });

  app.post("/portal/documents", requireUser("student", "teacher"), (req, res, next) => {
    docUpload.array("files", 10)(req, res, (err) => {
      if (err) return res.redirect("/portal/documents?e=" + encodeURIComponent(err.message || "Upload failed"));
      next();
    });
  }, form, async (req, res) => {
    const files = req.files || [];
    try {
      const kind = String(req.body.kind || "other").slice(0, 40);
      const labels = { cnic: "CNIC / B-Form", photo: "Photograph", payment: "Payment proof", qualification: "Qualification", other: "Other" };
      for (const f of files) {
        await saveDocument({ scope: req.user.role, refId: req.user.id, userId: req.user.id, kind, label: labels[kind] || "Document", file: f, uploadedBy: req.user.role, subdir: "documents" });
      }
      res.redirect("/portal/documents?up=" + files.length);
    } catch (err) {
      console.error("document upload failed:", err.message);
      res.redirect("/portal/documents?e=" + encodeURIComponent("Upload failed"));
    }
  });

  app.get("/portal/file/:id", requireUser(), async (req, res) => {
    const doc = await getDocument(String(req.params.id));
    if (!doc) return res.status(404).send("Not found");
    if (doc.user_id !== req.user.id) return res.status(403).send("Forbidden");
    serveDoc(res, doc);
  });

  app.get("/portal/notices", requireUser(), async (req, res) => {
    const notices = await getNotices(req.user);
    res.send(shell(req.user, "notices", "Notices", "Announcements from the academy.",
      `<div class="panel">${notices.map(noteHtml).join("") || `<p class="muted">No notices yet.</p>`}</div>`));
  });

  // ============================= TEACHER: COURSES =============================
  app.get("/portal/courses", requireUser("teacher"), async (req, res) => {
    const mine = (await q("SELECT * FROM teacher_courses WHERE teacher_id = ? ORDER BY created_at DESC", [req.user.id]))[0];
    const blocks = [];
    for (const c of mine) {
      const [students] = await q(
        `SELECT u.full_name, u.email, u.phone, u.status
         FROM users u
         WHERE u.role = 'student' AND u.id IN (
           SELECT e.user_id FROM enrollments e
           WHERE e.course_title = ? AND e.user_id IS NOT NULL AND e.user_id <> ''
             AND e.status <> 'rejected'
         )
         ORDER BY u.full_name LIMIT 100`,
        [c.course_title]
      );
      blocks.push(`<div class="panel"><h2>${esc(c.course_title)}</h2>
        ${students.length ? `<table><tr><th>Student</th><th>Email</th><th>Phone</th><th>Status</th><th>Last login (PKT)</th></tr>
          ${students.map((s) => {
            let seen = "-";
            if (s.last_login) {
              const d = new Date(new Date(s.last_login).getTime() + 5 * 3600 * 1000);
              seen = isNaN(d) ? "-" : d.toISOString().slice(0, 16).replace("T", " ");
            }
            return `<tr><td>${esc(s.full_name)}</td><td>${esc(s.email)}</td><td>${esc(s.phone)}</td><td>${statusBadge(s.status)}</td><td class="muted">${seen}</td></tr>`;
          }).join("")}</table>`
        : `<p class="muted">No students enrolled in this course yet.</p>`}</div>`);
    }
    res.send(shell(req.user, "courses", "My Courses", "Courses assigned to you and their students.",
      blocks.join("") || `<div class="panel"><p class="empty">No courses assigned yet. The academy will assign courses after approval.</p></div>`));
  });

  // ---- serve a document safely (shared with admin) ----
  function serveDoc(res, doc, name) {
    const rel = String(doc.relpath || "");
    const full = path.resolve(UPLOAD_ROOT, rel);
    if (!full.startsWith(path.resolve(UPLOAD_ROOT)) || !fs.existsSync(full)) {
      return res.status(404).send("File missing");
    }
    res.download(full, name || doc.originalname || path.basename(full));
  }

  // expose shared internals for portal-admin.js
  core.ctx = ctx;
  core.esc = esc;
  core.q = q;
  core.logLogin = logLogin;
  core.uid = uid;
  core.shell = shell;
  core.requireUser = requireUser;
  core.getPool = getPool;
  core.publicPage = publicPage;
  core.errorPage = errorPage;
  core.statusBadge = statusBadge;
  core.docLink = docLink;
  core.noteHtml = noteHtml;
  core.serveDoc = serveDoc;
  core.hashPassword = hashPassword;
  core.getUserById = getUserById;
  core.getUserByEmail = getUserByEmail;
  core.getStudentProfile = getStudentProfile;
  core.getTeacherProfile = getTeacherProfile;
  core.getEnrollment = getEnrollment;
  core.getEnrollmentsForUser = getEnrollmentsForUser;
  core.getEnrollmentDocs = getEnrollmentDocs;
  core.getPayments = getPayments;
  core.paidTotal = paidTotal;
  core.setPaymentStatus = setPaymentStatus;
  core.getDocument = getDocument;
  core.getUserDocuments = getUserDocuments;
  core.saveDocument = saveDocument;
  core.createNotice = createNotice;
  core.makeUpload = makeUpload;
  core.UPLOAD_ROOT = () => UPLOAD_ROOT;
  console.log(" Portal mounted");
}

const core = {};

module.exports = { mount, initSchema, recordEnrollment, attachUser, core, hashPassword, verifyPassword, logLogin };
