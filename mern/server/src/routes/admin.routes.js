import crypto from "node:crypto";
import express from "express";
import { pool } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { newId, nowSql } from "../utils/ids.js";
import { clean, isValidEmail } from "../utils/validation.js";
import { publicPhoto } from "../utils/upload.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse
} from "../services/course.service.js";
import { sendMail } from "../utils/mail.js";

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [
      [students],
      [teachers],
      [enrollments],
      [revenue],
      [pendingTeachers],
      [failedLogins],
      [pendingEnrollments]
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'"),
      pool.query("SELECT COUNT(*) AS count FROM enrollments"),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments"),
      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher' AND status = 'pending'"),
      pool.query(
        "SELECT COUNT(*) AS count FROM login_logs WHERE status IN ('failed','blocked','suspended')"
      ),
      pool.query("SELECT COUNT(*) AS count FROM enrollments WHERE status = 'pending'")
    ]);

    const [recentEnrollments] = await pool.query(
      `SELECT e.*, u.full_name AS student_name FROM enrollments e
       LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 12`
    );
    const [recentLogs] = await pool.query(
      "SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 12"
    );

    res.json({
      ok: true,
      data: {
        stats: {
          students: Number(students[0]?.count || 0),
          teachers: Number(teachers[0]?.count || 0),
          enrollments: Number(enrollments[0]?.count || 0),
          revenue: Number(revenue[0]?.total || 0),
          pendingTeachers: Number(pendingTeachers[0]?.count || 0),
          failedLogins: Number(failedLogins[0]?.count || 0),
          pendingEnrollments: Number(pendingEnrollments[0]?.count || 0)
        },
        recentEnrollments,
        recentLogs
      }
    });
  })
);

router.get(
  "/students",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
              u.created_at, u.last_login, sp.city, sp.cnic, sp.last_qualification,
              (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollment_count,
              (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
                 JOIN enrollments e ON e.id = p.enrollment_id WHERE e.user_id = u.id) AS paid
       FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.role = 'student' ORDER BY u.created_at DESC`
    );
    res.json({ ok: true, data: rows.map((row) => ({ ...row, photo_url: publicPhoto(row.photo) })) });
  })
);

router.put(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? AND role = 'student' LIMIT 1",
      [req.params.id]
    );
    const student = rows[0];
    if (!student) throw new ApiError(404, "Student not found");

    const status = ["active", "pending", "suspended", "rejected"].includes(req.body.status)
      ? req.body.status
      : student.status;

    await pool.query(
      "UPDATE users SET full_name = ?, phone = ?, status = ?, updated_at = ? WHERE id = ?",
      [
        clean(req.body.full_name, 120) || student.full_name,
        clean(req.body.phone, 30),
        status,
        nowSql(),
        student.id
      ]
    );

    if (req.body.city !== undefined || req.body.cnic !== undefined) {
      await pool.query(
        `INSERT INTO student_profiles (user_id, city, cnic, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE city = VALUES(city), cnic = VALUES(cnic), updated_at = VALUES(updated_at)`,
        [student.id, clean(req.body.city, 80), clean(req.body.cnic, 20), nowSql()]
      );
    }

    res.json({ ok: true, msg: "Student updated" });
  })
);

router.get(
  "/teachers",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
              u.created_at, u.last_login, tp.qualification, tp.expertise,
              tp.experience_years, tp.cv_file, tp.applied_at, tp.reviewed_at,
              tp.rejection_reason,
              (SELECT COUNT(*) FROM teacher_courses tc WHERE tc.teacher_id = u.id) AS course_count
       FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.role = 'teacher' ORDER BY u.created_at DESC`
    );
    res.json({ ok: true, data: rows.map((row) => ({ ...row, photo_url: publicPhoto(row.photo) })) });
  })
);

