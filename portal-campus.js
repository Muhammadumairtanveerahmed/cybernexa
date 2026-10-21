/**
 * CyberNexa Solutions — Portal: Campus
 * ---------------------------------------------------------------------------
 * A full university-style campus layer on top of the student/teacher portal:
 *   • Attendance      — teacher marks a class roster; students see % + detail.
 *   • Timetable       — weekly class schedule (teacher manages, everyone views).
 *   • Course materials— teacher shares lecture notes / slides / past papers.
 *   • Announcements   — teacher posts course notices the students read.
 *   • Quizzes         — MCQ online tests, auto-graded, feeding the result card.
 *   • Records         — printable result card / transcript + fee receipts.
 *
 * Mounted from server.js AFTER portal.mount() so it can reuse the shared
 * helpers exposed on `portal.core` (shell, requireUser, q, esc, …).
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const { core } = require("./portal");

const esc = (s) => core.esc(s);
const q = (sql, p) => core.q(sql, p);
const uid = (p) => core.uid(p);
const badge = (s) => core.statusBadge(s);

const form = express.urlencoded({ extended: false, limit: "500kb" });

const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// File types accepted for course materials.
const MAT_EXTS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".rar", ".7z",
  ".txt", ".csv", ".md", ".rtf", ".odt", ".ods", ".epub",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
  ".py", ".js", ".ts", ".java", ".c", ".cpp", ".cs", ".php", ".rb", ".go", ".sql",
  ".html", ".css", ".json", ".xml", ".ipynb", ".sh", ".ps1",
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
function letterGrade(p) {
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  if (p >= 40) return "E";
  return "F";
}
function gradePoint(p) {
  if (p >= 90) return 4.0;
  if (p >= 80) return 3.7;
  if (p >= 70) return 3.3;
  if (p >= 60) return 3.0;
  if (p >= 50) return 2.0;
  if (p >= 40) return 1.0;
  return 0.0;
}
function today() { return new Date().toISOString().slice(0, 10); }
function niceDate(d) { return d ? String(d).slice(0, 10) : "—"; }
function toArr(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function hhmm(t) { return String(t || "").slice(0, 5); }
function fmt12(t) {
  const s = hhmm(t); const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  let h = Number(m[1]); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return h + ":" + m[2] + " " + ap;
}
function todayLong() { return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

// ---------------------------------------------------------------------------
// Data accessors
// ---------------------------------------------------------------------------
async function teacherCourseTitles(teacherId) {
  const [r] = await q("SELECT DISTINCT course_title FROM teacher_courses WHERE teacher_id = ? ORDER BY course_title", [teacherId]);
  return r.map((x) => x.course_title);
}
async function studentCourseTitles(studentId) {
  const [r] = await q(
    `SELECT DISTINCT course_title FROM enrollments
     WHERE user_id = ? AND status <> 'rejected' AND course_title <> '' ORDER BY course_title`,
    [studentId]
  );
  return r.map((x) => x.course_title);
}
async function myCourseTitles(user) {
  return user.role === "teacher" ? teacherCourseTitles(user.id) : studentCourseTitles(user.id);
}
async function allCourseTitles() {
  const [r] = await q("SELECT title FROM courses WHERE active = 1 ORDER BY title");
  return r.map((x) => x.title);
}
async function studentsInCourse(courseTitle) {
  const [r] = await q(
    `SELECT DISTINCT u.id, u.full_name, u.email, u.phone
     FROM users u JOIN enrollments e ON e.user_id = u.id
     WHERE u.role = 'student' AND e.course_title = ? AND e.status <> 'rejected'
     ORDER BY u.full_name LIMIT 400`,
    [courseTitle]
  );
  return r;
}
async function studentEnrolled(studentId, courseTitle) {
  const [r] = await q(
    "SELECT 1 FROM enrollments WHERE user_id = ? AND course_title = ? AND status <> 'rejected' LIMIT 1",
    [studentId, courseTitle]
  );
  return r.length > 0;
}
async function notifyStudents(courseTitle, title, body) {
  try {
    const [st] = await q(
      `SELECT DISTINCT u.id FROM users u JOIN enrollments e ON e.user_id = u.id
       WHERE u.role = 'student' AND e.course_title = ? AND e.status <> 'rejected' LIMIT 400`,
      [courseTitle]
    );
    for (const s of st) await core.createNotice("user", s.id, title, body);
  } catch (e) { /* notices are best-effort */ }
}
function courseOptions(titles, selected, fallbackAll) {
  const list = titles.length ? titles : fallbackAll || [];
  const opts = list.map((t) => `<option value="${esc(t)}" ${t === selected ? "selected" : ""}>${esc(t)}</option>`).join("");
  return `<select name="course_title" required><option value="">— select a course —</option>${opts}</select>`;
}

