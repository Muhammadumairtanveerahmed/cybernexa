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
        `<div class="head-row"><div><h1><i class="fa-solid fa-user-graduate"></i> Students</h1>
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
    const okMsg = req.query.ok ? `<div class="notice"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : "";
    const errMsg = req.query.error ? `<div class="notice" style="background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.35);color:#f87171"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(req.query.error)}</div>` : "";

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
      <div class="head-row"><div><h1><i class="fa-solid fa-user"></i> ${esc(u.full_name)}</h1>
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
            <button class="btn b-read" type="submit"><i class="fa-solid fa-lock"></i> Create reset link</button>
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
        `<div class="head-row"><div><h1><i class="fa-solid fa-chalkboard-user"></i> Teachers</h1>
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
    const okMsg = req.query.ok ? `<div class="notice"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : "";
    res.send(
      layout(
        "Admin — Teacher",
        "teachers",
        `${okMsg}
      <div class="head-row"><div><h1><i class="fa-solid fa-chalkboard-user"></i> ${esc(t.full_name)}</h1>
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
          <tr><th>CV</th><td>${cv ? `<a class="btn b-read" href="/admin/doc/${esc(cv.id)}" target="_blank"><i class="fa-solid fa-paperclip"></i> Download CV</a>` : "-"}</td></tr>
        </table>
        <div class="row mt">
          ${t.status !== "active"
            ? `<form method="post" action="/admin/teachers/decision">
                 <input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="action" value="approve">
                 <button class="btn" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#86efac" type="submit"><i class="fa-solid fa-circle-check"></i> Approve teacher</button>
               </form>` : ""}
          ${t.status !== "rejected"
            ? `<form method="post" action="/admin/teachers/decision" onsubmit="return confirm('Reject this application?')">
                 <input type="hidden" name="id" value="${esc(t.id)}"><input type="hidden" name="action" value="reject">
                 <button class="btn b-del" type="submit"><i class="fa-solid fa-xmark"></i> Reject</button>
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
      await core.createNotice("user", id, "Application approved", "Congratulations! Your teacher account has been approved. You can now be assigned courses.");
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
      await core.createNotice("user", tid, "New course assigned", `You have been assigned: " + ${JSON.stringify(title)} + ".`);
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
        `<div class="head-row"><div><h1><i class="fa-solid fa-graduation-cap"></i> Enrollments</h1><p class="sub">${rows.length} record(s)</p></div>
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
    const okMsg = req.query.ok ? `<div class="notice"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : "";
    const receipt = docs.filter((d) => d.kind === "receipt");
    const cert = docs.filter((d) => d.kind === "certificate");
    const normal = docs.filter((d) => !["receipt", "certificate"].includes(d.kind));
    res.send(
      layout(
        "Admin — Enrollment",
        "enrollments",
        `${okMsg}
      <div class="head-row"><div><h1><i class="fa-solid fa-graduation-cap"></i> ${esc(e.course_title)}</h1>
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
          ${receipt.map((d) => `<span class="file"><i class="fa-solid fa-receipt"></i> ${esc(d.originalname)} <a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Open</a></span>`).join("")}
          ${cert.map((d) => `<span class="file"><i class="fa-solid fa-medal"></i> ${esc(d.originalname)} <a class="btn b-read" href="/admin/doc/${esc(d.id)}" target="_blank">Open</a></span>`).join("")}
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
      ? `<div class="notice"><i class="fa-solid fa-lock"></i> Reset link (send it to the student):<br><code style="user-select:all;word-break:break-all">${esc(req.query.link)}</code></div>`
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
      <div class="head-row"><div><h1><i class="fa-solid fa-lock"></i> Password reset requests</h1>
        <p class="sub">${rows.length} open request(s). Send the link to the student, or set a password directly from their profile.</p></div>
        <a class="btn b-read" href="/admin/dashboard">Dashboard</a></div>
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
    const okMsg = req.query.ok ? `<div class="notice"><i class="fa-solid fa-circle-check"></i> ${esc(req.query.ok)}</div>` : "";
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
      <div class="head-row"><div><h1><i class="fa-solid fa-bell"></i> Notices</h1><p class="sub">Announcements shown in the student & teacher portals.</p></div>
      <a class="btn b-read" href="/admin/dashboard">Dashboard</a></div>
      <div class="panel"><h2><i class="fa-solid fa-plus"></i> Post a notice</h2>
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
        `<div class="head-row"><div><h1><i class="fa-solid fa-pen-to-square"></i> Assignments</h1>
        <p class="sub">${rows.length} assignment(s) posted by teachers.</p></div>
        <a class="btn b-read" href="/admin/dashboard">Dashboard</a></div>
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
        `<div class="head-row"><div><h1><i class="fa-solid fa-pen-to-square"></i> ${esc(a.title)}</h1>
        <p class="sub">${esc(a.course_title)} · teacher ${esc((teacher && teacher.full_name) || "-")} · posted ${esc(a.created_at)}</p></div>
        <a class="btn b-read" href="/admin/assignments">All assignments</a></div>
        <div class="panel"><h2>Details</h2>
          <table>
            <tr><th>Course</th><td>${esc(a.course_title)}</td></tr>
            <tr><th>Due</th><td>${esc(a.due_date) || "-"}</td></tr>
            <tr><th>Total marks</th><td>${Number(a.max_marks)}</td></tr>
            <tr><th>Status</th><td>${badge(a.status)}</td></tr>
            <tr><th>Brief</th><td>${doc ? `<a class="btn b-read" href="/admin/doc/${esc(doc.id)}" target="_blank"><i class="fa-solid fa-paperclip"></i> ${esc(doc.originalname)}</a>` : "-"}</td></tr>
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

  // ============================ CAMPUS (attendance, timetable, materials, quizzes) ============================
  const DAYS = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  app.get("/admin/campus", async (req, res) => {
    const [[stats]] = await q(
      `SELECT
        (SELECT COUNT(*) FROM timetable) AS slots,
        (SELECT COUNT(*) FROM attendance_sessions) AS sessions,
        (SELECT COUNT(*) FROM materials) AS materials,
        (SELECT COUNT(*) FROM quizzes) AS quizzes,
        (SELECT COUNT(*) FROM quiz_attempts WHERE status='submitted') AS attempts,
        (SELECT COUNT(*) FROM announcements) AS announcements`
    );
    const [slots] = await q(
      `SELECT * FROM timetable ORDER BY day_of_week, start_time LIMIT 300`
    );
    const [sessions] = await q(
      `SELECT s.*, t.full_name AS teacher,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id AND a.status IN ('present','late')) AS present,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS total
       FROM attendance_sessions s LEFT JOIN users t ON t.id = s.teacher_id
       ORDER BY s.session_date DESC LIMIT 40`
    );
    const [materials] = await q(
      `SELECT m.*, t.full_name AS teacher FROM materials m LEFT JOIN users t ON t.id = m.teacher_id
       ORDER BY m.created_at DESC LIMIT 40`
    );
    const [quizzes] = await q(
      `SELECT z.*, t.full_name AS teacher,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS qn,
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = z.id AND a.status='submitted') AS attempts
       FROM quizzes z LEFT JOIN users t ON t.id = z.teacher_id
       ORDER BY z.created_at DESC LIMIT 40`
    );
    const [anns] = await q(
      `SELECT n.*, t.full_name AS teacher FROM announcements n LEFT JOIN users t ON t.id = n.teacher_id
       ORDER BY n.created_at DESC LIMIT 40`
    );
    const courses = await A().getCourses();

    const byDay = {};
    for (const s of slots) (byDay[s.day_of_week] = byDay[s.day_of_week] || []).push(s);
    const dayCols = [1, 2, 3, 4, 5, 6].map((d) => {
      const list = byDay[d] || [];
      return `<div class="box" style="padding:14px">
        <strong>${DAYS[d]}</strong>
        ${list.length ? list.map((s) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border-bottom:1px solid var(--border);padding:6px 0;font-size:.85rem">
            <span><span style="color:var(--cyan)">${esc(String(s.start_time).slice(0, 5))}–${esc(String(s.end_time).slice(0, 5))}</span> ${esc(s.course_title)}${s.room ? ` <span style="color:var(--muted)">(${esc(s.room)})</span>` : ""}</span>
            <a class="btn b-del" href="/admin/campus/timetable/delete?id=${esc(s.id)}" onclick="return confirm('Remove this slot?')"><i class="fa-solid fa-xmark"></i></a>
          </div>`).join("") : `<div style="color:var(--muted);font-size:.82rem;padding:6px 0">No classes</div>`}
      </div>`;
    }).join("");

    const courseOpts = courses.map((c) => `<option value="${esc(c.title)}">${esc(c.title)}</option>`).join("");
    const sessRows = sessions.map((s) => `<tr>
      <td class="muted">${esc(String(s.session_date).slice(0, 10))}</td>
      <td><strong>${esc(s.course_title)}</strong><div class="muted" style="font-size:.76rem">${esc(s.topic) || "—"}</div></td>
      <td>${esc(s.teacher) || "—"}</td>
      <td>${Number(s.present)} / ${Number(s.total)}</td>
    </tr>`).join("");
    const matRows = materials.map((m) => `<tr>
      <td><strong>${esc(m.title)}</strong><div class="muted" style="font-size:.76rem">${esc(m.course_title)}</div></td>
      <td>${esc(m.teacher) || "—"}</td>
      <td class="muted">${esc(String(m.created_at).slice(0, 16))}</td>
      <td>${m.doc_id ? `<a class="btn b-read" href="/admin/doc/${esc(m.doc_id)}" target="_blank">Download</a>` : m.external_url ? `<a class="btn b-read" href="${esc(m.external_url)}" target="_blank">Link</a>` : "—"}</td>
    </tr>`).join("");
    const qzRows = quizzes.map((z) => `<tr>
      <td><strong>${esc(z.title)}</strong><div class="muted" style="font-size:.76rem">${esc(z.course_title)}</div></td>
      <td>${esc(z.teacher) || "—"}</td>
      <td>${Number(z.qn)}</td>
      <td>${Number(z.attempts)}</td>
      <td>${badge(z.status)}</td>
    </tr>`).join("");
    const annRows = anns.map((n) => `<tr>
      <td><strong>${esc(n.title)}</strong>${n.pinned ? ` <span class="badge on">pinned</span>` : ""}</td>
      <td>${esc(n.course_title)}</td>
      <td>${esc(n.teacher) || "—"}</td>
      <td class="muted">${esc(String(n.created_at).slice(0, 16))}</td>
    </tr>`).join("");

    res.send(
      layout(
        "Admin — Campus",
        "campus",
        `<div class="head-row"><div><h1><i class="fa-solid fa-school"></i> Campus</h1>
          <p class="sub">Attendance, timetable, course materials, quizzes and announcements across the academy.</p></div>
          <a class="btn b-read" href="/admin/dashboard">Dashboard</a></div>
        <div class="stats">
          <div class="box"><b>${Number(stats.sessions)}</b><span>Attendance sessions</span></div>
          <div class="box v"><b>${Number(stats.slots)}</b><span>Timetable slots</span></div>
          <div class="box g"><b>${Number(stats.materials)}</b><span>Materials</span></div>
          <div class="box o"><b>${Number(stats.quizzes)}</b><span>Quizzes (${Number(stats.attempts)} attempts)</span></div>
        </div>
        <div class="panel"><h2><i class="fa-solid fa-calendar-days"></i> Timetable</h2>
          <form method="post" action="/admin/campus/timetable/add" class="form-grid">
            <div><label>Course</label><select name="course_title" required><option value="">— select —</option>${courseOpts}</select></div>
            <div><label>Day</label><select name="day_of_week">${[1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}">${DAYS[d]}</option>`).join("")}</select></div>
            <div><label>Start time</label><input type="time" name="start_time" required></div>
            <div><label>End time</label><input type="time" name="end_time" required></div>
            <div><label>Room / Lab</label><input type="text" name="room" maxlength="60" placeholder="e.g. Lab-2"></div>
            <div style="display:flex;align-items:flex-end"><button class="btn b-add" type="submit">Add slot</button></div>
          </form>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-top:20px">${dayCols}</div>
        </div>
        <div class="panel"><h2><i class="fa-solid fa-circle-check"></i> Recent attendance sessions (${sessions.length})</h2>
          <table><tr><th>Date</th><th>Course</th><th>Teacher</th><th>Present</th></tr>${sessRows || `<tr><td colspan="4" class="empty">No attendance taken yet.</td></tr>`}</table>
        </div>
        <div class="panel"><h2><i class="fa-solid fa-folder"></i> Course materials (${materials.length})</h2>
          <table><tr><th>Resource</th><th>Teacher</th><th>Added</th><th></th></tr>${matRows || `<tr><td colspan="4" class="empty">No materials shared yet.</td></tr>`}</table>
        </div>
        <div class="panel"><h2><i class="fa-solid fa-flask"></i> Quizzes (${quizzes.length})</h2>
          <table><tr><th>Quiz</th><th>Teacher</th><th>Questions</th><th>Attempts</th><th>Status</th></tr>${qzRows || `<tr><td colspan="5" class="empty">No quizzes created yet.</td></tr>`}</table>
        </div>
        <div class="panel"><h2><i class="fa-solid fa-bullhorn"></i> Announcements (${anns.length})</h2>
          <table><tr><th>Title</th><th>Course</th><th>Teacher</th><th>Posted</th></tr>${annRows || `<tr><td colspan="4" class="empty">No announcements yet.</td></tr>`}</table>
        </div>`
      )
    );
  });

  app.post("/admin/campus/timetable/add", form, async (req, res) => {
    const course = String(req.body.course_title || "").trim();
    const day = Math.min(6, Math.max(1, Number(req.body.day_of_week) || 1));
    const st = String(req.body.start_time || "").slice(0, 5);
    const en = String(req.body.end_time || "").slice(0, 5);
    const room = String(req.body.room || "").trim().slice(0, 60);
    if (course && /^\d{2}:\d{2}$/.test(st) && /^\d{2}:\d{2}$/.test(en) && en > st) {
      await q("INSERT INTO timetable (id, course_title, teacher_id, day_of_week, start_time, end_time, room, created_at) VALUES (?,?,?,?,?,?,?,NOW())",
        [uid("tt_"), course, "", day, st + ":00", en + ":00", room]);
    }
    res.redirect("/admin/campus");
  });

  app.get("/admin/campus/timetable/delete", async (req, res) => {
    await q("DELETE FROM timetable WHERE id = ?", [String(req.query.id || "")]);
    res.redirect("/admin/campus");
  });

  // ============================ LOGIN ACTIVITY ============================
  const pktTime = (col) => `DATE_FORMAT(DATE_ADD(${col}, INTERVAL 5 HOUR), '%d %b %Y, %h:%i %p')`;

  function resultPill(s) {
    const map = {
      success: ["rgba(34,197,94,.15)", "#22c55e", "rgba(34,197,94,.4)", "Success"],
      failed: ["rgba(239,68,68,.15)", "#f87171", "rgba(239,68,68,.4)", "Failed"],
      suspended: ["rgba(249,115,22,.15)", "#fb923c", "rgba(249,115,22,.4)", "Suspended"],
      blocked: ["rgba(148,163,184,.15)", "#94a3b8", "rgba(148,163,184,.4)", "Blocked"],
    };
    const m = map[s] || map.failed;
    return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700;background:${m[0]};color:${m[1]};border:1px solid ${m[2]}">${m[3]}</span>`;
  }

  function deviceOf(ua) {
    const s = String(ua || "");
    const os = /Windows/i.test(s) ? "Windows"
      : /Android/i.test(s) ? "Android"
      : /iPhone|iPad|iPod/i.test(s) ? "iOS"
      : /Mac OS X/i.test(s) ? "macOS"
      : /Linux/i.test(s) ? "Linux"
      : "Other";
    const br = /Edg\//i.test(s) ? "Edge"
      : /OPR\/|Opera/i.test(s) ? "Opera"
      : /Chrome\//i.test(s) ? "Chrome"
      : /Firefox\//i.test(s) ? "Firefox"
      : /Safari\//i.test(s) ? "Safari"
      : "Browser";
    return s ? os + " / " + br : "-";
  }

  function logFilters(req) {
    const status = ["success", "failed", "suspended", "blocked"].includes(String(req.query.status))
      ? String(req.query.status) : "all";
    const role = ["student", "teacher", "admin"].includes(String(req.query.role))
      ? String(req.query.role) : "all";
    const days = [1, 7, 30, 90, 180].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const search = String(req.query.q || "").trim();
    const where = [];
    const params = [];
    if (status !== "all") { where.push("status = ?"); params.push(status); }
    if (role !== "all") { where.push("role = ?"); params.push(role); }
    if (search) {
      where.push("(email LIKE ? OR full_name LIKE ? OR ip LIKE ?)");
      const like = "%" + search + "%";
      params.push(like, like, like);
    }
    where.push("created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
    params.push(days);
    return { status, role, days, search, where: where.join(" AND "), params };
  }

  app.get("/admin/logs", async (req, res) => {
    const f = logFilters(req);
    const [rows] = await q(
      `SELECT *, ${pktTime("created_at")} AS at_pkt FROM login_logs
       WHERE ${f.where} ORDER BY id DESC LIMIT 300`,
      f.params
    );

    const [[today]] = await q(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(status='success'),0) AS ok,
              COALESCE(SUM(status='failed'),0) AS bad,
              COALESCE(SUM(status='suspended'),0) AS susp,
              COALESCE(SUM(status='blocked'),0) AS blk,
              COUNT(DISTINCT CASE WHEN status='success' THEN email END) AS people
       FROM login_logs WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 5 HOUR)`
    );

    const rowHtml = rows.map((r) => `<tr>
        <td class="muted" style="white-space:nowrap">${esc(r.at_pkt || "-")}</td>
        <td><strong>${esc(r.full_name) || "Unknown"}</strong><div class="muted" style="font-size:.78rem">${esc(r.email)}</div></td>
        <td>${esc(r.role) || "-"}</td>
        <td>${resultPill(r.status)}</td>
        <td class="muted">${esc(r.ip) || "-"}</td>
        <td class="muted" style="font-size:.8rem">${esc(deviceOf(r.user_agent))}</td>
      </tr>`).join("");

    const opt = (val, label, cur) =>
      `<option value="${esc(val)}"${String(cur) === String(val) ? " selected" : ""}>${esc(label)}</option>`;

    const failedToday = Number(today.bad || 0) + Number(today.susp || 0) + Number(today.blk || 0);

    res.send(layout("Admin — Login activity", "logs", `
      <div class="head-row"><div>
        <h1><i class="fa-solid fa-clock-rotate-left"></i> Login activity</h1>
        <p class="sub">Every sign-in attempt on the website, student portal, teacher portal and admin panel.</p>
      </div>
      <a class="btn b-read" href="/admin/logs.csv?status=${esc(f.status)}&role=${esc(f.role)}&days=${esc(f.days)}&q=${encodeURIComponent(f.search)}"><i class="fa-solid fa-download"></i> Export CSV</a></div>

      <div class="stats">
        <div class="box"><b>${Number(today.total || 0)}</b><span>Attempts today</span></div>
        <div class="box g"><b>${Number(today.ok || 0)}</b><span>Successful today</span></div>
        <div class="box o"><b>${failedToday}</b><span>Failed / blocked today</span></div>
        <div class="box v"><b>${Number(today.people || 0)}</b><span>Unique users today</span></div>
      </div>

      <div class="panel">
        <form method="get" action="/admin/logs" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px">
          <div style="flex:2;min-width:180px"><label>Search</label><input type="text" name="q" value="${esc(f.search)}" placeholder="Name, email or IP"></div>
          <div style="flex:1;min-width:130px"><label>Result</label><select name="status">
            ${opt("all", "All results", f.status)}${opt("success", "Success", f.status)}${opt("failed", "Failed", f.status)}${opt("suspended", "Suspended", f.status)}${opt("blocked", "Blocked", f.status)}
          </select></div>
          <div style="flex:1;min-width:120px"><label>Role</label><select name="role">
            ${opt("all", "All roles", f.role)}${opt("student", "Student", f.role)}${opt("teacher", "Teacher", f.role)}${opt("admin", "Admin", f.role)}
          </select></div>
          <div style="flex:1;min-width:120px"><label>Period</label><select name="days">
            ${opt(1, "Today", f.days)}${opt(7, "Last 7 days", f.days)}${opt(30, "Last 30 days", f.days)}${opt(90, "Last 90 days", f.days)}${opt(180, "Last 180 days", f.days)}
          </select></div>
          <div><label>&nbsp;</label><button class="btn b-add" type="submit"><i class="fa-solid fa-magnifying-glass"></i> Filter</button></div>
        </form>

        <table>
          <tr><th>Time (PKT)</th><th>Person</th><th>Role</th><th>Result</th><th>IP</th><th>Device</th></tr>
          ${rowHtml || `<tr><td colspan="6" class="empty">No login attempts in this period.</td></tr>`}
        </table>
        <p class="sub" style="margin:16px 0 0">Showing the latest ${rows.length} record(s). Logs are kept for 180 days.</p>
      </div>
    `));
  });

  app.get("/admin/logs.csv", async (req, res) => {
    const f = logFilters(req);
    const [rows] = await q(
      `SELECT *, ${pktTime("created_at")} AS at_pkt FROM login_logs
       WHERE ${f.where} ORDER BY id DESC LIMIT 5000`,
      f.params
    );
    const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [["Time (PKT)", "Name", "Email", "Role", "Result", "IP", "Device"].map(cell).join(",")];
    for (const r of rows) {
      lines.push([
        r.at_pkt || "", r.full_name || "", r.email || "", r.role || "",
        r.status || "", r.ip || "", deviceOf(r.user_agent),
      ].map(cell).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="login-activity.csv"');
    res.send("\uFEFF" + lines.join("\r\n"));
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

  console.log("  Portal admin mounted");
};