router.put(
  "/teachers/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE id = ? AND role = 'teacher' LIMIT 1",
      [req.params.id]
    );
    const teacher = rows[0];
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const status = ["active", "pending", "suspended", "rejected"].includes(req.body.status)
      ? req.body.status
      : teacher.status;
    const reviewedAt = status === "active" || status === "rejected" ? nowSql() : null;

    await pool.query(
      "UPDATE users SET full_name = ?, phone = ?, status = ?, updated_at = ? WHERE id = ?",
      [
        clean(req.body.full_name, 120) || teacher.full_name,
        clean(req.body.phone, 30),
        status,
        nowSql(),
        teacher.id
      ]
    );

    await pool.query(
      `UPDATE teacher_profiles SET
        qualification = COALESCE(NULLIF(?, ''), qualification),
        expertise = COALESCE(NULLIF(?, ''), expertise),
        experience_years = CASE WHEN ? = '' THEN experience_years ELSE ? END,
        rejection_reason = ?, reviewed_at = ?, updated_at = ?
       WHERE user_id = ?`,
      [
        clean(req.body.qualification, 200),
        clean(req.body.expertise, 240),
        req.body.experience_years === undefined ? "" : String(req.body.experience_years),
        Math.max(0, Math.min(60, Number(req.body.experience_years || 0))),
        status === "rejected" ? clean(req.body.rejection_reason, 240) : "",
        reviewedAt,
        nowSql(),
        teacher.id
      ]
    );

    res.json({ ok: true, msg: "Teacher updated" });
  })
);

router.get(
  "/enrollments",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT e.*, u.full_name AS student_name, u.email AS student_email,
              COALESCE(SUM(p.amount), 0) AS paid
       FROM enrollments e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN payments p ON p.enrollment_id = e.id
       GROUP BY e.id ORDER BY e.created_at DESC`
    );
    res.json({ ok: true, data: rows });
  })
);

router.put(
  "/enrollments/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM enrollments WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const enrollment = rows[0];
    if (!enrollment) throw new ApiError(404, "Enrollment not found");

    await pool.query(
      `UPDATE enrollments SET status = ?, payment_status = ?, amount_total = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        ["pending", "approved", "rejected", "completed"].includes(req.body.status)
          ? req.body.status
          : enrollment.status,
        ["unpaid", "partial", "paid"].includes(req.body.payment_status)
          ? req.body.payment_status
          : enrollment.payment_status,
        req.body.amount_total === undefined
          ? enrollment.amount_total
          : Math.max(0, Number(req.body.amount_total || 0)),
        clean(req.body.notes, 240),
        nowSql(),
        enrollment.id
      ]
    );
    res.json({ ok: true, msg: "Enrollment updated" });
  })
);