// ---------------------------------------------------------------------------
// Printable document shell (result card / transcript / receipt)
// ---------------------------------------------------------------------------
function printPage(title, backHref, body) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
<style>
  :root{--ink:#0f172a;--mut:#64748b;--line:#e2e8f0;--p:#2563eb;--p2:#1d4ed8;}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#eef2f7;font-family:"Inter",system-ui,sans-serif;color:var(--ink);padding:26px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .toolbar{max-width:900px;margin:0 auto 14px;display:flex;justify-content:space-between;gap:10px}
  .toolbar div{display:flex;gap:10px}
  .toolbar a,.toolbar button{background:var(--p);color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;font-family:inherit}
  .toolbar a.ghost{background:#fff;color:#334155;border:1px solid #cbd5e1}
  .sheet{background:#fff;max-width:900px;margin:0 auto;padding:38px 44px 46px;border-radius:12px;box-shadow:0 10px 40px rgba(15,23,42,.12);position:relative}
  .sheet::after{content:"";position:absolute;inset:0;border:1px solid #e2e8f0;border-radius:12px;pointer-events:none}
  .lh{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--p);padding-bottom:14px;margin-bottom:4px;gap:16px}
  .lh .brand{font-family:"Sora",sans-serif;font-weight:800;font-size:1.5rem;line-height:1.1}
  .lh .brand b{color:var(--p)}
  .lh .brand small{display:block;font-weight:500;font-size:.7rem;color:var(--mut);letter-spacing:.03em;margin-top:3px}
  .lh .meta{text-align:right;font-size:.78rem;color:var(--mut);line-height:1.7}
  .lh .meta strong{color:var(--ink)}
  h1.doc{font-family:"Sora",sans-serif;font-size:1.1rem;text-align:center;letter-spacing:.06em;text-transform:uppercase;margin:18px 0 2px}
  .doc-sub{text-align:center;color:var(--mut);font-size:.82rem;margin-bottom:20px}
  .kv{display:grid;grid-template-columns:1fr 1fr;gap:0 30px;margin:18px 0 22px;font-size:.9rem}
  .kv .r{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed var(--line);padding:6px 0}
  .kv .r span:first-child{color:var(--mut)}
  .kv .r span:last-child{font-weight:600;text-align:right}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  th,td{padding:9px 11px;text-align:left;border-bottom:1px solid var(--line);font-size:.85rem}
  th{background:#f1f5f9;color:#334155;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
  tfoot td{font-weight:700;background:#f8fafc}
  .grade{display:inline-block;min-width:34px;text-align:center;padding:2px 8px;border-radius:6px;font-weight:700;font-size:.8rem;background:#eff6ff;color:var(--p2);border:1px solid #bfdbfe}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0 4px}
  .summary .b{border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:#f8fafc}
  .summary .b b{display:block;font-family:"Sora",sans-serif;font-size:1.3rem;color:var(--p2)}
  .summary .b span{font-size:.72rem;color:var(--mut)}
  .sig{display:flex;justify-content:space-between;margin-top:64px;font-size:.8rem;color:var(--mut);gap:20px}
  .sig div{border-top:1px solid #94a3b8;padding-top:6px;width:210px;text-align:center}
  .stamp{text-align:center;margin-top:30px;font-size:.7rem;letter-spacing:.18em;color:var(--p);font-weight:700}
  .note{margin-top:16px;font-size:.8rem;color:var(--mut);text-align:center}
  .paid{color:#16a34a;font-weight:700}
  @media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{box-shadow:none;border-radius:0;max-width:none;padding:24px 30px}.sheet::after{display:none}}
  @media(max-width:640px){.kv{grid-template-columns:1fr}.summary{grid-template-columns:repeat(2,1fr)}.sheet{padding:26px 22px}}
</style></head>
<body>
  <div class="toolbar"><a class="ghost" href="${esc(backHref)}">Back to portal</a><div><button onclick="window.print()">Print / Save as PDF</button></div></div>
  <div class="sheet">${body}</div>
</body></html>`;
}
function letterhead(docTitle, metaLines) {
  return `<div class="lh">
    <div class="brand">Cyber<b>Nexa</b> Solutions<small>Institute of Technology &amp; Cyber Security</small></div>
    <div class="meta">
      <div><strong>${esc(docTitle)}</strong></div>
      <div>Issued: ${esc(todayLong())}</div>
      ${(metaLines || []).map((l) => `<div>${esc(l)}</div>`).join("")}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
module.exports = function mountCampus(app) {
  const need = (...roles) => core.requireUser(...roles);
  const matUpload = core.makeUpload("materials", MAT_EXTS, 1);

  /* =======================================================================
   * ATTENDANCE
   * ===================================================================== */
  app.get("/portal/attendance", need("student", "teacher"), async (req, res) => {
    if (req.user.role === "teacher") return teacherAttendance(req, res);
    return studentAttendance(req, res);
  });

  async function teacherAttendance(req, res) {
    const u = req.user;
    const courses = await teacherCourseTitles(u.id);
    const all = await allCourseTitles();
    let course = String(req.query.course || "").trim();
    // Show today's roster straight away so teachers see their students without
    // having to pick a course first.
    if (!course && courses.length) course = courses[0];
    const date = (String(req.query.date || "").slice(0, 10)) || today();
    const ok = req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : "";
    const err = req.query.e ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.e)}</div>` : "";

    let marking = "";
    if (course) {
      const list = await studentsInCourse(course);
      const [[sess]] = await q("SELECT * FROM attendance_sessions WHERE course_title = ? AND session_date = ? LIMIT 1", [course, date]);
      const marks = {};
      if (sess) {
        const [rr] = await q("SELECT * FROM attendance WHERE session_id = ?", [sess.id]);
        for (const r of rr) marks[r.student_id] = r.status;
      }
      const statuses = ["present", "absent", "late", "excused"];
      const rows = list.map((s) => `<tr>
        <td><strong>${esc(s.full_name)}</strong><div class="muted" style="font-size:.78rem">${esc(s.email)}</div></td>
        <td>${statuses.map((st) => `<label style="display:inline-flex;align-items:center;gap:5px;margin:0 12px 0 0;font-size:.82rem;color:var(--txt)"><input type="radio" name="st_${esc(s.id)}" value="${st}" ${(marks[s.id] || "present") === st ? "checked" : ""} style="width:auto"> ${st}</label>`).join("")}</td>
      </tr>`).join("");
      marking = `<div class="panel">
        <div class="row" style="justify-content:space-between">
          <h2 style="margin:0"><i class="fa-solid fa-chalkboard-user"></i> ${esc(course)} — ${esc(date)}</h2>
          <span class="pill">${list.length} student(s)</span>
        </div>
        <form method="post" action="/portal/attendance/save">
          <input type="hidden" name="course_title" value="${esc(course)}">
          <input type="hidden" name="session_date" value="${esc(date)}">
          <label>Today's topic (optional)</label>
          <input name="topic" maxlength="200" value="${esc((sess && sess.topic) || "")}" placeholder="e.g. Subnetting practice">
          ${list.length ? `<table class="mt"><tr><th>Student</th><th>Status</th></tr>${rows}</table>
            <div class="row mt" style="gap:8px">
              <button type="button" class="btn ghost sm" onclick="document.querySelectorAll('input[type=radio][value=present]').forEach(function(r){r.checked=true})"><i class="fa-solid fa-circle-check"></i> All present</button>
              <button type="button" class="btn ghost sm" onclick="document.querySelectorAll('input[type=radio][value=absent]').forEach(function(r){r.checked=true})"><i class="fa-solid fa-circle-xmark"></i> All absent</button>
            </div>`
            : `<p class="muted mt">No students enrolled in this course yet.</p>`}
          <div class="row mt">
            <button class="btn primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Save attendance</button>
            <a class="btn ghost" href="/portal/attendance">Reset</a>
          </div>
        </form>
      </div>`;
    }

    const sessions = (await q(
      `SELECT s.*, (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id AND a.status IN ('present','late')) AS present,
              (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS total
       FROM attendance_sessions s WHERE s.teacher_id = ? ORDER BY s.session_date DESC, s.created_at DESC LIMIT 60`,
      [u.id]
    ))[0];
    const sRows = sessions.map((s) => `<tr>
      <td><strong>${esc(s.course_title)}</strong><div class="muted" style="font-size:.78rem">${esc(s.topic) || "—"}</div></td>
      <td class="muted">${esc(niceDate(s.session_date))}</td>
      <td>${Number(s.present)} / ${Number(s.total)} <span class="muted">present</span></td>
      <td class="row" style="gap:6px">
        <a class="btn ghost sm" href="/portal/attendance?course=${encodeURIComponent(s.course_title)}&date=${esc(niceDate(s.session_date))}">Edit</a>
        <a class="btn danger sm" href="/portal/attendance/delete?id=${esc(s.id)}" onclick="return confirm('Delete this attendance session?')">Delete</a>
      </td></tr>`).join("");

    res.send(core.shell(u, "attend", "Attendance", "Mark a class roster and review your past sessions.",
      `${ok}${err}
       ${courses.length ? "" : `<div class="note"><h4><i class="fa-solid fa-triangle-exclamation"></i> No course assigned yet</h4><p>Ask the admin to assign you a course before taking attendance.</p></div>`}
       <div class="panel">
         <h2><i class="fa-solid fa-pen-to-square"></i> Take attendance</h2>
         <form method="get" action="/portal/attendance">
           <div class="grid2">
             <div><label>Course *</label>${courseOptions(courses, course, all)}</div>
             <div><label>Session date *</label><input type="date" name="date" value="${esc(date)}" required></div>
           </div>
           <button class="btn primary mt" type="submit">Load roster</button>
         </form>
       </div>
       ${marking}
       <div class="panel">
         <h2><i class="fa-solid fa-calendar-days"></i> Recent sessions (${sessions.length})</h2>
         ${sessions.length ? `<table><tr><th>Course</th><th>Date</th><th>Present</th><th></th></tr>${sRows}</table>`
           : `<p class="muted">No attendance taken yet.</p>`}
       </div>`));
  }

  app.post("/portal/attendance/save", need("teacher"), form, async (req, res) => {
    const u = req.user;
    const course = String(req.body.course_title || "").trim();
    const date = String(req.body.session_date || "").slice(0, 10);
    const topic = String(req.body.topic || "").trim().slice(0, 200);
    const back = `/portal/attendance?course=${encodeURIComponent(course)}&date=${encodeURIComponent(date)}`;
    if (!course || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.redirect(back + "&e=" + encodeURIComponent("Choose a course and a valid date"));
    try {
      let sess = (await q("SELECT * FROM attendance_sessions WHERE course_title = ? AND session_date = ? LIMIT 1", [course, date]))[0][0];
      if (!sess) {
        const sid = uid("att_");
        await q("INSERT INTO attendance_sessions (id, course_title, teacher_id, session_date, topic, created_at) VALUES (?,?,?,?,?,NOW())", [sid, course, u.id, date, topic]);
        sess = { id: sid };
      } else {
        await q("UPDATE attendance_sessions SET topic = ?, teacher_id = ? WHERE id = ?", [topic, u.id, sess.id]);
      }
      const list = await studentsInCourse(course);
      for (const s of list) {
        const v = String(req.body["st_" + s.id] || "present");
        const status = ["present", "absent", "late", "excused"].includes(v) ? v : "present";
        await q(
          `INSERT INTO attendance (id, session_id, student_id, status, created_at) VALUES (?,?,?,?,NOW())
           ON DUPLICATE KEY UPDATE status = VALUES(status)`,
          [uid("atr_"), sess.id, s.id, status]
        );
      }
      res.redirect(back + "&ok=" + encodeURIComponent("Attendance saved for " + date));
    } catch (e) {
      res.redirect(back + "&e=" + encodeURIComponent(e.message || "Could not save attendance"));
    }
  });

  app.get("/portal/attendance/delete", need("teacher"), async (req, res) => {
    const [[s]] = await q("SELECT * FROM attendance_sessions WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (s && s.teacher_id === req.user.id) {
      await q("DELETE FROM attendance WHERE session_id = ?", [s.id]);
      await q("DELETE FROM attendance_sessions WHERE id = ?", [s.id]);
    }
    res.redirect("/portal/attendance?ok=" + encodeURIComponent("Session deleted"));
  });

  async function studentAttendance(req, res) {
    const u = req.user;
    const courses = await studentCourseTitles(u.id);
    let stats = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      const [rows] = await q(
        `SELECT s.course_title, a.status, COUNT(*) AS c
         FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id
         WHERE a.student_id = ? AND s.course_title IN (${ph})
         GROUP BY s.course_title, a.status`,
        [u.id, ...courses]
      );
      const map = {};
      for (const c of courses) map[c] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      for (const r of rows) {
        const m = map[r.course_title] || (map[r.course_title] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
        m[r.status] = Number(r.c);
      }
      for (const c of Object.keys(map)) {
        const m = map[c];
        m.counted = m.present + m.absent + m.late;
        m.attended = m.present + m.late;
        m.pct = pct(m.attended, m.counted);
      }
      stats = Object.keys(map).map((c) => ({ course: c, ...map[c] }));
    }
    const overallCounted = stats.reduce((n, s) => n + s.counted, 0);
    const overallAttended = stats.reduce((n, s) => n + s.attended, 0);
    const overallPct = pct(overallAttended, overallCounted);
    const cards = stats.map((s) => `<div class="panel">
      <div class="row" style="justify-content:space-between"><strong>${esc(s.course)}</strong>
        <span class="badge ${s.pct >= 75 ? "b-graded" : s.pct >= 60 ? "b-partial" : "b-rejected"}">${s.pct.toFixed(0)}%</span></div>
      <div class="progress"><i style="width:${s.pct.toFixed(1)}%"></i></div>
      <div class="row mt" style="gap:20px;font-size:.84rem">
        <span><b style="color:var(--green)">${s.present}</b> present</span>
        <span><b style="color:#fcd34d">${s.late}</b> late</span>
        <span><b style="color:#fca5a5">${s.absent}</b> absent</span>
        <span class="muted">${s.excused} excused</span>
        <span class="muted">of ${s.counted} classes</span>
      </div>
      ${s.counted === 0 ? `<p class="muted mt">No attendance recorded yet.</p>` : ""}
    </div>`).join("");
    const recent = (await q(
      `SELECT s.course_title, s.session_date, s.topic, a.status
       FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id
       WHERE a.student_id = ? ORDER BY s.session_date DESC LIMIT 40`,
      [u.id]
    ))[0];
    const rRows = recent.map((r) => `<tr>
      <td class="muted">${esc(niceDate(r.session_date))}</td>
      <td><strong>${esc(r.course_title)}</strong></td>
      <td class="muted">${esc(r.topic) || "—"}</td>
      <td>${badge(r.status === "excused" ? "pending" : r.status === "absent" ? "rejected" : r.status === "late" ? "partial" : "approved")}<span class="muted" style="margin-left:6px">${esc(r.status)}</span></td>
    </tr>`).join("");

    res.send(core.shell(u, "attend", "My Attendance", "Your class attendance across all enrolled courses.",
      `${stats.length ? `<div class="cards">
          <div class="stat"><b>${overallPct.toFixed(0)}%</b><span>Overall attendance</span></div>
          <div class="stat"><b>${stats.length}</b><span>Courses</span></div>
          <div class="stat"><b>${overallAttended}</b><span>Classes attended</span></div>
          <div class="stat"><b>${overallCounted}</b><span>Classes held</span></div>
        </div>` : ""}
       ${cards || `<div class="panel"><p class="empty">You are not enrolled in any course yet. <a href="/courses">Browse courses</a></p></div>`}
       ${recent.length ? `<div class="panel"><h2><i class="fa-solid fa-magnifying-glass"></i> Recent records</h2>
         <table><tr><th>Date</th><th>Course</th><th>Topic</th><th>Status</th></tr>${rRows}</table></div>` : ""}`));
  }

  /* =======================================================================
   * TIMETABLE
   * ===================================================================== */
  app.get("/portal/timetable", need("student", "teacher"), async (req, res) => {
    const u = req.user;
    const isTeacher = u.role === "teacher";
    const courses = await myCourseTitles(u);
    const all = await allCourseTitles();
    let slots = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      slots = (await q(
        `SELECT * FROM timetable WHERE course_title IN (${ph}) ORDER BY day_of_week, start_time`,
        [...courses]
      ))[0];
    }
    const byDay = {};
    for (const s of slots) (byDay[s.day_of_week] = byDay[s.day_of_week] || []).push(s);
    const dayCols = [1, 2, 3, 4, 5, 6].map((d) => {
      const list = byDay[d] || [];
      return `<div class="acard">
        <h3>${DAYS[d]}</h3>
        ${list.length ? list.map((s) => `<div class="slot">
            <span class="tm">${esc(hhmm(s.start_time))}<br><span class="muted">${esc(hhmm(s.end_time))}</span></span>
            <span style="flex:1"><strong>${esc(s.course_title)}</strong>
              ${s.room ? `<div class="muted" style="font-size:.75rem">Room ${esc(s.room)}</div>` : ""}</span>
            ${isTeacher ? `<a class="btn danger sm" href="/portal/timetable/delete?id=${esc(s.id)}" onclick="return confirm('Remove this slot?')"><i class="fa-solid fa-xmark"></i></a>` : ""}
          </div>`).join("") : `<p class="muted" style="font-size:.82rem">No classes</p>`}
      </div>`;
    }).join("");

    const addForm = isTeacher ? `<div class="modal" id="m-slot"><div class="modal-box">
      <div class="modal-head"><h3><i class="fa-solid fa-plus"></i> Add a class slot</h3><button type="button" class="modal-close" data-close>&times;</button></div>
      <form method="post" action="/portal/timetable/add">
        <label>Course *</label>${courseOptions(courses, "", all)}
        <div class="grid2">
          <div><label>Day *</label><select name="day_of_week" required>${await core.lkOptions("lk_weekday")}</select></div>
          <div><label>Room / Lab</label><input name="room" maxlength="60" placeholder="e.g. Lab-2"></div>
        </div>
        <div class="grid2">
          <div><label>Start time *</label><input type="time" name="start_time" required></div>
          <div><label>End time *</label><input type="time" name="end_time" required></div>
        </div>
        <button class="btn primary mt" type="submit">Save slot</button>
      </form>
    </div></div>` : "";

    res.send(core.shell(u, "timetable", "Class Timetable", "Your weekly class schedule.",
      `${req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : ""}
       ${req.query.e ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.e)}</div>` : ""}
       <div class="panel">
         <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
           <h2 style="margin:0"><i class="fa-solid fa-calendar-days"></i> Weekly schedule</h2>
           ${isTeacher ? `<button type="button" class="btn primary sm" data-open="#m-slot"><i class="fa-solid fa-plus"></i> Add slot</button>` : ""}
         </div>
         ${courses.length || slots.length ? `<div class="grid3 mt">${dayCols}</div>`
           : `<p class="muted">No courses yet, so there is no schedule to show.</p>`}
       </div>
       ${addForm}`));
  });

  app.post("/portal/timetable/add", need("teacher"), form, async (req, res) => {
    const course = String(req.body.course_title || "").trim();
    const day = Math.min(6, Math.max(1, num(req.body.day_of_week, 1)));
    const st = String(req.body.start_time || "").slice(0, 5);
    const en = String(req.body.end_time || "").slice(0, 5);
    const room = String(req.body.room || "").trim().slice(0, 60);
    const back = (m) => res.redirect("/portal/timetable?e=" + encodeURIComponent(m));
    if (!course) return back("Please choose a course");
    if (!/^\d{2}:\d{2}$/.test(st) || !/^\d{2}:\d{2}$/.test(en)) return back("Enter valid start and end times");
    if (en <= st) return back("End time must be after start time");
    await q("INSERT INTO timetable (id, course_title, teacher_id, day_of_week, start_time, end_time, room, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
      [uid("tt_"), course, req.user.id, day, st + ":00", en + ":00", room]);
    res.redirect("/portal/timetable?ok=" + encodeURIComponent("Class slot added"));
  });

  app.get("/portal/timetable/delete", need("teacher"), async (req, res) => {
    const [[t]] = await q("SELECT * FROM timetable WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (t && t.teacher_id === req.user.id) await q("DELETE FROM timetable WHERE id = ?", [t.id]);
    res.redirect("/portal/timetable?ok=" + encodeURIComponent("Slot removed"));
  });

  /* =======================================================================
   * COURSE MATERIALS
   * ===================================================================== */
  app.get("/portal/materials", need("student", "teacher"), async (req, res) => {
    const u = req.user;
    const isTeacher = u.role === "teacher";
    const courses = await myCourseTitles(u);
    const all = await allCourseTitles();
    let list = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      list = (await q(
        `SELECT m.*, t.full_name AS teacher FROM materials m LEFT JOIN users t ON t.id = m.teacher_id
         WHERE m.course_title IN (${ph}) ORDER BY m.created_at DESC LIMIT 400`,
        [...courses]
      ))[0];
    }
    const total = list.length;
    const byCourse = {};
    for (const m of list) (byCourse[m.course_title] = byCourse[m.course_title] || []).push(m);
    const blocks = Object.keys(byCourse).sort().map((c) => `<div class="panel">
      <h2><i class="fa-solid fa-book-open"></i> ${esc(c)} <span class="muted" style="font-size:.8rem">(${byCourse[c].length})</span></h2>
      ${byCourse[c].map((m) => `<div class="file">
        <span>${m.doc_id ? "<i class='fa-solid fa-paperclip'></i>" : "<i class='fa-solid fa-link'></i>"}</span>
        <span class="nm"><strong>${esc(m.title)}</strong>${m.description ? `<div class="muted" style="font-size:.76rem">${esc(m.description)}</div>` : ""}
          <div class="muted" style="font-size:.72rem">${esc(m.teacher || "")} · ${esc(niceDate(m.created_at))}</div></span>
        ${m.doc_id ? `<a class="btn ghost sm" href="/portal/material-file/${esc(m.doc_id)}" target="_blank">Download</a>`
          : `<a class="btn ghost sm" href="${esc(m.external_url)}" target="_blank" rel="noopener">Open link</a>`}
        ${isTeacher && m.teacher_id === u.id ? `<a class="btn danger sm" href="/portal/materials/delete?id=${esc(m.id)}" onclick="return confirm('Delete this material?')">Delete</a>` : ""}
      </div>`).join("")}
    </div>`).join("");

    const uploadForm = isTeacher ? `<div class="modal" id="m-material"><div class="modal-box">
      <div class="modal-head"><h3><i class="fa-solid fa-upload"></i> Share a resource</h3><button type="button" class="modal-close" data-close>&times;</button></div>
      <form method="post" action="/portal/materials/new" enctype="multipart/form-data">
        <label>Course *</label>${courseOptions(courses, "", all)}
        <label>Title *</label><input name="title" required maxlength="200" placeholder="e.g. Lecture 04 — Routing protocols">
        <label>Description</label><textarea name="description" placeholder="Short note about this resource (optional)"></textarea>
        <div class="grid2">
          <div><label>Upload a file (PDF, PPT, ZIP, image… max 10 MB)</label><input type="file" name="file"></div>
          <div><label>…or paste an external link</label><input name="external_url" type="url" placeholder="https://…"></div>
        </div>
        <button class="btn primary mt" type="submit"><i class="fa-solid fa-upload"></i> Publish resource</button>
      </form>
    </div></div>` : "";

    res.send(core.shell(u, "materials", "Course Materials", "Lecture notes, slides and resources shared by your teachers.",
      `${req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : ""}
       ${req.query.e ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.e)}</div>` : ""}
       ${total ? `<div class="cards"><div class="stat"><b>${total}</b><span>Resources</span></div><div class="stat"><b>${Object.keys(byCourse).length}</b><span>Courses</span></div></div>` : ""}
       <div style="display:flex;justify-content:flex-end;margin-bottom:12px">${isTeacher ? `<button type="button" class="btn primary sm" data-open="#m-material"><i class="fa-solid fa-plus"></i> Share resource</button>` : ""}</div>
       ${uploadForm}
       ${blocks || `<div class="panel"><p class="empty">No course materials shared yet.</p></div>`}`));
  });

  app.post("/portal/materials/new", need("teacher"), (req, res, next) => {
    matUpload.single("file")(req, res, (err) => {
      if (err) return res.redirect("/portal/materials?e=" + encodeURIComponent(err.message || "Upload failed"));
      next();
    });
  }, form, async (req, res) => {
    const back = (m) => res.redirect("/portal/materials?e=" + encodeURIComponent(m));
    const u = req.user;
    const course = String(req.body.course_title || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    let url = String(req.body.external_url || "").trim();
    if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
    if (!course) return back("Please choose a course");
    if (title.length < 2) return back("Please enter a title");
    if (!req.file && !url) return back("Attach a file or paste a link");
    try {
      let docId = "";
      if (req.file) {
        docId = await core.saveDocument({
          scope: "material", refId: "", userId: u.id, kind: "material",
          label: title, file: req.file, uploadedBy: u.role, subdir: "materials",
        });
      }
      await q("INSERT INTO materials (id, course_title, teacher_id, title, description, doc_id, external_url, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
        [uid("mat_"), course, u.id, title, description, docId, url]);
      await notifyStudents(course, "New course material: " + title, `${description || ""}\n\nCourse: ${course}`.trim());
      res.redirect("/portal/materials?ok=" + encodeURIComponent("Resource published"));
    } catch (e) {
      res.redirect("/portal/materials?e=" + encodeURIComponent(e.message || "Could not save resource"));
    }
  });

  app.get("/portal/materials/delete", need("teacher"), async (req, res) => {
    const [[m]] = await q("SELECT * FROM materials WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (m && m.teacher_id === req.user.id) {
      await q("DELETE FROM materials WHERE id = ?", [m.id]);
    }
    res.redirect("/portal/materials?ok=" + encodeURIComponent("Resource deleted"));
  });

  app.get("/portal/material-file/:id", need("student", "teacher"), async (req, res) => {
    const doc = await core.getDocument(String(req.params.id || ""));
    if (!doc) return res.status(404).send("Not found");
    const [[m]] = await q("SELECT * FROM materials WHERE doc_id = ? AND doc_id <> '' LIMIT 1", [doc.id]);
    if (!m) return res.status(404).send("Not found");
    const allowed = req.user.role === "teacher"
      ? m.teacher_id === req.user.id
      : await studentEnrolled(req.user.id, m.course_title);
    if (!allowed) return res.status(403).send("Forbidden");
    core.serveDoc(res, doc);
  });

  /* =======================================================================
   * ANNOUNCEMENTS
   * ===================================================================== */
  app.get("/portal/announcements", need("student", "teacher"), async (req, res) => {
    const u = req.user;
    const isTeacher = u.role === "teacher";
    const courses = await myCourseTitles(u);
    const all = await allCourseTitles();
    let list = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      list = (await q(
        `SELECT n.*, t.full_name AS teacher FROM announcements n LEFT JOIN users t ON t.id = n.teacher_id
         WHERE n.course_title IN (${ph}) ORDER BY n.pinned DESC, n.created_at DESC LIMIT 200`,
        [...courses]
      ))[0];
    }
    const cards = list.map((n) => `<div class="panel">
      <div class="row" style="justify-content:space-between">
        <div><span class="pill">${esc(n.course_title)}</span>${n.pinned ? ` <span class="badge b-approved">pinned</span>` : ""}</div>
        <span class="muted" style="font-size:.76rem">${esc(n.created_at)}</span>
      </div>
      <h2 style="margin-top:10px">${esc(n.title)}</h2>
      <p class="muted" style="white-space:pre-wrap">${esc(n.body || "")}</p>
      <div class="row" style="justify-content:space-between;margin-top:10px">
        <span class="muted" style="font-size:.76rem">Posted by ${esc(n.teacher || "Teacher")}</span>
        ${isTeacher && n.teacher_id === u.id ? `<a class="btn danger sm" href="/portal/announcements/delete?id=${esc(n.id)}" onclick="return confirm('Delete this announcement?')">Delete</a>` : ""}
      </div>
    </div>`).join("");

    const postForm = isTeacher ? `<div class="modal" id="m-announce"><div class="modal-box">
      <div class="modal-head"><h3><i class="fa-solid fa-bullhorn"></i> Post an announcement</h3><button type="button" class="modal-close" data-close>&times;</button></div>
      <form method="post" action="/portal/announcements/new">
        <label>Course *</label>${courseOptions(courses, "", all)}
        <label>Title *</label><input name="title" required maxlength="200" placeholder="e.g. Quiz on Friday — chapter 3">
        <label>Message</label><textarea name="body" placeholder="Write your announcement…"></textarea>
        <label style="display:flex;align-items:center;gap:8px;color:var(--txt)"><input type="checkbox" name="pinned" value="1" style="width:auto"> Pin to top</label>
        <button class="btn primary mt" type="submit"><i class="fa-solid fa-bullhorn"></i> Publish</button>
      </form>
    </div></div>` : "";

    res.send(core.shell(u, "announce", "Announcements", "Course notices and updates from your teachers.",
      `${req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : ""}
       ${req.query.e ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.e)}</div>` : ""}
       <div style="display:flex;justify-content:flex-end;margin-bottom:12px">${isTeacher ? `<button type="button" class="btn primary sm" data-open="#m-announce"><i class="fa-solid fa-plus"></i> Post announcement</button>` : ""}</div>
       ${postForm}
       ${cards || `<div class="panel"><p class="empty">No announcements yet.</p></div>`}`));
  });

  app.post("/portal/announcements/new", need("teacher"), form, async (req, res) => {
    const back = (m) => res.redirect("/portal/announcements?e=" + encodeURIComponent(m));
    const course = String(req.body.course_title || "").trim();
    const title = String(req.body.title || "").trim();
    const body = String(req.body.body || "").trim();
    const pinned = req.body.pinned ? 1 : 0;
    if (!course) return back("Please choose a course");
    if (title.length < 2) return back("Please enter a title");
    await q("INSERT INTO announcements (id, course_title, teacher_id, title, body, pinned, created_at) VALUES (?,?,?,?,?,?,NOW())",
      [uid("anc_"), course, req.user.id, title, body, pinned]);
    await notifyStudents(course, title, body);
    res.redirect("/portal/announcements?ok=" + encodeURIComponent("Announcement published"));
  });

  app.get("/portal/announcements/delete", need("teacher"), async (req, res) => {
    const [[n]] = await q("SELECT * FROM announcements WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (n && n.teacher_id === req.user.id) await q("DELETE FROM announcements WHERE id = ?", [n.id]);
    res.redirect("/portal/announcements?ok=" + encodeURIComponent("Announcement deleted"));
  });

  /* =======================================================================
   * QUIZZES (MCQ online tests)
   * ===================================================================== */
  async function quizStats(quizId) {
    const [[s]] = await q(
      `SELECT COUNT(*) AS attempts, COALESCE(AVG(score),0) AS avg, COALESCE(MAX(score),0) AS best
       FROM quiz_attempts WHERE quiz_id = ? AND status = 'submitted'`,
      [quizId]
    );
    const [[t]] = await q("SELECT COALESCE(SUM(marks),0) AS total, COUNT(*) AS qn FROM quiz_questions WHERE quiz_id = ?", [quizId]);
    return { attempts: Number(s.attempts || 0), avg: Number(s.avg || 0), best: Number(s.best || 0), total: Number(t.total || 0), questions: Number(t.qn || 0) };
  }

  app.get("/portal/quizzes", need("student", "teacher"), async (req, res) => {
    const u = req.user;
    if (u.role === "teacher") {
      const mine = (await q(
        `SELECT z.*, (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS qn,
                (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = z.id AND a.status='submitted') AS attempts
         FROM quizzes z WHERE z.teacher_id = ? ORDER BY z.created_at DESC LIMIT 200`,
        [u.id]
      ))[0];
      const rows = mine.map((z) => `<tr>
        <td><strong>${esc(z.title)}</strong><div class="muted" style="font-size:.78rem">${esc(z.course_title)}</div></td>
        <td>${Number(z.qn)}</td>
        <td>${Number(z.duration_minutes)} min</td>
        <td>${Number(z.attempts)}</td>
        <td>${badge(z.status)}</td>
        <td class="row" style="gap:6px">
          <a class="btn ghost sm" href="/portal/quizzes/view?id=${esc(z.id)}">Open</a>
          <a class="btn danger sm" href="/portal/quizzes/delete?id=${esc(z.id)}" onclick="return confirm('Delete this quiz and all attempts?')">Delete</a>
        </td></tr>`).join("");
      return res.send(core.shell(u, "quizzes", "Quizzes", "Build MCQ tests — students attempt them online and get instant marks.",
        `${req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : ""}
         <div class="panel">
           <div class="row" style="justify-content:space-between"><h2 style="margin:0"><i class="fa-solid fa-flask"></i> My quizzes (${mine.length})</h2>
             <a class="btn primary sm" href="/portal/quizzes/new"><i class="fa-solid fa-plus"></i> New quiz</a></div>
           ${mine.length ? `<table class="mt"><tr><th>Quiz</th><th>Questions</th><th>Duration</th><th>Attempts</th><th>Status</th><th></th></tr>${rows}</table>`
             : `<p class="muted mt">No quizzes yet. Click “New quiz” to build one.</p>`}
         </div>`));
    }
    // student
    const courses = await studentCourseTitles(u.id);
    let list = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      list = (await q(
        `SELECT z.*, t.full_name AS teacher,
                a.status AS at_status, a.score, a.total
         FROM quizzes z
         LEFT JOIN users t ON t.id = z.teacher_id
         LEFT JOIN quiz_attempts a ON a.quiz_id = z.id AND a.student_id = ?
         WHERE z.status <> 'draft' AND z.course_title IN (${ph})
         ORDER BY z.created_at DESC LIMIT 200`,
        [u.id, ...courses]
      ))[0];
    }
    const rows = list.map((z) => {
      const done = z.at_status === "submitted";
      const p = done && Number(z.total) > 0 ? pct(Number(z.score), Number(z.total)) : 0;
      return `<tr>
        <td><strong>${esc(z.title)}</strong><div class="muted" style="font-size:.78rem">${esc(z.course_title)}${z.teacher ? " · " + esc(z.teacher) : ""}</div></td>
        <td>${Number(z.duration_minutes)} min</td>
        <td>${badge(z.status)}</td>
        <td>${done ? `<strong>${Number(z.score)}</strong> / ${Number(z.total)} <span class="badge b-graded">${esc(letterGrade(p))}</span>`
          : z.at_status ? badge("submitted") : `<span class="badge b-pending">not attempted</span>`}</td>
        <td><a class="btn ${done ? "ghost" : "primary"} sm" href="/portal/quizzes/${done ? "result" : "take"}?id=${esc(z.id)}">${done ? "Result" : "Attempt"}</a></td>
      </tr>`;
    }).join("");
    const pending = list.filter((z) => z.at_status !== "submitted").length;
    const done = list.filter((z) => z.at_status === "submitted").length;
    res.send(core.shell(u, "quizzes", "Quizzes", "Attempt online MCQ tests and see your scores instantly.",
      `${list.length ? `<div class="cards">
        <div class="stat"><b>${list.length}</b><span>Available quizzes</span></div>
        <div class="stat"><b>${pending}</b><span>To attempt</span></div>
        <div class="stat"><b>${done}</b><span>Completed</span></div>
      </div>` : ""}
      <div class="panel"><h2><i class="fa-solid fa-flask"></i> Quizzes</h2>
        ${list.length ? `<table><tr><th>Quiz</th><th>Duration</th><th>Status</th><th>Score</th><th></th></tr>${rows}</table>`
          : `<p class="muted">No quizzes published for your courses yet.</p>`}
      </div>`));
  });

  app.get("/portal/quizzes/new", need("teacher"), async (req, res) => {
    const courses = await teacherCourseTitles(req.user.id);
    const all = await allCourseTitles();
    const letterOpts = (await core.lkOptions("lk_quiz_option")).replace(/value="([A-D])"/g, (m, v) => `value="${v.toLowerCase()}"`);
    res.send(core.shell(req.user, "quizzes", "New quiz", "Add MCQ questions — each question can carry its own marks.",
      `${req.query.e ? `<div class="err"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.e)}</div>` : ""}
       <div class="panel">
         <form method="post" action="/portal/quizzes/new" id="qf">
           <label>Course *</label>${courseOptions(courses, "", all)}
           <div class="grid2">
             <div><label>Quiz title *</label><input name="title" required maxlength="200" placeholder="e.g. Quiz 1 — Networking basics"></div>
             <div><label>Duration (minutes) *</label><input type="number" name="duration_minutes" min="1" max="240" value="15" required></div>
           </div>
           <div class="grid2">
             <div><label>Passing percentage</label><input type="number" name="pass_percent" min="0" max="100" value="50"></div>
             <div><label>Instructions (optional)</label><input name="description" maxlength="400" placeholder="e.g. Attempt all questions"></div>
           </div>
           <div class="row mt" style="justify-content:space-between">
             <h2 style="margin:0">Questions</h2>
             <button type="button" class="btn ghost sm" onclick="addQ()"><i class="fa-solid fa-plus"></i> Add question</button>
           </div>
           <div id="qs"></div>
           <div class="row mt">
             <button class="btn primary" type="submit"><i class="fa-solid fa-floppy-disk"></i> Create quiz</button>
             <a class="btn ghost" href="/portal/quizzes">Cancel</a>
           </div>
         </form>
       </div>
       <p class="muted">Tip: keep 4 options per question. The correct option is auto-marked when the student submits.</p>
       <script>
         function addQ(){
           var w=document.getElementById('qs');
           var d=document.createElement('div');
           d.className='panel'; d.style.background='#0b1020'; d.style.padding='16px';
           d.innerHTML='<div class="row" style="justify-content:space-between"><strong>Question</strong><button type="button" class="btn danger sm" onclick="this.closest(\\'.panel\\').remove()">Remove</button></div>'
             +'<label>Question text *</label><input name="q" required maxlength="500">'
             +'<div class="grid2"><div><label>Option A *</label><input name="oa" required maxlength="400"></div><div><label>Option B *</label><input name="ob" required maxlength="400"></div>'
             +'<div><label>Option C</label><input name="oc" maxlength="400"></div><div><label>Option D</label><input name="od" maxlength="400"></div></div>'
             +'<div class="grid2"><div><label>Correct option</label><select name="ca">${letterOpts}</select></div>'
             +'<div><label>Marks</label><input type="number" name="mk" value="1" min="0" max="100"></div></div>';
           w.appendChild(d);
         }
         document.addEventListener('DOMContentLoaded',function(){ for(var i=0;i<3;i++) addQ(); });
       </script>`));
  });

  app.post("/portal/quizzes/new", need("teacher"), form, async (req, res) => {
    const back = (m) => res.redirect("/portal/quizzes/new?e=" + encodeURIComponent(m));
    const course = String(req.body.course_title || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const duration = Math.min(240, Math.max(1, num(req.body.duration_minutes, 15)));
    const passPct = Math.min(100, Math.max(0, num(req.body.pass_percent, 50)));
    if (!course) return back("Please choose a course");
    if (title.length < 2) return back("Please enter a quiz title");
    const Q = toArr(req.body.q), OA = toArr(req.body.oa), OB = toArr(req.body.ob), OC = toArr(req.body.oc), OD = toArr(req.body.od), CA = toArr(req.body.ca), MK = toArr(req.body.mk);
    const built = [];
    for (let i = 0; i < Q.length; i++) {
      const text = String(Q[i] || "").trim();
      const a = String(OA[i] || "").trim(), b = String(OB[i] || "").trim(), c = String(OC[i] || "").trim(), d = String(OD[i] || "").trim();
      if (!text && !a && !b) continue; // blank row skipped
      if (!text || !a || !b) return back("Every question needs text and at least options A and B");
      const correct = ["a", "b", "c", "d"].includes(String(CA[i] || "a").toLowerCase()) ? String(CA[i] || "a").toLowerCase() : "a";
      built.push({ text, a, b, c, d, correct, marks: Math.max(0, num(MK[i], 1)) });
    }
    if (!built.length) return back("Add at least one question");
    try {
      const id = uid("qz_");
      await q(`INSERT INTO quizzes (id, course_title, teacher_id, title, description, duration_minutes, pass_percent, status, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?, 'published', NOW(), NOW())`,
        [id, course, req.user.id, title, description, duration, passPct]);
      let n = 1;
      for (const b of built) {
        await q(`INSERT INTO quiz_questions (id, quiz_id, q_no, question, option_a, option_b, option_c, option_d, correct, marks)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [uid("qq_"), id, n++, b.text, b.a, b.b, b.c, b.d, b.correct, b.marks]);
      }
      await notifyStudents(course, "New quiz: " + title, `${built.length} question(s) · ${duration} minutes.\nOpen the Quizzes section to attempt it.`);
      res.redirect("/portal/quizzes/view?id=" + id + "&ok=" + encodeURIComponent("Quiz published"));
    } catch (e) {
      res.redirect("/portal/quizzes/new?e=" + encodeURIComponent(e.message || "Could not create quiz"));
    }
  });

  app.get("/portal/quizzes/view", need("teacher"), async (req, res) => {
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (!z || z.teacher_id !== req.user.id) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("Quiz not found"));
    const [questions] = await q("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no", [z.id]);
    const [attempts] = await q(
      `SELECT a.*, u.full_name AS student, u.email FROM quiz_attempts a
       LEFT JOIN users u ON u.id = a.student_id WHERE a.quiz_id = ? ORDER BY a.submitted_at DESC`,
      [z.id]
    );
    const st = await quizStats(z.id);
    const qRows = questions.map((qq) => `<tr>
      <td>${Number(qq.q_no)}</td>
      <td>${esc(qq.question)}<div class="muted" style="font-size:.76rem;margin-top:4px">
        A. ${esc(qq.option_a)} · B. ${esc(qq.option_b)}${qq.option_c ? " · C. " + esc(qq.option_c) : ""}${qq.option_d ? " · D. " + esc(qq.option_d) : ""}</div></td>
      <td><span class="badge b-graded">${esc(String(qq.correct).toUpperCase())}</span></td>
      <td>${Number(qq.marks)}</td>
    </tr>`).join("");
    const aRows = attempts.map((a) => {
      const p = Number(a.total) > 0 ? pct(Number(a.score), Number(a.total)) : 0;
      return `<tr>
        <td><strong>${esc(a.student)}</strong><div class="muted" style="font-size:.78rem">${esc(a.email)}</div></td>
        <td>${a.status === "submitted" ? `${esc(niceDate(a.submitted_at))}` : `<span class="badge b-pending">in progress</span>`}</td>
        <td>${a.status === "submitted" ? `<strong>${Number(a.score)}</strong> / ${Number(a.total)}` : "—"}</td>
        <td>${a.status === "submitted" ? `<span class="badge ${p >= z.pass_percent ? "b-graded" : "b-rejected"}">${p.toFixed(0)}%</span>` : "—"}</td>
      </tr>`;
    }).join("");
    res.send(core.shell(req.user, "quizzes", z.title, `${esc(z.course_title)} · ${st.questions} questions · ${Number(z.duration_minutes)} minutes`,
      `${req.query.ok ? `<div class="ok"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : ""}
       <div class="cards">
         <div class="stat"><b>${st.questions}</b><span>Questions</span></div>
         <div class="stat"><b>${st.total}</b><span>Total marks</span></div>
         <div class="stat"><b>${st.attempts}</b><span>Attempts</span></div>
         <div class="stat"><b>${st.total ? st.avg.toFixed(1) : "0"}</b><span>Average score</span></div>
       </div>
       <div class="panel">
         <div class="row" style="justify-content:space-between">
           <span>Status: ${badge(z.status)}</span>
           <div class="row" style="gap:8px">
             <a class="btn ghost sm" href="/portal/quizzes/status?id=${esc(z.id)}&to=${z.status === "published" ? "closed" : "published"}">${z.status === "published" ? "Close quiz" : "Publish quiz"}</a>
             <a class="btn danger sm" href="/portal/quizzes/delete?id=${esc(z.id)}" onclick="return confirm('Delete this quiz?')">Delete</a>
           </div>
         </div>
       </div>
       <div class="panel"><h2><i class="fa-solid fa-circle-question"></i> Questions</h2>
         <table><tr><th>#</th><th>Question</th><th>Correct</th><th>Marks</th></tr>${qRows || `<tr><td colspan="4" class="empty">No questions.</td></tr>`}</table>
       </div>
       <div class="panel"><h2><i class="fa-solid fa-users"></i> Attempts (${attempts.length})</h2>
         <table><tr><th>Student</th><th>Submitted</th><th>Score</th><th>%</th></tr>${aRows || `<tr><td colspan="4" class="empty">No attempts yet.</td></tr>`}</table>
       </div>`));
  });

  app.get("/portal/quizzes/status", need("teacher"), async (req, res) => {
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (z && z.teacher_id === req.user.id) {
      const to = ["published", "closed", "draft"].includes(String(req.query.to)) ? String(req.query.to) : "published";
      await q("UPDATE quizzes SET status = ?, updated_at = NOW() WHERE id = ?", [to, z.id]);
    }
    res.redirect("/portal/quizzes/view?id=" + String(req.query.id || "") + "&ok=" + encodeURIComponent("Quiz updated"));
  });

  app.get("/portal/quizzes/delete", need("teacher"), async (req, res) => {
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (z && z.teacher_id === req.user.id) {
      await q("DELETE FROM quiz_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE quiz_id = ?)", [z.id]);
      await q("DELETE FROM quiz_attempts WHERE quiz_id = ?", [z.id]);
      await q("DELETE FROM quiz_questions WHERE quiz_id = ?", [z.id]);
      await q("DELETE FROM quizzes WHERE id = ?", [z.id]);
    }
    res.redirect("/portal/quizzes?ok=" + encodeURIComponent("Quiz deleted"));
  });

  app.get("/portal/quizzes/take", need("student"), async (req, res) => {
    const u = req.user;
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (!z || z.status !== "published") return res.redirect("/portal/quizzes?e=" + encodeURIComponent("Quiz not available"));
    if (!(await studentEnrolled(u.id, z.course_title))) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("You are not enrolled in this course"));
    let attempt = (await q("SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? LIMIT 1", [z.id, u.id]))[0][0];
    if (attempt && attempt.status === "submitted") return res.redirect("/portal/quizzes/result?id=" + z.id);
    if (!attempt) {
      const aid = uid("qa_");
      await q("INSERT INTO quiz_attempts (id, quiz_id, student_id, started_at, status) VALUES (?,?,?,NOW(),'in_progress')", [aid, z.id, u.id]);
      attempt = { id: aid, status: "in_progress" };
    }
    const [questions] = await q("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no", [z.id]);
    if (!questions.length) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("This quiz has no questions yet"));
    const qs = questions.map((x) => {
      const opts = [["a", x.option_a], ["b", x.option_b], ["c", x.option_c], ["d", x.option_d]]
        .filter(([, v]) => String(v || "").trim())
        .map(([k, v]) => `<label style="display:flex;gap:9px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:9px;margin:6px 0;background:#0b1020;color:var(--txt);cursor:pointer">
            <input type="radio" name="ans_${esc(x.id)}" value="${k}" style="width:auto"> <span><b>${k.toUpperCase()}.</b> ${esc(v)}</span></label>`).join("");
      return `<div class="acard" style="margin-bottom:12px">
        <div class="row" style="justify-content:space-between"><strong>Q${Number(x.q_no)}. ${esc(x.question)}</strong><span class="pill">${Number(x.marks)} mark(s)</span></div>
        ${opts}
      </div>`;
    }).join("");
    const seconds = Math.max(30, Number(z.duration_minutes || 15) * 60);
    res.send(core.shell(u, "quizzes", z.title, `${esc(z.course_title)} · ${questions.length} questions · ${Number(z.duration_minutes)} minutes`,
      `<div class="panel" style="display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5">
         <div><strong>Time remaining</strong> <span id="tmr" style="color:var(--acc);font-family:'Sora',sans-serif">--:--</span></div>
         <div class="muted" style="font-size:.8rem">Do not close this page. The quiz auto-submits when time is up.</div>
       </div>
       <form method="post" action="/portal/quizzes/submit" id="qzform">
         <input type="hidden" name="quiz_id" value="${esc(z.id)}">
         ${qs}
         <button class="btn primary mt" type="submit" onclick="return confirm('Submit your answers?')"><i class="fa-solid fa-circle-check"></i> Submit quiz</button>
       </form>
       <script>
         (function(){var s=${seconds};var el=document.getElementById('tmr');var f=document.getElementById('qzform');if(!el)return;
          function show(){var m=Math.floor(s/60),x=s%60;el.textContent=m+':'+(x<10?'0':'')+x;}
          show();var t=setInterval(function(){s--;if(s<=0){clearInterval(t);el.textContent='0:00';f.submit();return;}show();},1000);})();
       </script>`));
  });

  app.post("/portal/quizzes/submit", need("student"), form, async (req, res) => {
    const u = req.user;
    const quizId = String(req.body.quiz_id || "");
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [quizId]);
    if (!z) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("Quiz not found"));
    const attempt = (await q("SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? LIMIT 1", [quizId, u.id]))[0][0];
    if (!attempt) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("No active attempt"));
    if (attempt.status === "submitted") return res.redirect("/portal/quizzes/result?id=" + quizId);
    const [questions] = await q("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no", [quizId]);
    await q("DELETE FROM quiz_answers WHERE attempt_id = ?", [attempt.id]);
    let score = 0, total = 0;
    for (const x of questions) {
      const choice = String(req.body["ans_" + x.id] || "").toLowerCase();
      const correct = choice && choice === String(x.correct).toLowerCase();
      const mk = Number(x.marks || 0);
      total += mk;
      if (correct) score += mk;
      await q("INSERT INTO quiz_answers (id, attempt_id, question_id, choice, correct, marks) VALUES (?,?,?,?,?,?)",
        [uid("qan_"), attempt.id, x.id, choice, correct ? 1 : 0, correct ? mk : 0]);
    }
    await q("UPDATE quiz_attempts SET status='submitted', submitted_at=NOW(), score=?, total=? WHERE id=?", [score, total, attempt.id]);
    res.redirect("/portal/quizzes/result?id=" + quizId);
  });

  app.get("/portal/quizzes/result", need("student"), async (req, res) => {
    const u = req.user;
    const [[z]] = await q("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    if (!z) return res.redirect("/portal/quizzes?e=" + encodeURIComponent("Quiz not found"));
    const attempt = (await q("SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? LIMIT 1", [z.id, u.id]))[0][0];
    if (!attempt || attempt.status !== "submitted") return res.redirect("/portal/quizzes/take?id=" + z.id);
    const [questions] = await q("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no", [z.id]);
    const [answers] = await q("SELECT * FROM quiz_answers WHERE attempt_id = ?", [attempt.id]);
    const amap = {}; for (const a of answers) amap[a.question_id] = a;
    const p = Number(attempt.total) > 0 ? pct(Number(attempt.score), Number(attempt.total)) : 0;
    const passed = p >= Number(z.pass_percent || 50);
    const rows = questions.map((x) => {
      const a = amap[x.id] || {};
      const ok = a.correct ? true : false;
      const optText = (k) => ({ a: x.option_a, b: x.option_b, c: x.option_c, d: x.option_d }[k] || "");
      return `<tr>
        <td>${Number(x.q_no)}</td>
        <td>${esc(x.question)}</td>
        <td>${a.choice ? esc(a.choice.toUpperCase()) + ". " + esc(optText(a.choice)) : `<span class="muted">not answered</span>`}</td>
        <td>${esc(String(x.correct).toUpperCase())}. ${esc(optText(String(x.correct).toLowerCase()))}</td>
        <td>${ok ? `<span class="badge b-graded">+${Number(x.marks)}</span>` : `<span class="badge b-rejected">0</span>`}</td>
      </tr>`;
    }).join("");
    res.send(core.shell(u, "quizzes", "Quiz Result", `${esc(z.title)} · ${esc(z.course_title)}`,
      `<div class="cards">
         <div class="stat"><b>${Number(attempt.score)} / ${Number(attempt.total)}</b><span>Your score</span></div>
         <div class="stat"><b>${p.toFixed(0)}%</b><span>Percentage</span></div>
         <div class="stat"><b>${letterGrade(p)}</b><span>Grade</span></div>
         <div class="stat"><b>${passed ? "PASS" : "FAIL"}</b><span>Result (pass ${Number(z.pass_percent)}%)</span></div>
       </div>
       <div class="panel"><h2><i class="fa-solid fa-clipboard-list"></i> Answer review</h2>
         <table><tr><th>#</th><th>Question</th><th>Your answer</th><th>Correct</th><th>Marks</th></tr>${rows}</table>
       </div>
       <p><a class="btn ghost" href="/portal/quizzes">Back to quizzes</a></p>`));
  });

  /* =======================================================================
   * RECORDS: printable result card / transcript + fee receipts
   * ===================================================================== */
  app.get("/portal/transcript", need("student"), async (req, res) => {
    const u = req.user;
    const prof = (await core.getStudentProfile(u.id)) || {};
    const courses = await studentCourseTitles(u.id);
    let rows = "";
    let totGot = 0, totMax = 0, gpSum = 0, gpCount = 0;
    for (const c of courses) {
      const [[asg]] = await q(
        `SELECT COALESCE(SUM(s.marks),0) AS got, COALESCE(SUM(a.max_marks),0) AS mx, COUNT(*) AS n
         FROM submissions s JOIN assignments a ON a.id = s.assignment_id
         WHERE s.student_id = ? AND a.course_title = ? AND s.status='graded'`,
        [u.id, c]
      );
      const [[qz]] = await q(
        `SELECT COALESCE(SUM(a.score),0) AS got, COALESCE(SUM(a.total),0) AS mx, COUNT(*) AS n
         FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id
         WHERE a.student_id = ? AND z.course_title = ? AND a.status='submitted'`,
        [u.id, c]
      );
      const [[at]] = await q(
        `SELECT COUNT(*) AS total, COALESCE(SUM(a.status IN ('present','late')),0) AS attended
         FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id
         WHERE a.student_id = ? AND s.course_title = ? AND a.status <> 'excused'`,
        [u.id, c]
      );
      const got = Number(asg.got || 0) + Number(qz.got || 0);
      const mx = Number(asg.mx || 0) + Number(qz.mx || 0);
      const cp = pct(got, mx);
      if (mx > 0) { totGot += got; totMax += mx; gpSum += gradePoint(cp); gpCount++; }
      const atPct = Number(at.total) > 0 ? pct(Number(at.attended), Number(at.total)) : null;
      rows += `<tr>
        <td><strong>${esc(c)}</strong></td>
        <td>${Number(asg.n || 0)}</td>
        <td>${Number(qz.n || 0)}</td>
        <td>${atPct === null ? "—" : atPct.toFixed(0) + "%"}</td>
        <td>${mx > 0 ? `${got} / ${mx}` : "—"}</td>
        <td>${mx > 0 ? `<span class="grade">${letterGrade(cp)}</span>` : "—"}</td>
        <td>${mx > 0 ? cp.toFixed(1) + "%" : "—"}</td>
      </tr>`;
    }
    const overall = pct(totGot, totMax);
    const cgpa = gpCount ? gpSum / gpCount : 0;
    const remarks = totMax === 0 ? "No graded assessment yet." : overall >= 80 ? "Excellent performance." : overall >= 60 ? "Good — keep it up." : overall >= 50 ? "Satisfactory." : "Needs improvement.";
    const body = `
      ${letterhead("Academic Result Card / Transcript", ["Serial: " + esc(u.id.slice(0, 12).toUpperCase())])}
      <h1 class="doc">Result Card &amp; Transcript</h1>
      <p class="doc-sub">Statement of academic performance across all enrolled courses</p>
      <div class="kv">
        <div class="r"><span>Student name</span><span>${esc(u.full_name)}</span></div>
        <div class="r"><span>Student ID</span><span>${esc(String(u.id).toUpperCase())}</span></div>
        <div class="r"><span>Email</span><span>${esc(u.email)}</span></div>
        <div class="r"><span>Phone</span><span>${esc(u.phone || "—")}</span></div>
        <div class="r"><span>CNIC / B-Form</span><span>${esc(prof.cnic || "—")}</span></div>
        <div class="r"><span>City</span><span>${esc(prof.city || "—")}</span></div>
      </div>
      <table>
        <thead><tr><th>Course</th><th>Assignments</th><th>Quizzes</th><th>Attendance</th><th>Marks</th><th>Grade</th><th>Percent</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#64748b;padding:24px">No courses enrolled.</td></tr>`}</tbody>
        <tfoot><tr><td colspan="4">Overall</td><td>${totGot} / ${totMax}</td><td><span class="grade">${letterGrade(overall)}</span></td><td>${overall.toFixed(1)}%</td></tr></tfoot>
      </table>
      <div class="summary">
        <div class="b"><b>${courses.length}</b><span>Courses</span></div>
        <div class="b"><b>${overall.toFixed(1)}%</b><span>Overall</span></div>
        <div class="b"><b>${cgpa.toFixed(2)}</b><span>CGPA (4.0)</span></div>
        <div class="b"><b>${letterGrade(overall)}</b><span>Overall grade</span></div>
      </div>
      <p class="note">Remarks: ${esc(remarks)}</p>
      <div class="sig"><div>Class Coordinator</div><div>Controller of Examinations</div><div>Principal</div></div>
      <div class="stamp">CYBERNEXA SOLUTIONS · COMPUTER-GENERATED DOCUMENT</div>`;
    res.send(printPage("Result Card — CyberNexa", "/portal/marks", body));
  });

  app.get("/portal/fees/receipt/:id", need("student"), async (req, res) => {
    const [[p]] = await q("SELECT * FROM payments WHERE id = ? LIMIT 1", [String(req.params.id || "")]);
    if (!p) return res.status(404).send("Not found");
    const en = await core.getEnrollment(p.enrollment_id);
    if (!en || en.user_id !== req.user.id) return res.status(403).send("Forbidden");
    const u = req.user;
    const paid = await core.paidTotal(en.id);
    const total = Number(en.amount_total || 0);
    const balance = Math.max(0, total - paid);
    const body = `
      ${letterhead("Fee Receipt", ["Receipt No: " + esc(p.id.toUpperCase())])}
      <h1 class="doc">Fee Payment Receipt</h1>
      <p class="doc-sub">${esc(en.course_title)}</p>
      <div class="kv">
        <div class="r"><span>Student name</span><span>${esc(u.full_name)}</span></div>
        <div class="r"><span>Student ID</span><span>${esc(String(u.id).toUpperCase())}</span></div>
        <div class="r"><span>Course</span><span>${esc(en.course_title)}</span></div>
        <div class="r"><span>Enrollment type</span><span>${esc(en.enrollment_type || "Online")}</span></div>
        <div class="r"><span>Payment date</span><span>${esc(niceDate(p.paid_at))}</span></div>
        <div class="r"><span>Method</span><span>${esc(p.method || "—")}</span></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th></tr></thead>
        <tbody><tr><td>Fee received${p.note ? " — " + esc(p.note) : ""}</td><td>PKR ${Number(p.amount).toLocaleString("en-PK")}</td></tr></tbody>
        <tfoot>
          <tr><td>Course fee total</td><td>PKR ${total.toLocaleString("en-PK")}</td></tr>
          <tr><td>Total paid to date</td><td class="paid">PKR ${paid.toLocaleString("en-PK")}</td></tr>
          <tr><td>Balance remaining</td><td>PKR ${balance.toLocaleString("en-PK")}</td></tr>
        </tfoot>
      </table>
      <p class="note">This is a computer-generated receipt for the payment recorded above. Please retain it for your records.</p>
      <div class="sig"><div>Received by</div><div>Accounts Officer</div></div>
      <div class="stamp">CYBERNEXA SOLUTIONS · FEE OFFICE</div>`;
    res.send(printPage("Fee Receipt — CyberNexa", "/portal/fees", body));
  });

  app.get("/portal/fees/statement/:id", need("student"), async (req, res) => {
    const en = await core.getEnrollment(String(req.params.id || ""));
    if (!en || en.user_id !== req.user.id) return res.status(403).send("Forbidden");
    const u = req.user;
    const payments = await core.getPayments(en.id);
    const paid = await core.paidTotal(en.id);
    const total = Number(en.amount_total || 0);
    const rows = payments.map((p) => `<tr>
      <td>${esc(niceDate(p.paid_at))}</td><td>${esc(p.id.toUpperCase())}</td><td>${esc(p.method || "—")}</td>
      <td>${esc(p.note || "—")}</td><td>PKR ${Number(p.amount).toLocaleString("en-PK")}</td>
    </tr>`).join("");
    const body = `
      ${letterhead("Fee Statement", ["Course: " + esc(en.course_title)])}
      <h1 class="doc">Fee Statement / Ledger</h1>
      <p class="doc-sub">${esc(u.full_name)} · ${esc(u.email)}</p>
      <div class="kv">
        <div class="r"><span>Course</span><span>${esc(en.course_title)}</span></div>
        <div class="r"><span>Enrollment type</span><span>${esc(en.enrollment_type || "Online")}</span></div>
        <div class="r"><span>Enrollment date</span><span>${esc(niceDate(en.created_at))}</span></div>
        <div class="r"><span>Payment status</span><span>${esc(en.payment_status)}</span></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Receipt</th><th>Method</th><th>Note</th><th>Amount</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:22px">No payments recorded.</td></tr>`}</tbody>
        <tfoot>
          <tr><td colspan="4">Course fee total</td><td>PKR ${total.toLocaleString("en-PK")}</td></tr>
          <tr><td colspan="4">Total paid</td><td class="paid">PKR ${paid.toLocaleString("en-PK")}</td></tr>
          <tr><td colspan="4">Balance</td><td>PKR ${Math.max(0, total - paid).toLocaleString("en-PK")}</td></tr>
        </tfoot>
      </table>
      <div class="sig"><div>Accounts Officer</div><div>Authorised Signature</div></div>
      <div class="stamp">CYBERNEXA SOLUTIONS · FEE OFFICE</div>`;
    res.send(printPage("Fee Statement — CyberNexa", "/portal/fees", body));
  });

  console.log(" Portal campus mounted");
};
