/**
 * CyberNexa Solutions — Portal: Academics (Assignments, Submissions, Marks)
 * ------------------------------------------------------------------------
 * A university-style coursework module on top of the student/teacher portal:
 *   • Teacher  → create assignments (with a brief/attachment) per course,
 *                see every enrolled student, download submissions and award
 *                marks + feedback.
 *   • Student  → see assignments for enrolled courses, download the brief,
 *                upload their work and view marks / result card.
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

const form = express.urlencoded({ extended: false, limit: "300kb" });

// File types accepted for coursework (assignment briefs + student work).
const HW_EXTS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".rar", ".7z",
  ".txt", ".csv", ".md", ".rtf", ".odt", ".ods",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg",
  ".py", ".js", ".ts", ".java", ".c", ".cpp", ".cs", ".php", ".rb", ".go", ".sql",
  ".html", ".css", ".json", ".xml", ".ipynb", ".sh", ".ps1",
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function gradeLetter(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}
function gpaPoint(pct) {
  if (pct >= 90) return 4.0;
  if (pct >= 80) return 3.7;
  if (pct >= 70) return 3.3;
  if (pct >= 60) return 3.0;
  if (pct >= 50) return 2.0;
  if (pct >= 40) return 1.0;
  return 0.0;
}
// datetime-local ("2026-10-20T15:30") → MySQL DATETIME string or null
function parseDue(v) {
  const s = String(v || "").trim().replace("T", " ");
  if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(s)) return null;
  if (s.length === 10) return s + " 23:59:00";
  if (s.length === 16) return s + ":00";
  return s;
}
function isPast(dueStr) {
  if (!dueStr) return false;
  return new Date(String(dueStr).replace(" ", "T")) < new Date();
}
function shortDate(d) {
  return d ? String(d).slice(0, 16) : "—";
}
function marksCell(a) {
  if (a.sub_status === "graded") return `<strong>${esc(a.sub_marks)}</strong> / ${esc(a.max_marks)}`;
  if (a.sub_status) return badge("submitted");
  if (isPast(a.due_date)) return `<span class="badge b-rejected">overdue</span>`;
  return badge("pending");
}

// ---------------------------------------------------------------------------
// Data accessors
// ---------------------------------------------------------------------------
async function teacherCourseTitles(teacherId) {
  const [r] = await q("SELECT * FROM teacher_courses WHERE teacher_id = ? ORDER BY created_at DESC", [teacherId]);
  return r;
}
async function studentCourseTitles(studentId) {
  const [r] = await q(
    `SELECT DISTINCT course_title FROM enrollments
     WHERE user_id = ? AND status <> 'rejected' AND course_title <> '' ORDER BY course_title`,
    [studentId]
  );
  return r.map((x) => x.course_title);
}
async function studentsInCourse(courseTitle) {
  const [r] = await q(
    `SELECT DISTINCT u.id, u.full_name, u.email, u.phone
     FROM users u JOIN enrollments e ON e.user_id = u.id
     WHERE u.role = 'student' AND e.course_title = ? AND e.status <> 'rejected'
     ORDER BY u.full_name LIMIT 300`,
    [courseTitle]
  );
  return r;
}
async function getAssignment(id) {
  const [r] = await q("SELECT * FROM assignments WHERE id = ? LIMIT 1", [id]);
  return r[0] || null;
}
async function getSubmissionFor(assignmentId, studentId) {
  const [r] = await q("SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1", [assignmentId, studentId]);
  return r[0] || null;
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
       WHERE u.role = 'student' AND e.course_title = ? AND e.status <> 'rejected' LIMIT 300`,
      [courseTitle]
    );
    for (const s of st) await core.createNotice("user", s.id, title, body);
  } catch (e) {
    /* notices are best-effort */
  }
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
module.exports = function mountAcademics(app) {
  const need = (...roles) => core.requireUser(...roles);
  const hwUpload = core.makeUpload("assignments", HW_EXTS, 1);
  const subUpload = core.makeUpload("submissions", HW_EXTS, 1);

  // ------------------------------- LISTS -------------------------------
  // One URL, two roles.
  app.get("/portal/assignments", need("student", "teacher"), async (req, res) => {
    if (req.user.role === "teacher") return teacherList(req, res);
    return studentList(req, res);
  });

  async function teacherList(req, res) {
    const u = req.user;
    const mine = (await q(
      `SELECT a.*,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS subs,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'graded') AS graded
       FROM assignments a WHERE a.teacher_id = ? ORDER BY a.created_at DESC LIMIT 300`,
      [u.id]
    ))[0];
    const assigned = await teacherCourseTitles(u.id);
    const rows = mine.map((a) => `<tr>
      <td><strong>${esc(a.title)}</strong><div class="muted" style="font-size:.78rem">${esc(a.course_title)}</div></td>
      <td class="muted">${shortDate(a.due_date)}</td>
      <td>${Number(a.max_marks)}</td>
      <td>${Number(a.subs)} <span class="muted">(${Number(a.graded)} graded)</span></td>
      <td>${badge(a.status)}</td>
      <td class="row" style="gap:6px">
        <a class="btn ghost sm" href="/portal/assignments/view?id=${esc(a.id)}">Open</a>
        <a class="btn danger sm" href="/portal/assignments/delete?id=${esc(a.id)}" onclick="return confirm('Delete this assignment and all its submissions?')">Delete</a>
      </td></tr>`).join("");
    res.send(core.shell(u, "assign", "Assignments", "Create coursework and grade your students' submissions.",
      `${req.query.ok ? `<div class="ok">✅ ${esc(req.query.ok)}</div>` : ""}
       ${assigned.length ? "" : `<div class="note"><h4>⚠️ No course assigned yet</h4><p>The academy has not assigned you a course. Ask the admin to assign one before creating assignments.</p></div>`}
       <div class="panel">
         <div class="row" style="justify-content:space-between">
           <h2 style="margin:0">📝 My assignments (${mine.length})</h2>
           <a class="btn primary sm" href="/portal/assignments/new">➕ New assignment</a>
         </div>
         ${mine.length ? `<table class="mt"><tr><th>Assignment</th><th>Due</th><th>Marks</th><th>Submissions</th><th>Status</th><th></th></tr>${rows}</table>`
           : `<p class="muted mt">No assignments yet. Click “New assignment” to post your first task.</p>`}
       </div>`));
  }

  async function studentList(req, res) {
    const u = req.user;
    const courses = await studentCourseTitles(u.id);
    let list = [];
    if (courses.length) {
      const ph = courses.map(() => "?").join(",");
      const [r] = await q(
        `SELECT a.*, t.full_name AS teacher,
                s.status AS sub_status, s.marks AS sub_marks, s.submitted_at AS sub_at
         FROM assignments a
         LEFT JOIN users t ON t.id = a.teacher_id
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
         WHERE a.status <> 'draft' AND a.course_title IN (${ph})
         ORDER BY (a.due_date IS NULL), a.due_date ASC LIMIT 300`,
        [u.id, ...courses]
      );
      list = r;
    }
    const rows = list.map((a) => `<tr>
      <td><strong>${esc(a.title)}</strong><div class="muted" style="font-size:.78rem">${esc(a.course_title)}${a.teacher ? " · " + esc(a.teacher) : ""}</div></td>
      <td class="muted">${shortDate(a.due_date)}</td>
      <td>${badge(a.status)}</td>
      <td>${marksCell(a)}</td>
      <td><a class="btn ghost sm" href="/portal/assignments/view?id=${esc(a.id)}">Open</a></td>
    </tr>`).join("");
    const pending = list.filter((a) => !a.sub_status).length;
    const done = list.filter((a) => a.sub_status === "graded").length;
    res.send(core.shell(u, "assign", "My Assignments", "Download the task, upload your work and track your marks.",
      `${req.query.ok ? `<div class="ok">✅ ${esc(req.query.ok)}</div>` : ""}
       ${req.query.e ? `<div class="err">⚠️ ${esc(req.query.e)}</div>` : ""}
       <div class="cards">
         <div class="stat"><b>${list.length}</b><span>Total assignments</span></div>
         <div class="stat"><b>${pending}</b><span>Pending / not submitted</span></div>
         <div class="stat"><b>${list.filter((a) => a.sub_status).length}</b><span>Submitted</span></div>
         <div class="stat"><b>${done}</b><span>Graded</span></div>
       </div>
       <div class="panel">
         <h2>📝 All assignments</h2>
         ${list.length ? `<table><tr><th>Assignment</th><th>Due</th><th>Status</th><th>Marks</th><th></th></tr>${rows}</table>`
           : (courses.length
               ? `<p class="muted">No assignments posted for your courses yet.</p>`
               : `<p class="muted">You are not enrolled in any course yet. <a href="/courses">Browse courses</a></p>`)}
       </div>`));
  }

  // ------------------------------- NEW -------------------------------
  app.get("/portal/assignments/new", need("teacher"), async (req, res) => {
    const courses = await teacherCourseTitles(req.user.id);
    const all = await core.ctx.getCourses();
    const opts = (courses.length ? courses : all).map((c) => {
      const title = c.course_title || c.title;
      return `<option value="${esc(title)}">${esc(title)}</option>`;
    }).join("");
    res.send(core.shell(req.user, "assign", "New assignment", "Post a task to every student enrolled in the selected course.",
      `${req.query.e ? `<div class="err">⚠️ ${esc(req.query.e)}</div>` : ""}
       ${courses.length ? "" : `<div class="note"><h4>⚠️ No course assigned yet</h4><p>You can still post an assignment by picking a course below, but ask the admin to assign you the course for it to reach students.</p></div>`}
       <div class="panel">
         <form method="post" action="/portal/assignments/new" enctype="multipart/form-data">
           <label>Course *</label>
           <select name="course_title" required>${opts}</select>
           <label>Assignment title *</label>
           <input name="title" required maxlength="200" placeholder="e.g. Lab 3 — Subnetting exercise">
           <label>Instructions / description</label>
           <textarea name="description" placeholder="Explain the task, deliverables and marking scheme…"></textarea>
           <div class="grid2">
             <div><label>Due date &amp; time</label><input type="datetime-local" name="due_date"></div>
             <div><label>Total marks *</label><input type="number" name="max_marks" min="1" max="1000" value="100" required></div>
           </div>
           <label>Attach assignment brief (PDF, DOCX, ZIP, image… optional, max 10 MB)</label>
           <input type="file" name="file">
           <div class="row mt">
             <button class="btn primary" type="submit">📤 Post assignment</button>
             <a class="btn ghost" href="/portal/assignments">Cancel</a>
           </div>
         </form>
       </div>`));
  });

  app.post("/portal/assignments/new", need("teacher"), (req, res, next) => {
    hwUpload.single("file")(req, res, (err) => {
      if (err) return res.redirect("/portal/assignments/new?e=" + encodeURIComponent(err.message || "Upload failed"));
      next();
    });
  }, form, async (req, res) => {
    const back = (m) => res.redirect("/portal/assignments/new?e=" + encodeURIComponent(m));
    const u = req.user;
    const courseTitle = String(req.body.course_title || "").trim();
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const due = parseDue(req.body.due_date);
    const maxMarks = Math.max(1, Math.min(1000, Number(req.body.max_marks || 100)));
    if (courseTitle.length < 2) return back("Please choose a course");
    if (title.length < 2) return back("Please enter an assignment title");
    try {
      const id = uid("asg_");
      await q(
        `INSERT INTO assignments (id, course_title, teacher_id, title, description, due_date, max_marks, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?, 'published', NOW(), NOW())`,
        [id, courseTitle, u.id, title, description, due, maxMarks]
      );
      if (req.file) {
        const docId = await core.saveDocument({
          scope: "assignment", refId: id, userId: u.id, kind: "assignment",
          label: "Assignment brief", file: req.file, uploadedBy: "teacher", subdir: "assignments",
        });
        await q("UPDATE assignments SET doc_id = ? WHERE id = ?", [docId, id]);
      }
      await notifyStudents(courseTitle, `📝 New assignment: ${title}`,
        `A new assignment has been posted in "${courseTitle}".` + (due ? ` Due: ${due}.` : ""));
      res.redirect("/portal/assignments/view?id=" + encodeURIComponent(id) + "&ok=" + encodeURIComponent("Assignment posted"));
    } catch (err) {
      console.error("assignment create failed:", err.message);
      back("Could not create the assignment. Please try again.");
    }
  });

  // ------------------------------- VIEW -------------------------------
  app.get("/portal/assignments/view", need("student", "teacher"), async (req, res) => {
    const a = await getAssignment(String(req.query.id || ""));
    if (!a) return res.send(core.errorPage("Assignment not found", "This assignment no longer exists."));
    if (req.user.role === "teacher") {
      if (a.teacher_id !== req.user.id) return res.send(core.errorPage("Access denied", "This assignment belongs to another instructor."));
      return teacherView(req, res, a);
    }
    if (!(await studentEnrolled(req.user.id, a.course_title))) {
      return res.send(core.errorPage("Access denied", "You are not enrolled in this course."));
    }
    return studentView(req, res, a);
  });

  async function teacherView(req, res, a) {
    const students = await studentsInCourse(a.course_title);
    const [subs] = await q("SELECT * FROM submissions WHERE assignment_id = ?", [a.id]);
    const byStudent = {};
    subs.forEach((s) => (byStudent[s.student_id] = s));
    const doc = a.doc_id ? await core.getDocument(a.doc_id) : null;
    const rows = students.map((s) => {
      const sub = byStudent[s.id];
      const hasFile = sub && sub.doc_id;
      const gradeForm = `<form method="post" action="/portal/assignments/grade" class="row" style="gap:6px;align-items:center">
        <input type="hidden" name="assignment_id" value="${esc(a.id)}">
        <input type="hidden" name="student_id" value="${esc(s.id)}">
        <input type="number" name="marks" min="0" max="${Number(a.max_marks)}" step="0.5" value="${sub && sub.marks != null ? esc(sub.marks) : ""}" placeholder="/${Number(a.max_marks)}" style="width:90px">
        <input name="feedback" value="${sub ? esc(sub.feedback || "") : ""}" placeholder="Feedback" style="width:170px">
        <button class="btn ok sm" type="submit">Save</button>
      </form>`;
      return `<tr>
        <td><strong>${esc(s.full_name)}</strong><div class="muted" style="font-size:.78rem">${esc(s.email)}</div></td>
        <td class="muted">${sub ? shortDate(sub.submitted_at) : "—"}</td>
        <td>${sub ? (sub.status === "graded" ? `<span class="badge b-graded">graded ${esc(sub.marks)}/${Number(a.max_marks)}</span>` : badge("submitted")) : `<span class="badge b-rejected">not submitted</span>`}</td>
        <td>${hasFile ? `<a class="btn ghost sm" href="/portal/submission-file/${esc(sub.doc_id)}" target="_blank">⬇ Download</a>` : `<span class="muted">—</span>`}${sub && sub.note ? `<div class="muted" style="font-size:.76rem;max-width:220px">💬 ${esc(sub.note).slice(0, 160)}</div>` : ""}</td>
        <td>${gradeForm}</td>
      </tr>`;
    }).join("");
    const gradedN = subs.filter((s) => s.status === "graded").length;
    res.send(core.shell(req.user, "assign", a.title, `${esc(a.course_title)} · posted ${esc(a.created_at)}`,
      `${req.query.ok ? `<div class="ok">✅ ${esc(req.query.ok)}</div>` : ""}
       <div class="cards">
         <div class="stat"><b>${students.length}</b><span>Students</span></div>
         <div class="stat"><b>${subs.length}</b><span>Submissions</span></div>
         <div class="stat"><b>${gradedN}</b><span>Graded</span></div>
         <div class="stat"><b>${Number(a.max_marks)}</b><span>Total marks</span></div>
       </div>
       <div class="panel">
         <h2>Assignment details</h2>
         <table>
           <tr><th>Course</th><td>${esc(a.course_title)}</td></tr>
           <tr><th>Due</th><td>${esc(a.due_date || "—")}</td></tr>
           <tr><th>Total marks</th><td>${Number(a.max_marks)}</td></tr>
           <tr><th>Status</th><td>${badge(a.status)}</td></tr>
           <tr><th>Brief</th><td>${doc ? `<a class="btn ghost sm" href="/portal/assignment-file/${esc(doc.id)}" target="_blank">📎 ${esc(doc.originalname || "Download")}</a>` : `<span class="muted">No file attached</span>`}</td></tr>
           <tr><th>Instructions</th><td style="white-space:pre-wrap">${esc(a.description || "—")}</td></tr>
         </table>
         <p class="mt"><a class="btn ghost sm" href="/portal/assignments">All assignments</a>
           <a class="btn danger sm" href="/portal/assignments/delete?id=${esc(a.id)}" onclick="return confirm('Delete this assignment?')">Delete</a></p>
       </div>
       <div class="panel">
         <h2>Submissions &amp; grading (${students.length} student(s))</h2>
         ${students.length ? `<table><tr><th>Student</th><th>Submitted</th><th>Status</th><th>Work</th><th>Give marks</th></tr>${rows}</table>`
           : `<p class="muted">No students are enrolled in this course yet.</p>`}
       </div>`));
  }

  async function studentView(req, res, a) {
    const sub = await getSubmissionFor(a.id, req.user.id);
    const doc = a.doc_id ? await core.getDocument(a.doc_id) : null;
    const graded = sub && sub.status === "graded";
    const pct = graded && Number(a.max_marks) > 0 ? (Number(sub.marks) / Number(a.max_marks)) * 100 : 0;
    const resultCard = graded ? `
      <div class="panel">
        <h2>📊 Your result</h2>
        <div class="cards">
          <div class="stat"><b>${esc(sub.marks)} / ${Number(a.max_marks)}</b><span>Marks obtained</span></div>
          <div class="stat"><b>${pct.toFixed(1)}%</b><span>Percentage</span></div>
          <div class="stat"><b>${gradeLetter(pct)}</b><span>Grade</span></div>
          <div class="stat"><b>${gpaPoint(pct).toFixed(1)}</b><span>GPA points</span></div>
        </div>
        ${sub.feedback ? `<div class="note mt"><h4>👩‍🏫 Teacher feedback</h4><p>${esc(sub.feedback)}</p></div>` : ""}
        <p class="muted mt">Graded on ${esc(sub.graded_at || "")}</p>
      </div>` : "";

    const submitPanel = graded
      ? `<div class="panel"><h2>✅ Submitted &amp; graded</h2>
           ${sub.doc_id ? `<p><a class="btn ghost sm" href="/portal/submission-file/${esc(sub.doc_id)}" target="_blank">⬇ Your submitted file</a></p>` : ""}
           ${sub.note ? `<p class="muted mt">💬 ${esc(sub.note)}</p>` : ""}
           <p class="muted mt">Contact your teacher if you need to resubmit.</p>
         </div>`
      : `<div class="panel"><h2>⬆️ ${sub ? "Resubmit your work" : "Upload your work"}</h2>
           ${sub ? `<p class="muted">You submitted on ${esc(sub.submitted_at)}. You can replace it until it is graded.</p>` : ""}
           <form method="post" action="/portal/assignments/submit" enctype="multipart/form-data">
             <input type="hidden" name="assignment_id" value="${esc(a.id)}">
             <label>Your file (PDF, DOCX, ZIP, image… max 10 MB) *</label>
             <input type="file" name="file" required>
             <label>Note to the teacher (optional)</label>
             <textarea name="note" placeholder="Anything your teacher should know…">${sub ? esc(sub.note || "") : ""}</textarea>
             <button class="btn primary mt" type="submit">📤 ${sub ? "Replace submission" : "Submit assignment"}</button>
           </form>
           ${sub && sub.doc_id ? `<p class="mt"><a class="btn ghost sm" href="/portal/submission-file/${esc(sub.doc_id)}" target="_blank">⬇ Download what you submitted</a></p>` : ""}
         </div>`;

    res.send(core.shell(req.user, "assign", a.title, `${esc(a.course_title)} · ${a.teacher ? "by " + esc(a.teacher) : ""}`,
      `${req.query.ok ? `<div class="ok">✅ ${esc(req.query.ok)}</div>` : ""}
       ${req.query.e ? `<div class="err">⚠️ ${esc(req.query.e)}</div>` : ""}
       <div class="panel">
         <h2>Task details</h2>
         <table>
           <tr><th>Course</th><td>${esc(a.course_title)}</td></tr>
           <tr><th>Due</th><td>${esc(a.due_date || "—")} ${!graded && !sub && isPast(a.due_date) ? `<span class="badge b-rejected">overdue</span>` : ""}</td></tr>
           <tr><th>Total marks</th><td>${Number(a.max_marks)}</td></tr>
           <tr><th>Status</th><td>${graded ? `<span class="badge b-graded">graded</span>` : sub ? badge("submitted") : badge("pending")}</td></tr>
           <tr><th>Assignment brief</th><td>${doc ? `<a class="btn ghost sm" href="/portal/assignment-file/${esc(doc.id)}" target="_blank">⬇ ${esc(doc.originalname || "Download brief")}</a>` : `<span class="muted">No file attached</span>`}</td></tr>
           <tr><th>Instructions</th><td style="white-space:pre-wrap">${esc(a.description || "—")}</td></tr>
         </table>
         <p class="mt"><a class="btn ghost sm" href="/portal/assignments">All assignments</a></p>
       </div>
       ${resultCard}
       ${submitPanel}`));
  }

  // ------------------------------- SUBMIT (student) -------------------------------
  app.post("/portal/assignments/submit", need("student"), (req, res, next) => {
    subUpload.single("file")(req, res, (err) => {
      if (err) return res.redirect("/portal/assignments?e=" + encodeURIComponent(err.message || "Upload failed"));
      next();
    });
  }, form, async (req, res) => {
    const assignmentId = String(req.body.assignment_id || "");
    const back = (msg) => res.redirect("/portal/assignments/view?id=" + encodeURIComponent(assignmentId) + (msg ? "&e=" + encodeURIComponent(msg) : ""));
    const a = await getAssignment(assignmentId);
    if (!a) return res.redirect("/portal/assignments?e=" + encodeURIComponent("Assignment not found"));
    if (a.status === "closed") return back("This assignment is closed for submissions");
    if (!(await studentEnrolled(req.user.id, a.course_title))) return back("You are not enrolled in this course");
    const existing = await getSubmissionFor(a.id, req.user.id);
    if (existing && existing.status === "graded") return back("This assignment is already graded — ask your teacher to reopen it");
    if (!req.file) return back("Please attach your file");
    try {
      const docId = await core.saveDocument({
        scope: "submission", refId: a.id, userId: req.user.id, kind: "submission",
        label: "Student submission", file: req.file, uploadedBy: "student", subdir: "submissions",
      });
      const note = String(req.body.note || "").slice(0, 2000);
      await q(
        `INSERT INTO submissions (id, assignment_id, student_id, doc_id, note, submitted_at, status, updated_at)
         VALUES (?,?,?,?,?,NOW(),'submitted',NOW())
         ON DUPLICATE KEY UPDATE doc_id=VALUES(doc_id), note=VALUES(note), submitted_at=NOW(), status='submitted', updated_at=NOW()`,
        [uid("sub_"), a.id, req.user.id, docId, note]
      );
      try {
        await core.createNotice("user", a.teacher_id, `📥 New submission: ${a.title}`,
          `${req.user.full_name} submitted work for "${a.title}" (${a.course_title}).`);
      } catch { /* best effort */ }
      res.redirect("/portal/assignments/view?id=" + encodeURIComponent(a.id) + "&ok=" + encodeURIComponent("Assignment submitted"));
    } catch (err) {
      console.error("submit failed:", err.message);
      back("Could not save your submission. Please try again.");
    }
  });

  // ------------------------------- GRADE (teacher) -------------------------------
  app.post("/portal/assignments/grade", need("teacher"), form, async (req, res) => {
    const assignmentId = String(req.body.assignment_id || "");
    const studentId = String(req.body.student_id || "");
    const back = (m) => res.redirect("/portal/assignments/view?id=" + encodeURIComponent(assignmentId) + (m ? "&ok=" + encodeURIComponent(m) : ""));
    const a = await getAssignment(assignmentId);
    if (!a || a.teacher_id !== req.user.id) return res.redirect("/portal/assignments?e=" + encodeURIComponent("Not allowed"));
    const marks = Math.max(0, Math.min(Number(a.max_marks), Number(req.body.marks || 0)));
    const feedback = String(req.body.feedback || "").slice(0, 2000);
    try {
      await q(
        `INSERT INTO submissions (id, assignment_id, student_id, doc_id, note, submitted_at, status, marks, feedback, graded_at, graded_by, updated_at)
         VALUES (?,?,?,'','',NOW(),'graded',?,?,NOW(),?,NOW())
         ON DUPLICATE KEY UPDATE status='graded', marks=VALUES(marks), feedback=VALUES(feedback),
           graded_at=NOW(), graded_by=VALUES(graded_by), updated_at=NOW()`,
        [uid("sub_"), a.id, studentId, marks, feedback, req.user.id]
      );
      try {
        await core.createNotice("user", studentId, `✅ Graded: ${a.title}`,
          `Your submission for "${a.title}" (${a.course_title}) was graded: ${marks}/${Number(a.max_marks)}.`);
      } catch { /* best effort */ }
      back("Marks saved");
    } catch (err) {
      console.error("grade failed:", err.message);
      back("");
    }
  });

  // ------------------------------- DELETE (teacher) -------------------------------
  app.get("/portal/assignments/delete", need("teacher"), async (req, res) => {
    const a = await getAssignment(String(req.query.id || ""));
    if (a && a.teacher_id === req.user.id) {
      await q("DELETE FROM submissions WHERE assignment_id = ?", [a.id]);
      await q("DELETE FROM assignments WHERE id = ?", [a.id]);
    }
    res.redirect("/portal/assignments?ok=" + encodeURIComponent("Assignment deleted"));
  });

  // ------------------------------- MY STUDENTS (teacher) -------------------------------
  app.get("/portal/students", need("teacher"), async (req, res) => {
    const courses = await teacherCourseTitles(req.user.id);
    const blocks = [];
    let total = 0;
    for (const c of courses) {
      const list = await studentsInCourse(c.course_title);
      total += list.length;
      blocks.push(`<div class="panel"><h2>${esc(c.course_title)} <span class="muted" style="font-size:.8rem">(${list.length})</span></h2>
        ${list.length ? `<table><tr><th>Student</th><th>Email</th><th>Phone</th></tr>
          ${list.map((s) => `<tr><td><strong>${esc(s.full_name)}</strong></td><td class="muted">${esc(s.email)}</td><td class="muted">${esc(s.phone) || "—"}</td></tr>`).join("")}</table>`
          : `<p class="muted">No students enrolled in this course yet.</p>`}</div>`);
    }
    res.send(core.shell(req.user, "students", "My Students", "Everyone enrolled in the courses assigned to you.",
      `${total ? `<div class="cards"><div class="stat"><b>${total}</b><span>Total enrolments</span></div><div class="stat"><b>${courses.length}</b><span>Courses</span></div></div>` : ""}
       ${blocks.join("") || `<div class="panel"><p class="empty">No courses assigned yet.</p></div>`}`));
  });

  // ------------------------------- MARKS / RESULT CARD (student) -------------------------------
  app.get("/portal/marks", need("student"), async (req, res) => {
    const u = req.user;
    const rows = (await q(
      `SELECT a.title, a.course_title, a.max_marks, a.due_date,
              s.status AS sub_status, s.marks AS sub_marks, s.feedback, s.graded_at
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE s.student_id = ?
       ORDER BY a.course_title, a.created_at ASC`,
      [u.id]
    ))[0];
    const graded = rows.filter((r) => r.sub_status === "graded");
    const totalMax = graded.reduce((n, r) => n + Number(r.max_marks || 0), 0);
    const totalGot = graded.reduce((n, r) => n + Number(r.sub_marks || 0), 0);
    const pct = totalMax > 0 ? (totalGot / totalMax) * 100 : 0;
    const body = rows.map((r) => {
      const g = r.sub_status === "graded";
      const p = g && Number(r.max_marks) > 0 ? (Number(r.sub_marks) / Number(r.max_marks)) * 100 : 0;
      return `<tr>
        <td><strong>${esc(r.title)}</strong><div class="muted" style="font-size:.78rem">${esc(r.course_title)}</div></td>
        <td class="muted">${shortDate(r.due_date)}</td>
        <td>${g ? `<strong>${esc(r.sub_marks)}</strong> / ${esc(r.max_marks)}` : `<span class="muted">— / ${esc(r.max_marks)}</span>`}</td>
        <td>${g ? `${p.toFixed(0)}%` : `<span class="muted">—</span>`}</td>
        <td>${g ? `<span class="badge b-graded">${gradeLetter(p)}</span>` : badge("submitted")}</td>
        <td class="muted" style="max-width:240px">${g && r.feedback ? esc(r.feedback) : "—"}</td>
      </tr>`;
    }).join("");
    res.send(core.shell(u, "marks", "My Marks & Result Card", "Your graded assignments and overall performance.",
      `${graded.length ? `
        <div class="cards">
          <div class="stat"><b>${graded.length}</b><span>Graded assignments</span></div>
          <div class="stat"><b>${totalGot} / ${totalMax}</b><span>Marks obtained</span></div>
          <div class="stat"><b>${pct.toFixed(1)}%</b><span>Overall percentage</span></div>
          <div class="stat"><b>${gradeLetter(pct)}</b><span>Overall grade</span></div>
        </div>
        <div class="panel">
          <h2>📊 Result card</h2>
          <table><tr><th>Assignment</th><th>Due</th><th>Marks</th><th>%</th><th>Grade</th><th>Feedback</th></tr>${body}</table>
        </div>`
        : `<div class="panel"><p class="empty">No graded assignments yet. Your results will appear here once your teacher checks your work.</p></div>`}`));
  });

  // ------------------------------- FILE DOWNLOADS -------------------------------
  app.get("/portal/assignment-file/:id", need("student", "teacher"), async (req, res) => {
    const doc = await core.getDocument(String(req.params.id || ""));
    if (!doc) return res.status(404).send("Not found");
    const [[a]] = await q("SELECT * FROM assignments WHERE doc_id = ? AND doc_id <> '' LIMIT 1", [doc.id]);
    if (!a) return res.status(404).send("Not found");
    const allowed = req.user.role === "teacher"
      ? a.teacher_id === req.user.id
      : await studentEnrolled(req.user.id, a.course_title);
    if (!allowed) return res.status(403).send("Forbidden");
    core.serveDoc(res, doc);
  });

  app.get("/portal/submission-file/:id", need("student", "teacher"), async (req, res) => {
    const doc = await core.getDocument(String(req.params.id || ""));
    if (!doc) return res.status(404).send("Not found");
    const [[s]] = await q("SELECT * FROM submissions WHERE doc_id = ? AND doc_id <> '' LIMIT 1", [doc.id]);
    if (!s) return res.status(404).send("Not found");
    let allowed = false;
    if (req.user.role === "student") {
      allowed = s.student_id === req.user.id;
    } else {
      const a = await getAssignment(s.assignment_id);
      allowed = !!(a && a.teacher_id === req.user.id);
    }
    if (!allowed) return res.status(403).send("Forbidden");
    core.serveDoc(res, doc);
  });

  console.log("📚 Portal academics mounted");
};