router.post(
  "/payments",
  asyncHandler(async (req, res) => {
    const enrollmentId = clean(req.body.enrollment_id, 40);
    const amount = Number(req.body.amount || 0);
    if (!enrollmentId || amount <= 0) {
      throw new ApiError(422, "Choose an enrollment and enter a valid amount");
    }

    const [rows] = await pool.query("SELECT * FROM enrollments WHERE id = ? LIMIT 1", [
      enrollmentId
    ]);
    const enrollment = rows[0];
    if (!enrollment) throw new ApiError(404, "Enrollment not found");

    await pool.query(
      `INSERT INTO payments (id, enrollment_id, amount, method, note, paid_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        newId("pay"),
        enrollment.id,
        amount,
        clean(req.body.method, 40),
        clean(req.body.note, 200),
        nowSql()
      ]
    );

    const [sumRows] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE enrollment_id = ?",
      [enrollment.id]
    );
    const paid = Number(sumRows[0]?.paid || 0);
    const paymentStatus =
      paid <= 0 ? "unpaid" : paid >= Number(enrollment.amount_total) ? "paid" : "partial";

    await pool.query("UPDATE enrollments SET payment_status = ?, updated_at = ? WHERE id = ?", [
      paymentStatus,
      nowSql(),
      enrollment.id
    ]);

    res.status(201).json({ ok: true, msg: "Payment recorded", data: { paid, paymentStatus } });
  })
);

router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, data: await listCourses({ includeInactive: true }) });
  })
);

router.post(
  "/courses",
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 190);
    if (title.length < 2) throw new ApiError(422, "Please enter a course title");
    const course = await createCourse({ ...req.body, title });
    res.status(201).json({ ok: true, msg: "Course created", data: course });
  })
);

router.put(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    const course = await updateCourse(req.params.id, req.body);
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ ok: true, msg: "Course updated", data: course });
  })
);

router.delete(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    await deleteCourse(req.params.id);
    res.json({ ok: true, msg: "Course deleted" });
  })
);

router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 500"
    );
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/calls",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT c.*, caller.full_name AS caller_name, callee.full_name AS callee_name
       FROM call_logs c
       LEFT JOIN users caller ON caller.id = c.caller_id
       LEFT JOIN users callee ON callee.id = c.callee_id
       ORDER BY c.started_at DESC LIMIT 500`
    );
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/notices",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM notices ORDER BY created_at DESC LIMIT 300");
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/resets",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT pr.*, u.full_name, u.email FROM password_resets pr
       JOIN users u ON u.id = pr.user_id ORDER BY pr.requested_at DESC LIMIT 200`
    );
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/resets",
  asyncHandler(async (req, res) => {
    const email = clean(req.body.email, 190).toLowerCase();
    if (!isValidEmail(email)) throw new ApiError(422, "Please enter a valid email address");

    const [rows] = await pool.query(
      "SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = rows[0];
    if (!user) throw new ApiError(404, "User not found");

    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO password_resets (id, token, user_id, requested_at, expires_at, used)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [
        newId("pr"),
        token,
        user.id,
        nowSql(),
        expires.toISOString().slice(0, 19).replace("T", " ")
      ]
    );

    const base = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${base.replace(/\/$/, "")}/reset-password?token=${token}`;
    await sendMail({
      to: user.email,
      subject: "Reset your TechNexa password",
      text: `Hello ${user.full_name},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}`,
      html: `<p>Hello ${user.full_name},</p><p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour).</p>`
    });

    res.status(201).json({ ok: true, msg: "Reset link generated", data: { resetUrl } });
  })
);

router.get(
  "/contact-messages",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 300"
    );
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/subscribers",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 500");
    res.json({ ok: true, data: rows });
  })
);

const simpleLists = {
  assignments: "SELECT * FROM assignments ORDER BY created_at DESC LIMIT 300",
  quizzes: "SELECT * FROM quizzes ORDER BY created_at DESC LIMIT 300",
  submissions: `SELECT s.*, a.title AS assignment_title, a.course_title, u.full_name AS student_name
                FROM submissions s JOIN assignments a ON a.id = s.assignment_id
                JOIN users u ON u.id = s.student_id ORDER BY s.submitted_at DESC LIMIT 300`,
  attendance: `SELECT s.*, u.full_name AS teacher_name FROM attendance_sessions s
               LEFT JOIN users u ON u.id = s.teacher_id ORDER BY s.session_date DESC LIMIT 300`,
  timetable: `SELECT t.*, u.full_name AS teacher_name FROM timetable t
              LEFT JOIN users u ON u.id = t.teacher_id ORDER BY t.day_of_week, t.start_time`,
  materials: `SELECT m.*, u.full_name AS teacher_name FROM materials m
              LEFT JOIN users u ON u.id = m.teacher_id ORDER BY m.created_at DESC LIMIT 300`,
  announcements: `SELECT a.*, u.full_name AS teacher_name FROM announcements a
                  LEFT JOIN users u ON u.id = a.teacher_id ORDER BY a.created_at DESC LIMIT 300`,
  qbank: "SELECT * FROM question_bank ORDER BY created_at DESC LIMIT 500"
};

for (const [path, sql] of Object.entries(simpleLists)) {
  router.get(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const [rows] = await pool.query(sql);
      res.json({ ok: true, data: rows });
    })
  );
}

export default router;
