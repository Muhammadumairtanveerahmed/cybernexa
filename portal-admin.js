/**
 * CyberNexa Solutions — Portal administration (mounted under /admin)
 * -------------------------------------------------------------------
 * Manage students, teacher applications, enrollments, payments,
 * receipts/certificates, notices and password resets.
 *
 * Every route here is registered after `app.use("/admin", adminAuth)` in
 * server.js, so it is protected by the admin password.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { core, hashPassword } = require("./portal");

const form = express.urlencoded({ extended: false, limit: "300kb" });

function A() {
  return core.ctx; // set when portal.mount() runs
}
const esc = (s) => core.esc(s);
const q = (sql, p) => core.q(sql, p);
const uid = (p) => core.uid(p);

function layout(title, active, body) {
  return A().adminLayout(title, active, body);
}
function badge(s) {
  return core.statusBadge(s);
}
function money(n) {
  return "PKR " + Number(n || 0).toLocaleString("en-PK");
}

module.exports = function mountAdmin(app) {
  const upload = core.makeUpload("documents", [".pdf", ".jpg", ".jpeg", ".png"], 4);
  const uploadMany = core.makeUpload("documents", [".pdf", ".jpg", ".jpeg", ".png"], 8);

  // ============================ STUDENTS ============================
  app.get("/admin/students", async (req, res) => {
    const search = String(req.query.q || "").trim();
    const like = "%" + search + "%";
    const [rows] = search
      ? await q(
          `SELECT u.*, (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enr
           FROM users u WHERE u.role = 'student' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)
           ORDER BY u.created_at DESC LIMIT 300`,
          [like, like, like]
        )
      : await q(
          `SELECT u.*, (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enr
           FROM users u WHERE u.role = 'student' ORDER BY u.created_at DESC LIMIT 300`
        );
    const body = rows
      .map(
        (u) => `<tr>
        <td><strong>${esc(u.full_name)}</strong><div class="muted" style="font-size:.78rem">${esc(u.email)}</div></td>
        <td>${esc(u.phone) || "-"}</td>
        <td>${badge(u.status)}</td>
        <td>${Number(u.enr || 0)}</td>
        <td class="muted">${esc(u.created_at)}</td>
        <td><a class="btn b-read" href="/admin/students/view?id=${esc(u.id)}">Open</a></td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Students",
        "students",
        `<div class="head-row"><div><h1>🎒 Students</h1>
        <p class="sub">${rows.length} student(s)${search ? ` matching “${esc(search)}”` : ""}</p></div>
        <form method="get" action="/admin/students" style="display:flex;gap:8px">
          <input type="text" name="q" value="${esc(search)}" placeholder="Search name / email / phone">
          <button class="btn b-read" type="submit">Search</button>
        </form></div>
        <div class="panel"><table>
        <tr><th>Student</th><th>Phone</th><th>Status</th><th>Enrollments</th><th>Joined</th><th></th></tr>
        ${body || `<tr><td colspan="6" class="empty">No students yet.</td></tr>`}
        </table></div>`
      )
    );
  });

  app.get("/admin/students/view", async (req, res) => {
    const u = await core.getUserById(String(req.query.id || ""));
    if (!u || u.role !== "student") return res.redirect("/admin/students?error=Student+not+found");
    const p = (await core.getStudentProfile(u.id)) || {};
    const enrs = await core.getEnrollmentsForUser(u.id);
    const docs = await core.getUserDocuments(u.id);
    const okMsg = req.query.ok ? `<div class="notice">✅ ${esc(req.query.ok)}</div>` : "";
    const errMsg = req.query.error ? `<div class="notice" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.35);color:#f87171">⚠️ ${esc(req.query.error)}</div>` : "";

    const rows = enrs
      .map(
        (e) => `<tr>
        <td><strong>${esc(e.course_title)}</strong><div class="muted" style="font-size:.78rem">${esc(e.enrollment_type)}</div></td>
        <td>${esc(e.price)}</td><td>${badge(e.status)}</td>
        <td><a class="btn b-read" href="/admin/enrollments/view?id=${esc(e.id)}">Manage</a></td>
      </tr>`
      )
      .join("");

    res.send(
      layout(
        "Admin — Student",
        "students",
        `${okMsg}${errMsg}
      <div class="head-row"><div><h1>👤 ${esc(u.full_name)}</h1>
        <p class="sub">${esc(u.email)} · joined ${esc(u.created_at)} · last login ${esc(u.last_login || "-")}</p></div>
        <a class="btn b-read" href="/admin/students">All students</a></div>

      <div class="panel"><h2>Account</h2>
        <table>
          <tr><th>Status</th><td>${badge(u.status)}</td></tr>
          <tr><th>Phone</th><td>${esc(u.phone) || "-"}</td></tr>
          <tr><th>CNIC / B-Form</th><td>${esc(p.cnic) || "-"}</td></tr>
          <tr><th>Date of birth</th><td>${esc(p.dob) || "-"}</td></tr>
          <tr><th>City</th><td>${esc(p.city) || "-"}</td></tr>
          <tr><th>Address</th><td>${esc(p.address) || "-"}</td></tr>
          <tr><th>Guardian</th><td>${esc(p.guardian_name) || "-"} ${esc(p.guardian_phone)}</td></tr>
          <tr><th>Last qualification</th><td>${esc(p.last_qualification) || "-"}</td></tr>
          <tr><th>Interests</th><td>${esc(p.interests) || "-"}</td></tr>
        </table>
        <div class="row mt">
          <form method="post" action="/admin/account/status" style="display:flex;gap:8px;align-items:center">
            <input type="hidden" name="id" value="${esc(u.id)}"><input type="hidden" name="back" value="/admin/students/view?id=${esc(u.id)}">
            <select name="status" style="width:auto">
              ${["active", "suspended", "pending", "rejected"].map((s) => `<option ${u.status === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <button class="btn b-read" type="submit">Set status</button>
          </form>
          <form method="post" action="/admin/resets/link">
            <input type="hidden" name="user_id" value="${esc(u.id)}"><input type="hidden" name="back" value="/admin/students/view?id=${esc(u.id)}">
            <button class="btn b-read" type="submit">🔐 Create reset link</button>
          </form>
        </div>
      </div>

      <div class="panel"><h2>Enrollments (${enrs.length})</h2>
        <table><tr><th>Course</th><th>Fee</th><th>Status</th><th></th></tr>
        ${rows || `<tr><td colspan="4" class="empty">No enrollments.</td></tr>`}</table>
      </div>

      <div class="panel"><h2>Uploaded documents (${docs.length})</h2>
        ${docs.map((d) => `<div class="file" style="margin-bottom:8px"><span class="nm">${esc(d.originalname)}</span>
          <span class="pill">${esc(d.label)}</span>
          <a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Download</a></div>`).join("") ||
          `<p class="muted">No documents.</p>`}
      </div>`
      )
    );
  });

  // ============================ TEACHERS ============================
  app.get("/admin/teachers", async (req, res) => {
    const filter = String(req.query.status || "");
    const [rows] = filter
      ? await q("SELECT * FROM users WHERE role='teacher' AND status = ? ORDER BY created_at DESC LIMIT 300", [filter])
      : await q("SELECT * FROM users WHERE role='teacher' ORDER BY (status='pending') DESC, created_at DESC LIMIT 300");
    const [cnt] = await q("SELECT status, COUNT(*) n FROM users WHERE role='teacher' GROUP BY status");
    const counts = {}; cnt.forEach((c) => (counts[c.status] = c.n));
    const body = rows
      .map(
        (t) => `<tr>
        <td><strong>${esc(t.full_name)}</strong><div class="muted" style="font-size:.78rem">${esc(t.email)}</div></td>
        <td>${esc(t.phone) || "-"}</td>
        <td>${badge(t.status)}</td>
        <td class="muted">${esc(t.created_at)}</td>
        <td><a class="btn b-read" href="/admin/teachers/view?id=${esc(t.id)}">Review</a></td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Teachers",
        "teachers",
        `<div class="head-row"><div><h1>👨‍🏫 Teachers</h1>
        <p class="sub">${counts.pending || 0} pending · ${counts.active || 0} active · ${counts.rejected || 0} rejected</p></div>
        <div class="row">
          <a class="btn b-read" href="/admin/teachers">All</a>
          <a class="btn b-read" href="/admin/teachers?status=pending">Pending</a>
          <a class="btn b-read" href="/admin/teachers?status=active">Active</a>
          <a class="btn b-read" href="/admin/teachers?status=rejected">Rejected</a>
        </div></div>
        <div class="panel"><table>
        <tr><th>Teacher</th><th>Phone</th><th>Status</th><th>Applied</th><th></th></tr>
        ${body || `<tr><td colspan="5" class="empty">No teacher applications yet.</td></tr>`}
        </table></div>`
      )
    );
  });

  app.get("/admin/teachers/view", async (req, res) => {
    const t = await core.getUserById(String(req.query.id || ""));
    if (!t || t.role !== "teacher") return res.redirect("/admin/teachers?error=Teacher+not+found");
    const p = (await core.getTeacherProfile(t.id)) || {};
    const docs = await core.getUserDocuments(t.id);
    const cv = docs.find((d) => d.kind === "cv");
    const [assigned] = await q("SELECT * FROM teacher_courses WHERE teacher_id = ? ORDER BY created_at DESC", [t.id]);
    const courses = await A().getCourses();
    const opts = courses.map((c) => `<option value="${esc(c.title)}">`).join("");
    const okMsg = req.query.ok ? `<div class="notice">✅ ${esc(req.query.ok)}</div>` : "";
    res.send(
      layout(
        "Admin — Teacher",
        "teachers",
        `${okMsg}
      <div class="head-row"><div><h1>👨‍🏫 ${esc(t.full_name)}</h1>
        <p class="sub">${esc(t.email)} · applied ${esc(p.applied_at || t.created_at)}</p></div>
        <a class="btn b-read" href="/admin/teachers">All teachers</a></div>

      <div class="panel"><h2>Application</h2>
        <table>
          <tr><th>Status</th><td>${badge(t.status)}</td></tr>
          <tr><th>Phone</th><td>${esc(t.phone) || "-"}</td></tr>
          <tr><th>Qualification</th><td>${esc(p.qualification) || "-"}</td></tr>
          <tr><th>Expertise</th><td>${esc(p.expertise) || "-"}</td></tr>
          <tr><th>Experience</th><td>${Number(p.experience_years || 0)} years</td></tr>
          <tr><th>Expected fee</th><td>${esc(p.expected_fee) || "-"}</td></tr>
          <tr><th>Availability</th><td>${esc(p.availability) || "-"}</td></tr>
          <tr><th>Portfolio</th><td>${p.portfolio_url ? `<a href="${esc(p.portfolio_url)}" target="_blank">${esc(p.portfolio_url)}</a>` : "-"}</td></tr>
          <tr><th>Bio</th><td class="msg" style="max-width:520px">${esc(p.bio) || "-"}</td></tr>
          <tr><th>CV</th><td>${cv ? `<a class="btn b-read" href="/admin/doc/${esc(cv.id)}" target="_blank">📎 Download CV</a>` : "-"}</td></tr>
        </table>
        <div class="row mt">
          ${t.status !== "active"
            ? `<form method="post" action="/admin/teachers/decision">
                 <input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="action" value="approve">
                 <button class="btn" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#86efac" type="submit">✅ Approve teacher</button>
               </form>` : ""}
          ${t.status !== "rejected"
            ? `<form method="post" action="/admin/teachers/decision" onsubmit="return confirm('Reject this application?')">
                 <input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="action" value="reject">
                 <button class="btn b-del" type="submit">✕ Reject</button>
               </form>` : ""}
        </div>
      </div>

      <div class="panel"><h2>Assigned courses</h2>
        ${assigned.length
          ? `<table><tr><th>Course</th><th>Assigned</th><th></th></tr>${assigned
              .map((c) => `<tr><td>${esc(c.course_title)}</td><td class="muted">${esc(c.created_at)}</td>
              <td><a class="btn b-del" href="/admin/teachers/unassign?id=${esc(c.id)}&t=${esc(t.id)}">Remove</a></td></tr>`)
              .join("")}</table>`
          : `<p class="muted">No courses assigned.</p>`}
        <form method="post" action="/admin/teachers/assign" class="mt" style="display:flex;gap:8px">
          <input type="hidden" name="teacher_id" value="${esc(t.id)}">
          <input list="courseopts" name="course_title" placeholder="Course title" required>
          <datalist id="courseopts">${opts}</datalist>
          <button class="btn b-add" type="submit">Assign</button>
        </form>
      </div>`
      )
    );
  });

  app.post("/admin/teachers/decision", form, async (req, res) => {
    const id = String(req.body.id || "");
    const action = String(req.body.action || "");
    const t = await core.getUserById(id);
    if (!t || t.role !== "teacher") return res.redirect("/admin/teachers?error=Not+found");
    if (action === "approve") {
      await q("UPDATE users SET status='active', updated_at=NOW() WHERE id=?", [id]);
      await q("UPDATE teacher_profiles SET reviewed_at=NOW() WHERE user_id=?", [id]);
      await core.createNotice("user", id, "✅ Application approved", "Congratulations! Your teacher account has been approved. You can now be assigned courses.");
    } else if (action === "reject") {
      await q("UPDATE users SET status='rejected', updated_at=NOW() WHERE id=?", [id]);
      await q("UPDATE teacher_profiles SET reviewed_at=NOW(), rejection_reason=? WHERE user_id=?", [String(req.body.reason || "").slice(0, 240), id]);
      await core.createNotice("user", id, "Application not approved", "Unfortunately your teacher application was not approved at this time.");
    }
    res.redirect("/admin/teachers/view?id=" + encodeURIComponent(id) + "&ok=" + encodeURIComponent(action === "approve" ? "Teacher approved" : "Application rejected"));
  });

  app.post("/admin/teachers/assign", form, async (req, res) => {
    const tid = String(req.body.teacher_id || "");
    const title = String(req.body.course_title || "").trim();
    if (title) {
      await q("INSERT INTO teacher_courses (id, teacher_id, course_title, created_at) VALUES (?,?,?,NOW())", [uid("tc_"), tid, title]);
      await core.createNotice("user", tid, "📚 New course assigned", `You have been assigned: " + ${JSON.stringify(title)} + ".`);
    }
    res.redirect("/admin/teachers/view?id=" + encodeURIComponent(tid) + "&ok=Course+assigned");
  });

  app.get("/admin/teachers/unassign", async (req, res) => {
    await q("DELETE FROM teacher_courses WHERE id = ? AND teacher_id = ?", [String(req.query.id || ""), String(req.query.t || "")]);
    res.redirect("/admin/teachers/view?id=" + encodeURIComponent(String(req.query.t || "")) + "&ok=Course+removed");
  });

  // ============================ ENROLLMENTS ============================
  app.get("/admin/enrollments", async (req, res) => {
    const filter = String(req.query.status || "");
    const [rows] = filter
      ? await q(
          `SELECT e.*, u.full_name AS student FROM enrollments e LEFT JOIN users u ON u.id = e.user_id
           WHERE e.status = ? ORDER BY e.created_at DESC LIMIT 400`, [filter])
      : await q(
          `SELECT e.*, u.full_name AS student FROM enrollments e LEFT JOIN users u ON u.id = e.user_id
           ORDER BY e.created_at DESC LIMIT 400`);
    const body = rows
      .map(
        (e) => `<tr>
        <td><strong>${esc(e.course_title)}</strong><div class="muted" style="font-size:.78rem">${esc(e.enrollment_type)} · ${esc(e.id)}</div></td>
        <td>${e.student ? esc(e.student) : `<span class="muted">guest</span>`}</td>
        <td>${esc(e.price)}</td>
        <td>${badge(e.status)} ${badge(e.payment_status)}</td>
        <td class="muted">${esc(e.created_at)}</td>
        <td><a class="btn b-read" href="/admin/enrollments/view?id=${esc(e.id)}">Manage</a></td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Enrollments",
        "enrollments",
        `<div class="head-row"><div><h1>🎓 Enrollments</h1><p class="sub">${rows.length} record(s)</p></div>
        <div class="row">
          <a class="btn b-read" href="/admin/enrollments">All</a>
          <a class="btn b-read" href="/admin/enrollments?status=pending">Pending</a>
          <a class="btn b-read" href="/admin/enrollments?status=approved">Approved</a>
          <a class="btn b-read" href="/admin/enrollments?status=completed">Completed</a>
        </div></div>
        <div class="panel"><table>
        <tr><th>Course</th><th>Student</th><th>Fee</th><th>Status</th><th>Date</th><th></th></tr>
        ${body || `<tr><td colspan="6" class="empty">No enrollments yet.</td></tr>`}
        </table></div>`
      )
    );
  });

  app.get("/admin/enrollments/view", async (req, res) => {
    const e = await core.getEnrollment(String(req.query.id || ""));
    if (!e) return res.redirect("/admin/enrollments?error=Not+found");
    const student = e.user_id ? await core.getUserById(e.user_id) : null;
    const docs = await core.getEnrollmentDocs(e.id);
    const payments = await core.getPayments(e.id);
    const paid = await core.paidTotal(e.id);
    const okMsg = req.query.ok ? `<div class="notice">✅ ${esc(req.query.ok)}</div>` : "";
    const receipt = docs.filter((d) => d.kind === "receipt");
    const cert = docs.filter((d) => d.kind === "certificate");
    const normal = docs.filter((d) => !["receipt", "certificate"].includes(d.kind));
    res.send(
      layout(
        "Admin — Enrollment",
        "enrollments",
        `${okMsg}
      <div class="head-row"><div><h1>🎓 ${esc(e.course_title)}</h1>
        <p class="sub">${esc(e.enrollment_type)} · ${esc(e.price)} · ${esc(e.created_at)}</p></div>
        <a class="btn b-read" href="/admin/enrollments">All enrollments</a></div>

      <div class="panel"><h2>Status &amp; payment</h2>
        <div class="row">
          <form method="post" action="/admin/enrollments/status" class="row">
            <input type="hidden" name="id" value="${esc(e.id)}">
            <select name="status">${["pending", "approved", "rejected", "completed"].map((s) => `<option ${e.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
            <button class="btn b-read" type="submit">Update status</button>
          </form>
          <form method="post" action="/admin/enrollments/total" class="row">
            <input type="hidden" name="id" value="${esc(e.id)}">
            <input type="number" name="amount_total" min="0" step="1" value="${Number(e.amount_total || 0)}" style="width:150px">
            <button class="btn b-read" type="submit">Set total fee</button>
          </form>
        </div>
        <div class="row mt" style="gap:26px">
          <div><div class="muted" style="font-size:.78rem">Total</div><strong>${money(e.amount_total)}</strong></div>
          <div><div class="muted" style="font-size:.78rem">Paid</div><strong>${money(paid)}</strong></div>
          <div><div class="muted" style="font-size:.78rem">Balance</div><strong>${money(Number(e.amount_total || 0) - paid)}</strong></div>
          <div><div class="muted" style="font-size:.78rem">Payment</div>${badge(e.payment_status)}</div>
        </div>
      </div>

      <div class="panel"><h2>Student</h2>
        ${student
          ? `<p><strong>${esc(student.full_name)}</strong> · ${esc(student.email)} · ${esc(student.phone) || "-"}
             · <a href="/admin/students/view?id=${esc(student.id)}">open profile</a></p>`
          : `<p class="muted">Guest enrollment (no portal account).</p>`}
      </div>

      <div class="panel"><h2>Add payment</h2>
        <form method="post" action="/admin/enrollments/payment" class="row">
          <input type="hidden" name="id" value="${esc(e.id)}">
          <input type="number" name="amount" min="1" step="1" placeholder="Amount" required style="width:140px">
          <input name="method" placeholder="Method (Cash / Bank / Easypaisa)" style="width:230px">
          <input name="note" placeholder="Note" style="width:220px">
          <button class="btn b-add" type="submit">Record payment</button>
        </form>
        ${payments.length
          ? `<table class="mt"><tr><th>Date</th><th>Amount</th><th>Method</th><th>Note</th></tr>
             ${payments.map((p) => `<tr><td>${esc(p.paid_at)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}</td><td class="muted">${esc(p.note)}</td></tr>`).join("")}</table>`
          : `<p class="muted mt">No payments recorded.</p>`}
      </div>

      <div class="panel"><h2>Documents</h2>
        ${normal.map((d) => `<div class="file" style="margin-bottom:8px"><span class="nm">${esc(d.originalname)}</span>
          <span class="pill">${esc(d.label)}</span><a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Download</a></div>`).join("") ||
          `<p class="muted">No documents uploaded.</p>`}
      </div>

      <div class="panel"><h2>Receipt &amp; certificate</h2>
        <div class="row">
          <form method="post" action="/admin/enrollments/upload" enctype="multipart/form-data" class="row">
            <input type="hidden" name="id" value="${esc(e.id)}">
            <select name="kind"><option value="receipt">Receipt</option><option value="certificate">Certificate</option></select>
            <input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required>
            <button class="btn b-add" type="submit">Upload</button>
          </form>
        </div>
        <div class="row mt">
          ${receipt.map((d) => `<span class="file">🧾 ${esc(d.originalname)} <a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Open</a></span>`).join("")}
          ${cert.map((d) => `<span class="file">🏅 ${esc(d.originalname)} <a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Open</a></span>`).join("")}
        </div>
      </div>

      <div class="panel"><h2>Notes</h2>
        <form method="post" action="/admin/enrollments/notes" class="row">
          <input type="hidden" name="id" value="${esc(e.id)}">
          <input name="notes" value="${esc(e.notes || "")}" placeholder="Internal / student visible note" style="flex:1">
          <button class="btn b-read" type="submit">Save note</button>
        </form>
      </div>`
      )
    );
  });

  app.post("/admin/enrollments/status", form, async (req, res) => {
    await q("UPDATE enrollments SET status = ?, updated_at = NOW() WHERE id = ?", [String(req.body.status || "pending"), String(req.body.id)]);
    res.redirect("/admin/enrollments/view?id=" + encodeURIComponent(String(req.body.id)) + "&ok=Status+updated");
  });
  app.post("/admin/enrollments/total", form, async (req, res) => {
    const id = String(req.body.id);
    await q("UPDATE enrollments SET amount_total = ?, updated_at = NOW() WHERE id = ?", [Number(req.body.amount_total || 0), id]);
    await core.setPaymentStatus(id);
    res.redirect("/admin/enrollments/view?id=" + encodeURIComponent(id) + "&ok=Total+fee+updated");
  });
  app.post("/admin/enrollments/notes", form, async (req, res) => {
    const id = String(req.body.id);
    await q("UPDATE enrollments SET notes = ?, updated_at = NOW() WHERE id = ?", [String(req.body.notes || "").slice(0, 240), id]);
    res.redirect("/admin/enrollments/view?id=" + encodeURIComponent(id) + "&ok=Note+saved");
  });
  app.post("/admin/enrollments/payment", form, async (req, res) => {
    const id = String(req.body.id);
    await q("INSERT INTO payments (id, enrollment_id, amount, method, note, paid_at) VALUES (?,?,?,?,?,NOW())", [
      uid("pay_"), id, Number(req.body.amount || 0), String(req.body.method || "").slice(0, 40), String(req.body.note || "").slice(0, 200),
    ]);
    await core.setPaymentStatus(id);
    res.redirect("/admin/enrollments/view?id=" + encodeURIComponent(id) + "&ok=Payment+recorded");
  });
  app.post("/admin/enrollments/upload", (req, res, next) => {
    upload.single("file")(req, res, (err) => next(err));
  }, form, async (req, res) => {
    const id = String(req.body.id);
    if (req.file) {
      await core.saveDocument({
        scope: "enrollment", refId: id, userId: "", kind: String(req.body.kind || "receipt"),
        label: String(req.body.kind === "certificate" ? "Certificate" : "Receipt"), file: req.file, uploadedBy: "admin", subdir: "documents",
      });
    }
    res.redirect("/admin/enrollments/view?id=" + encodeURIComponent(id) + "&ok=File+uploaded");
  });

  // ============================ PASSWORD RESETS ============================
  app.get("/admin/resets", async (req, res) => {
    const [rows] = await q(
      `SELECT r.*, u.full_name, u.email, u.role FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.used = 0 AND r.expires_at > NOW() ORDER BY r.requested_at DESC LIMIT 200`
    );
    const base = A().originOf(req);
    const link = req.query.link
      ? `<div class="notice">🔐 Reset link (send it to the student):<br><code style="user-select:all;word-break:break-all">${esc(req.query.link)}</code></div>`
      : "";
    const body = rows
      .map(
        (r) => `<tr>
        <td><strong>${esc(r.full_name)}</strong><div class="muted" style="font-size:.78rem">${esc(r.email)} · ${esc(r.role)}</div></td>
        <td class="muted">${esc(r.requested_at)}</td>
        <td class="muted">${esc(r.expires_at)}</td>
        <td><a class="btn b-read" href="${base}/portal/reset?token=${esc(r.token)}" target="_blank">Open link</a>
        <button class="btn b-read" onclick="navigator.clipboard.writeText('${base}/portal/reset?token=${esc(r.token)}')">Copy</button></td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Password resets",
        "resets",
        `${link}
      <div class="head-row"><div><h1>🔐 Password reset requests</h1>
        <p class="sub">${rows.length} open request(s). Send the link to the student, or set a password directly from their profile.</p></div>
        <a class="btn b-read" href="/admin">Dashboard</a></div>
      <div class="panel"><table>
        <tr><th>User</th><th>Requested</th><th>Expires</th><th>Action</th></tr>
        ${body || `<tr><td colspan="4" class="empty">No open requests.</td></tr>`}
      </table></div>`
      )
    );
  });

  app.post("/admin/resets/link", form, async (req, res) => {
    const userId = String(req.body.user_id || "");
    const token = crypto.randomBytes(24).toString("hex");
    await q("INSERT INTO password_resets (id, token, user_id, requested_at, expires_at) VALUES (?,?,?,NOW(), DATE_ADD(NOW(), INTERVAL 3 DAY))", [uid("rst_"), token, userId]);
    const url = A().originOf(req) + "/portal/reset?token=" + token;
    const back = String(req.body.back || "");
    if (back) return res.redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("Reset link created"));
    res.redirect("/admin/resets?link=" + encodeURIComponent(url));
  });

  // ============================ NOTICES ============================
  app.get("/admin/notices", async (req, res) => {
    const [rows] = await q("SELECT * FROM notices WHERE audience <> 'user' ORDER BY created_at DESC LIMIT 100");
    const okMsg = req.query.ok ? `<div class="notice">✅ ${esc(req.query.ok)}</div>` : "";
    const body = rows
      .map(
        (n) => `<tr><td><strong>${esc(n.title)}</strong><div class="muted" style="font-size:.82rem;white-space:pre-wrap">${esc(n.body)}</div></td>
        <td>${esc(n.audience)}</td><td class="muted">${esc(n.created_at)}</td>
        <td><a class="btn b-del" href="/admin/notices/delete?id=${esc(n.id)}">Delete</a></td></tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Notices",
        "notices",
        `${okMsg}
      <div class="head-row"><div><h1>🔔 Notices</h1><p class="sub">Announcements shown in the student & teacher portals.</p></div>
      <a class="btn b-read" href="/admin">Dashboard</a></div>
      <div class="panel"><h2>➕ Post a notice</h2>
        <form method="post" action="/admin/notices">
          <div class="form-grid">
            <div><label>Audience</label><select name="audience">
              <option value="all">Everyone</option><option value="students">Students</option><option value="teachers">Teachers</option>
            </select></div>
            <div><label>Title</label><input name="title" required maxlength="160"></div>
          </div>
          <label>Message</label><textarea name="body" required></textarea>
          <button class="btn b-add mt" type="submit">Post notice</button>
        </form></div>
      <div class="panel"><h2>Posted (${rows.length})</h2>
        <table><tr><th>Notice</th><th>Audience</th><th>Posted</th><th></th></tr>${body || `<tr><td colspan="4" class="empty">No notices yet.</td></tr>`}</table>
      </div>`
      )
    );
  });

  app.post("/admin/notices", form, async (req, res) => {
    await core.createNotice(String(req.body.audience || "all"), "", String(req.body.title || "").slice(0, 160), String(req.body.body || ""));
    res.redirect("/admin/notices?ok=Notice+posted");
  });
  app.get("/admin/notices/delete", async (req, res) => {
    await q("DELETE FROM notices WHERE id = ?", [String(req.query.id || "")]);
    res.redirect("/admin/notices?ok=Notice+deleted");
  });

  // ============================ ASSIGNMENTS ============================
  app.get("/admin/assignments", async (req, res) => {
    const [rows] = await q(
      `SELECT a.*, t.full_name AS teacher,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS subs,
        (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'graded') AS graded
       FROM assignments a LEFT JOIN users t ON t.id = a.teacher_id
       ORDER BY a.created_at DESC LIMIT 400`
    );
    const body = rows
      .map(
        (a) => `<tr>
        <td><strong>${esc(a.title)}</strong><div class="muted" style="font-size:.78rem">${esc(a.course_title)}</div></td>
        <td>${esc(a.teacher) || "-"}</td>
        <td class="muted">${esc(a.due_date) || "-"}</td>
        <td>${Number(a.subs)} <span class="muted">(${Number(a.graded)} graded)</span></td>
        <td>${badge(a.status)}</td>
        <td><a class="btn b-read" href="/admin/assignments/view?id=${esc(a.id)}">Open</a></td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Assignments",
        "assignments",
        `<div class="head-row"><div><h1>📝 Assignments</h1>
        <p class="sub">${rows.length} assignment(s) posted by teachers.</p></div>
        <a class="btn b-read" href="/admin">Dashboard</a></div>
        <div class="panel"><table>
        <tr><th>Assignment</th><th>Teacher</th><th>Due</th><th>Submissions</th><th>Status</th><th></th></tr>
        ${body || `<tr><td colspan="6" class="empty">No assignments posted yet.</td></tr>`}
        </table></div>`
      )
    );
  });

  app.get("/admin/assignments/view", async (req, res) => {
    const [ar] = await q("SELECT * FROM assignments WHERE id = ? LIMIT 1", [String(req.query.id || "")]);
    const a = ar[0];
    if (!a) return res.redirect("/admin/assignments?error=Not+found");
    const [teacher] = await q("SELECT * FROM users WHERE id = ? LIMIT 1", [a.teacher_id]);
    const [subs] = await q(
      `SELECT s.*, u.full_name AS student, u.email
       FROM submissions s LEFT JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
      [a.id]
    );
    const doc = a.doc_id ? await core.getDocument(a.doc_id) : null;
    const subRows = subs
      .map(
        (s) => `<tr>
        <td><strong>${esc(s.student) || "—"}</strong><div class="muted" style="font-size:.78rem">${esc(s.email) || ""}</div></td>
        <td class="muted">${esc(s.submitted_at)}</td>
        <td>${s.status === "graded" ? `<strong>${esc(s.marks)}</strong> / ${Number(a.max_marks)}` : badge("submitted")}</td>
        <td class="muted" style="max-width:260px">${s.feedback ? esc(s.feedback) : "—"}</td>
        <td>${s.doc_id ? `<a class="btn b-read" href="/admin/doc/${esc(s.doc_id)}" target="_blank">Download</a>` : "—"}</td>
      </tr>`
      )
      .join("");
    res.send(
      layout(
        "Admin — Assignment",
        "assignments",
        `<div class="head-row"><div><h1>📝 ${esc(a.title)}</h1>
        <p class="sub">${esc(a.course_title)} · teacher ${esc((teacher && teacher.full_name) || "-")} · posted ${esc(a.created_at)}</p></div>
        <a class="btn b-read" href="/admin/assignments">All assignments</a></div>
        <div class="panel"><h2>Details</h2>
          <table>
            <tr><th>Course</th><td>${esc(a.course_title)}</td></tr>
            <tr><th>Due</th><td>${esc(a.due_date) || "-"}</td></tr>
            <tr><th>Total marks</th><td>${Number(a.max_marks)}</td></tr>
            <tr><th>Status</th><td>${badge(a.status)}</td></tr>
            <tr><th>Brief</th><td>${doc ? `<a class="btn b-read" href="/admin/doc/${esc(doc.id)}" target="_blank">📎 ${esc(doc.originalname)}</a>` : "-"}</td></tr>
            <tr><th>Instructions</th><td class="msg" style="white-space:pre-wrap">${esc(a.description) || "-"}</td></tr>
          </table>
        </div>
        <div class="panel"><h2>Submissions (${subs.length})</h2>
          <table><tr><th>Student</th><th>Submitted</th><th>Marks</th><th>Feedback</th><th>File</th></tr>
          ${subRows || `<tr><td colspan="5" class="empty">No submissions yet.</td></tr>`}</table>
        </div>`
      )
    );
  });

  // ============================ SHARED ACTIONS ============================
  app.post("/admin/account/status", form, async (req, res) => {
    await q("UPDATE users SET status = ?, updated_at = NOW() WHERE id = ? AND role <> 'admin'", [String(req.body.status || "active"), String(req.body.user_id || req.body.id || "")]);
    const back = String(req.body.back || "/admin");
    res.redirect(back + (back.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("Status updated"));
  });

  // Admin download of any uploaded document
  app.get("/admin/doc/:id", async (req, res) => {
    const doc = await core.getDocument(String(req.params.id || ""));
    if (!doc) return res.status(404).send("<h1>404 — Not found</h1>");
    const root = core.UPLOAD_ROOT();
    const full = path.resolve(root, doc.relpath);
    if (!full.startsWith(path.resolve(root)) || !fs.existsSync(full)) return res.status(404).send("<h1>404 — File missing</h1>");
    res.download(full, doc.originalname || path.basename(full));
  });

  console.log("🛠️  Portal admin mounted");
};
