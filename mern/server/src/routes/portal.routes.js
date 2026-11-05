import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { newId, nowSql } from "../utils/ids.js";
import { clean, asArray } from "../utils/validation.js";
import {
  fileUrl,
  makeUpload,
  publicPhoto,
  removeUpload,
  uploadRoot
} from "../utils/upload.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { listCourses } from "../services/course.service.js";
import { generateQuizQuestions } from "../services/quizGenerator.js";

const router = express.Router();
router.use(requireAuth);

const avatarUpload = makeUpload("avatars", [".jpg", ".jpeg", ".png", ".webp"], 1);
const docUpload = makeUpload(
  "documents",
  [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".heic", ".heif"],
  1
);
const submissionUpload = makeUpload(
  "documents",
  [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".doc", ".docx", ".txt", ".zip"],
  1,
  20
);
const materialUpload = makeUpload(
  "documents",
  [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".doc", ".docx", ".txt", ".zip", ".ppt", ".pptx"],
  1,
  25
);
const chatUpload = makeUpload(
  "chat",
  [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx", ".txt", ".mp3", ".wav", ".ogg", ".webm"],
  1,
  20
);
const callRecordingUpload = makeUpload(
  "calls",
  [".webm", ".ogg", ".mp3", ".wav", ".m4a"],
  1,
  50
);

function inClause(values) {
  if (!values.length) return "IN (NULL)";
  return `IN (${values.map(() => "?").join(",")})`;
}

function isStaff(user) {
  return user.role === "teacher" || user.role === "admin";
}

async function studentCourses(userId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT course_title FROM enrollments
     WHERE user_id = ? AND status IN ('approved', 'completed')`,
    [userId]
  );
  return rows.map((row) => row.course_title);
}

async function teacherCourses(teacherId) {
  const [rows] = await pool.query(
    "SELECT course_title FROM teacher_courses WHERE teacher_id = ?",
    [teacherId]
  );
  return rows.map((row) => row.course_title);
}

async function courseTitlesFor(user) {
  if (user.role === "student") return studentCourses(user.id);
  if (user.role === "teacher") return teacherCourses(user.id);
  const [rows] = await pool.query("SELECT title AS course_title FROM courses WHERE active = 1");
  return rows.map((row) => row.course_title);
}

async function canAccessCourse(user, courseTitle) {
  if (!courseTitle) return false;
  if (user.role === "admin") return true;
  const titles = await courseTitlesFor(user);
  return titles.includes(courseTitle);
}

async function assertCourseAccess(user, courseTitle) {
  if (!(await canAccessCourse(user, courseTitle))) {
    throw new ApiError(403, "You do not have access to this course");
  }
}

async function saveDocument({ scope, refId, userId, kind, label, file, uploadedBy }) {
  if (!file) return "";
  const folder = scope === "avatar" ? "avatars" : "documents";
  const relpath = fileUrl(file, folder);
  const id = newId("doc");
  await pool.query(
    `INSERT INTO documents
      (id, scope, ref_id, user_id, kind, label, originalname, relpath, size, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      scope,
      refId || "",
      userId || "",
      kind || "other",
      label || "",
      clean(file.originalname, 200),
      relpath,
      file.size || 0,
      uploadedBy || "user",
      nowSql()
    ]
  );
  return id;
}

function docFilePath(relpath) {
  const relative = String(relpath || "").replace(/^\/?uploads\//, "").replace(/\.\./g, "");
  const full = path.join(uploadRoot, relative);
  return full.startsWith(uploadRoot) ? full : null;
}

async function getProfile(user) {
  if (user.role === "student") {
    const [rows] = await pool.query("SELECT * FROM student_profiles WHERE user_id = ? LIMIT 1", [
      user.id
    ]);
    return rows[0] || {};
  }
  if (user.role === "teacher") {
    const [rows] = await pool.query("SELECT * FROM teacher_profiles WHERE user_id = ? LIMIT 1", [
      user.id
    ]);
    return rows[0] || {};
  }
  return {};
}

function publicUserRow(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    status: row.status,
    photo: row.photo || "",
    photo_url: publicPhoto(row.photo),
    created_at: row.created_at,
    last_login: row.last_login || null
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role === "student") {
      const titles = await studentCourses(user.id);
      const [enrollments] = await pool.query(
        `SELECT e.*, COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e
         LEFT JOIN payments p ON p.enrollment_id = e.id
         WHERE e.user_id = ?
         GROUP BY e.id
         ORDER BY e.created_at DESC`,
        [user.id]
      );

      const [assignments] = await pool.query(
        `SELECT a.*, s.id AS submission_id, s.status AS submission_status, s.marks, s.feedback
         FROM assignments a
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
         WHERE a.status = 'published' AND a.course_title ${inClause(titles)}
         ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC
         LIMIT 8`,
        [user.id, ...titles]
      );

      const [quizzes] = await pool.query(
        `SELECT q.*, qa.id AS attempt_id, qa.status AS attempt_status, qa.score, qa.total
         FROM quizzes q
         LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = ?
         WHERE q.status = 'published' AND (q.audience = 'all' OR q.course_title ${inClause(titles)})
         ORDER BY q.created_at DESC
         LIMIT 8`,
        [user.id, ...titles]
      );

      const [attendanceRows] = await pool.query(
        `SELECT a.status, COUNT(*) AS count
         FROM attendance a
         JOIN attendance_sessions s ON s.id = a.session_id
         WHERE a.student_id = ?
         GROUP BY a.status`,
        [user.id]
      );
      const attendanceTotal = attendanceRows.reduce((sum, row) => sum + Number(row.count), 0);
      const attended = attendanceRows
        .filter((row) => row.status === "present" || row.status === "late")
        .reduce((sum, row) => sum + Number(row.count), 0);
      const attendancePercent = attendanceTotal ? Math.round((attended / attendanceTotal) * 100) : 0;

      const [notices] = await pool.query(
        `SELECT * FROM notices
         WHERE audience IN ('all', 'students') OR target_user = ?
         ORDER BY created_at DESC LIMIT 6`,
        [user.id]
      );

      const [payments] = await pool.query(
        `SELECT p.*, e.course_title FROM payments p
         JOIN enrollments e ON e.id = p.enrollment_id
         WHERE e.user_id = ? ORDER BY p.paid_at DESC LIMIT 6`,
        [user.id]
      );

      const due = enrollments.reduce(
        (sum, row) => sum + Math.max(0, Number(row.amount_total || 0) - Number(row.paid || 0)),
        0
      );
      const pendingAssignments = assignments.filter(
        (row) => !row.submission_id && (!row.due_date || new Date(row.due_date) >= new Date())
      ).length;
      const availableQuizzes = quizzes.filter((row) => !row.attempt_status).length;

      return res.json({
        ok: true,
        data: {
          role: "student",
          stats: {
            enrollments: enrollments.length,
            approved: enrollments.filter((row) => row.status === "approved").length,
            pendingAssignments,
            availableQuizzes,
            attendancePercent,
            notices: notices.length,
            due
          },
          enrollments,
          assignments,
          quizzes,
          notices,
          payments,
          attendance: attendanceRows
        }
      });
    }

    if (user.role === "teacher") {
      const titles = await teacherCourses(user.id);
      const [studentRows] = await pool.query(
        `SELECT COUNT(DISTINCT user_id) AS count FROM enrollments
         WHERE status IN ('approved', 'completed') AND course_title ${inClause(titles)}`,
        [...titles]
      );
      const [assignmentRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM assignments WHERE teacher_id = ?",
        [user.id]
      );
      const [quizRows] = await pool.query(
        "SELECT COUNT(*) AS count FROM quizzes WHERE teacher_id = ?",
        [user.id]
      );
      const [pendingRows] = await pool.query(
        `SELECT COUNT(*) AS count FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         WHERE a.teacher_id = ? AND s.status = 'submitted'`,
        [user.id]
      );
      const [recentSubmissions] = await pool.query(
        `SELECT s.*, a.title AS assignment_title, a.course_title, u.full_name AS student_name
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN users u ON u.id = s.student_id
         WHERE a.teacher_id = ?
         ORDER BY s.submitted_at DESC LIMIT 8`,
        [user.id]
      );
      const [recentEnrollments] = await pool.query(
        `SELECT e.*, u.full_name AS student_name
         FROM enrollments e LEFT JOIN users u ON u.id = e.user_id
         WHERE e.course_title ${inClause(titles)}
         ORDER BY e.created_at DESC LIMIT 8`,
        [...titles]
      );
      const [upcomingClasses] = await pool.query(
        `SELECT * FROM timetable WHERE teacher_id = ? ORDER BY day_of_week, start_time LIMIT 8`,
        [user.id]
      );
      const [announcements] = await pool.query(
        "SELECT * FROM announcements WHERE teacher_id = ? ORDER BY created_at DESC LIMIT 6",
        [user.id]
      );

      return res.json({
        ok: true,
        data: {
          role: "teacher",
          stats: {
            courses: titles.length,
            students: Number(studentRows[0]?.count || 0),
            assignments: Number(assignmentRows[0]?.count || 0),
            quizzes: Number(quizRows[0]?.count || 0),
            pendingSubmissions: Number(pendingRows[0]?.count || 0)
          },
          recentSubmissions,
          recentEnrollments,
          upcomingClasses,
          announcements
        }
      });
    }

    const [[students], [teachers], [enrollments], [revenue], [pendingTeachers], [failedLogins]] =
      await Promise.all([
        pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'student'"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher'"),
        pool.query("SELECT COUNT(*) AS count FROM enrollments"),
        pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments"),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'teacher' AND status = 'pending'"),
        pool.query("SELECT COUNT(*) AS count FROM login_logs WHERE status IN ('failed','blocked','suspended')")
      ]);

    const [recentEnrollments] = await pool.query(
      `SELECT e.*, u.full_name AS student_name FROM enrollments e
       LEFT JOIN users u ON u.id = e.user_id ORDER BY e.created_at DESC LIMIT 10`
    );
    const [recentLogs] = await pool.query(
      "SELECT * FROM login_logs ORDER BY created_at DESC LIMIT 10"
    );

    res.json({
      ok: true,
      data: {
        role: "admin",
        stats: {
          students: Number(students[0]?.count || 0),
          teachers: Number(teachers[0]?.count || 0),
          enrollments: Number(enrollments[0]?.count || 0),
          revenue: Number(revenue[0]?.total || 0),
          pendingTeachers: Number(pendingTeachers[0]?.count || 0),
          failedLogins: Number(failedLogins[0]?.count || 0)
        },
        recentEnrollments,
        recentLogs
      }
    });
  })
);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    res.json({
      ok: true,
      data: { user: publicUserRow(req.user), profile: await getProfile(req.user) }
    });
  })
);

router.put(
  "/profile",
  asyncHandler(async (req, res) => {
    const fullName = clean(req.body.full_name, 120) || req.user.full_name;
    const phone = clean(req.body.phone, 30);
    const at = nowSql();

    await pool.query(
      "UPDATE users SET full_name = ?, phone = ?, updated_at = ? WHERE id = ?",
      [fullName, phone, at, req.user.id]
    );

    if (req.user.role === "student") {
      const fields = {
        dob: clean(req.body.dob, 20),
        gender: clean(req.body.gender, 20),
        cnic: clean(req.body.cnic, 20),
        address: clean(req.body.address, 240),
        city: clean(req.body.city, 80),
        guardian_name: clean(req.body.guardian_name, 120),
        guardian_phone: clean(req.body.guardian_phone, 30),
        last_qualification: clean(req.body.last_qualification, 160),
        interests: clean(req.body.interests, 240)
      };
      await pool.query(
        `INSERT INTO student_profiles
          (user_id, dob, gender, cnic, address, city, guardian_name, guardian_phone,
           last_qualification, interests, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           dob = VALUES(dob), gender = VALUES(gender), cnic = VALUES(cnic),
           address = VALUES(address), city = VALUES(city),
           guardian_name = VALUES(guardian_name), guardian_phone = VALUES(guardian_phone),
           last_qualification = VALUES(last_qualification), interests = VALUES(interests),
           updated_at = VALUES(updated_at)`,
        [
          req.user.id,
          fields.dob,
          fields.gender,
          fields.cnic,
          fields.address,
          fields.city,
          fields.guardian_name,
          fields.guardian_phone,
          fields.last_qualification,
          fields.interests,
          at
        ]
      );
    }

    if (req.user.role === "teacher") {
      await pool.query(
        `UPDATE teacher_profiles SET
          qualification = ?, expertise = ?, experience_years = ?, bio = ?,
          portfolio_url = ?, expected_fee = ?, availability = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          clean(req.body.qualification, 200),
          clean(req.body.expertise, 240),
          Math.max(0, Math.min(60, Number(req.body.experience_years || 0))),
          clean(req.body.bio, 2000),
          clean(req.body.portfolio_url, 240),
          clean(req.body.expected_fee, 60),
          clean(req.body.availability, 120),
          at,
          req.user.id
        ]
      );
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    res.json({
      ok: true,
      msg: "Profile updated",
      data: { user: publicUserRow(rows[0]), profile: await getProfile(rows[0]) }
    });
  })
);

router.post(
  "/profile/avatar",
  avatarUpload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "Please choose an image");
    const relpath = fileUrl(req.file, "avatars");
    await pool.query("UPDATE users SET photo = ?, updated_at = ? WHERE id = ?", [
      relpath,
      nowSql(),
      req.user.id
    ]);
    res.json({ ok: true, msg: "Photo updated", data: { photo_url: relpath } });
  })
);

// ---------------------------------------------------------------------------
// Enrollments, fees, documents
// ---------------------------------------------------------------------------
router.get(
  "/enrollments",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      [rows] = await pool.query(
        `SELECT e.*, COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e LEFT JOIN payments p ON p.enrollment_id = e.id
         WHERE e.user_id = ? GROUP BY e.id ORDER BY e.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === "teacher") {
      const titles = await teacherCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT e.*, u.full_name AS student_name, u.email AS student_email,
                COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN payments p ON p.enrollment_id = e.id
         WHERE e.course_title ${inClause(titles)}
         GROUP BY e.id ORDER BY e.created_at DESC`,
        [...titles]
      );
    } else {
      [rows] = await pool.query(
        `SELECT e.*, u.full_name AS student_name, u.email AS student_email,
                COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e
         LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN payments p ON p.enrollment_id = e.id
         GROUP BY e.id ORDER BY e.created_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/fees",
  asyncHandler(async (req, res) => {
    let enrollments;
    if (req.user.role === "student") {
      [enrollments] = await pool.query(
        `SELECT e.*, COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e LEFT JOIN payments p ON p.enrollment_id = e.id
         WHERE e.user_id = ? GROUP BY e.id ORDER BY e.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === "teacher") {
      const titles = await teacherCourses(req.user.id);
      [enrollments] = await pool.query(
        `SELECT e.*, u.full_name AS student_name, COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN payments p ON p.enrollment_id = e.id
         WHERE e.course_title ${inClause(titles)}
         GROUP BY e.id ORDER BY e.created_at DESC`,
        [...titles]
      );
    } else {
      [enrollments] = await pool.query(
        `SELECT e.*, u.full_name AS student_name, COALESCE(SUM(p.amount), 0) AS paid
         FROM enrollments e LEFT JOIN users u ON u.id = e.user_id
         LEFT JOIN payments p ON p.enrollment_id = e.id
         GROUP BY e.id ORDER BY e.created_at DESC`
      );
    }

    const ids = enrollments.map((row) => row.id);
    let payments = [];
    if (ids.length) {
      [payments] = await pool.query(
        `SELECT p.*, e.course_title, u.full_name AS student_name
         FROM payments p JOIN enrollments e ON e.id = p.enrollment_id
         LEFT JOIN users u ON u.id = e.user_id
         WHERE p.enrollment_id ${inClause(ids)}
         ORDER BY p.paid_at DESC`,
        [...ids]
      );
    }

    res.json({ ok: true, data: { enrollments, payments } });
  })
);

router.get(
  "/documents",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "admin") {
      [rows] = await pool.query(
        `SELECT d.*, u.full_name AS owner_name FROM documents d
         LEFT JOIN users u ON u.id = d.user_id
         ORDER BY d.uploaded_at DESC LIMIT 300`
      );
    } else {
      [rows] = await pool.query(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC",
        [req.user.id]
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/documents",
  docUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "Please choose a file");
    const id = await saveDocument({
      scope: clean(req.body.scope, 20) || "student",
      refId: clean(req.body.ref_id, 40),
      userId: req.user.id,
      kind: clean(req.body.kind, 40) || "other",
      label: clean(req.body.label, 80),
      file: req.file,
      uploadedBy: req.user.role
    });
    res.status(201).json({ ok: true, msg: "Document uploaded", data: { id } });
  })
);

router.delete(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM documents WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const doc = rows[0];
    if (!doc) throw new ApiError(404, "Document not found");
    if (req.user.role !== "admin" && doc.user_id !== req.user.id) {
      throw new ApiError(403, "You cannot delete this document");
    }
    await pool.query("DELETE FROM documents WHERE id = ?", [doc.id]);
    removeUpload(doc.relpath);
    res.json({ ok: true, msg: "Document deleted" });
  })
);

router.get(
  "/documents/:id/download",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM documents WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const doc = rows[0];
    if (!doc) throw new ApiError(404, "Document not found");
    if (req.user.role !== "admin" && doc.user_id !== req.user.id) {
      if (req.user.role === "teacher") {
        const titles = await teacherCourses(req.user.id);
        const [enr] = await pool.query("SELECT course_title FROM enrollments WHERE id = ? LIMIT 1", [
          doc.ref_id
        ]);
        if (!enr[0] || !titles.includes(enr[0].course_title)) {
          throw new ApiError(403, "You cannot access this document");
        }
      } else {
        throw new ApiError(403, "You cannot access this document");
      }
    }
    const full = docFilePath(doc.relpath);
    if (!full || !fs.existsSync(full)) throw new ApiError(404, "File not found");
    res.sendFile(full);
  })
);

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------
router.get(
  "/notices",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "admin") {
      [rows] = await pool.query("SELECT * FROM notices ORDER BY created_at DESC LIMIT 200");
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        `SELECT * FROM notices WHERE audience IN ('all', 'teachers') OR target_user = ?
         ORDER BY created_at DESC LIMIT 200`,
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT * FROM notices WHERE audience IN ('all', 'students') OR target_user = ?
         ORDER BY created_at DESC LIMIT 200`,
        [req.user.id]
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/notices",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 160);
    const body = clean(req.body.body, 4000);
    const audience = ["all", "students", "teachers"].includes(req.body.audience)
      ? req.body.audience
      : "all";
    if (title.length < 3) throw new ApiError(422, "Please enter a notice title");

    const id = newId("ntc");
    await pool.query(
      "INSERT INTO notices (id, audience, target_user, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, audience, clean(req.body.target_user, 40), title, body, nowSql()]
    );
    res.status(201).json({ ok: true, msg: "Notice published", data: { id } });
  })
);

router.delete(
  "/notices/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM notices WHERE id = ?", [req.params.id]);
    res.json({ ok: true, msg: "Notice deleted" });
  })
);

// ---------------------------------------------------------------------------
// Assignments & submissions
// ---------------------------------------------------------------------------
router.get(
  "/assignments",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      const titles = await studentCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT a.*, s.id AS submission_id, s.status AS submission_status, s.marks, s.feedback,
                s.submitted_at, s.doc_id AS submission_doc_id
         FROM assignments a
         LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
         WHERE a.status = 'published' AND a.course_title ${inClause(titles)}
         ORDER BY a.due_date IS NULL, a.due_date ASC, a.created_at DESC`,
        [req.user.id, ...titles]
      );
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        `SELECT a.*,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.status = 'submitted') AS pending_count
         FROM assignments a WHERE a.teacher_id = ? ORDER BY a.created_at DESC`,
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT a.*, u.full_name AS teacher_name,
          (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submission_count
         FROM assignments a LEFT JOIN users u ON u.id = a.teacher_id
         ORDER BY a.created_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/assignments",
  requireRole("teacher", "admin"),
  docUpload.single("file"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 200);
    const courseTitle = clean(req.body.course_title, 190);
    if (title.length < 3) throw new ApiError(422, "Please enter an assignment title");
    if (!courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher") await assertCourseAccess(req.user, courseTitle);

    const id = newId("asg");
    const docId = await saveDocument({
      scope: "assignment",
      refId: id,
      userId: req.user.id,
      kind: "other",
      label: "Assignment brief",
      file: req.file,
      uploadedBy: req.user.role
    });

    await pool.query(
      `INSERT INTO assignments
        (id, course_title, teacher_id, title, description, due_date, max_marks, doc_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseTitle,
        req.user.id,
        title,
        clean(req.body.description, 4000),
        req.body.due_date ? new Date(req.body.due_date) : null,
        Math.max(1, Number(req.body.max_marks || 100)),
        docId,
        ["draft", "published", "closed"].includes(req.body.status) ? req.body.status : "published",
        nowSql(),
        nowSql()
      ]
    );

    res.status(201).json({ ok: true, msg: "Assignment created", data: { id } });
  })
);

router.put(
  "/assignments/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM assignments WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const assignment = rows[0];
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (req.user.role === "teacher" && assignment.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot edit this assignment");
    }

    await pool.query(
      `UPDATE assignments SET title = ?, description = ?, due_date = ?, max_marks = ?,
        status = ?, updated_at = ? WHERE id = ?`,
      [
        clean(req.body.title, 200) || assignment.title,
        clean(req.body.description, 4000),
        req.body.due_date ? new Date(req.body.due_date) : assignment.due_date,
        Math.max(1, Number(req.body.max_marks || assignment.max_marks)),
        ["draft", "published", "closed"].includes(req.body.status)
          ? req.body.status
          : assignment.status,
        nowSql(),
        assignment.id
      ]
    );
    res.json({ ok: true, msg: "Assignment updated" });
  })
);

router.delete(
  "/assignments/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM assignments WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const assignment = rows[0];
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (req.user.role === "teacher" && assignment.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot delete this assignment");
    }
    await pool.query("DELETE FROM assignments WHERE id = ?", [assignment.id]);
    res.json({ ok: true, msg: "Assignment deleted" });
  })
);

router.post(
  "/assignments/:id/submit",
  submissionUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user.role !== "student") throw new ApiError(403, "Only students can submit assignments");
    const [rows] = await pool.query(
      "SELECT * FROM assignments WHERE id = ? AND status = 'published' LIMIT 1",
      [req.params.id]
    );
    const assignment = rows[0];
    if (!assignment) throw new ApiError(404, "Assignment not found or closed");
    await assertCourseAccess(req.user, assignment.course_title);

    const [existing] = await pool.query(
      "SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? LIMIT 1",
      [assignment.id, req.user.id]
    );

    const submissionId = existing[0]?.id || newId("sub");
    const docId = await saveDocument({
      scope: "submission",
      refId: submissionId,
      userId: req.user.id,
      kind: "other",
      label: "Assignment submission",
      file: req.file,
      uploadedBy: "student"
    });

    if (existing[0]) {
      await pool.query(
        `UPDATE submissions SET doc_id = ?, note = ?, submitted_at = ?, status = 'submitted',
          marks = NULL, feedback = NULL, graded_at = NULL, graded_by = '', updated_at = ?
         WHERE id = ?`,
        [
          docId || existing[0].doc_id,
          clean(req.body.note, 2000),
          nowSql(),
          nowSql(),
          submissionId
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO submissions
          (id, assignment_id, student_id, doc_id, note, submitted_at, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
        [
          submissionId,
          assignment.id,
          req.user.id,
          docId,
          clean(req.body.note, 2000),
          nowSql(),
          nowSql()
        ]
      );
    }

    res.json({ ok: true, msg: "Assignment submitted" });
  })
);

router.get(
  "/submissions",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "teacher") {
      [rows] = await pool.query(
        `SELECT s.*, a.title AS assignment_title, a.course_title, a.max_marks,
                u.full_name AS student_name, u.email AS student_email
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN users u ON u.id = s.student_id
         WHERE a.teacher_id = ? ORDER BY s.submitted_at DESC`,
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT s.*, a.title AS assignment_title, a.course_title, a.max_marks,
                u.full_name AS student_name, u.email AS student_email
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN users u ON u.id = s.student_id
         ORDER BY s.submitted_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.put(
  "/submissions/:id/grade",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT s.*, a.teacher_id, a.max_marks FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ? LIMIT 1`,
      [req.params.id]
    );
    const submission = rows[0];
    if (!submission) throw new ApiError(404, "Submission not found");
    if (req.user.role === "teacher" && submission.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot grade this submission");
    }

    const marks = Math.max(0, Math.min(Number(submission.max_marks), Number(req.body.marks || 0)));
    await pool.query(
      `UPDATE submissions SET marks = ?, feedback = ?, status = 'graded',
        graded_at = ?, graded_by = ?, updated_at = ? WHERE id = ?`,
      [marks, clean(req.body.feedback, 2000), nowSql(), req.user.id, nowSql(), submission.id]
    );
    res.json({ ok: true, msg: "Submission graded" });
  })
);

router.get(
  "/marks",
  asyncHandler(async (req, res) => {
    if (req.user.role === "student") {
      const [submissions] = await pool.query(
        `SELECT s.*, a.title AS assignment_title, a.course_title, a.max_marks
         FROM submissions s JOIN assignments a ON a.id = s.assignment_id
         WHERE s.student_id = ? AND s.status = 'graded'
         ORDER BY s.graded_at DESC`,
        [req.user.id]
      );
      const [attempts] = await pool.query(
        `SELECT qa.*, q.title AS quiz_title, q.course_title, q.pass_percent
         FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.student_id = ? AND qa.status = 'submitted'
         ORDER BY qa.submitted_at DESC`,
        [req.user.id]
      );
      return res.json({ ok: true, data: { submissions, attempts } });
    }

    const [submissions] = await pool.query(
      `SELECT s.*, a.title AS assignment_title, a.course_title, a.max_marks,
              u.full_name AS student_name
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN users u ON u.id = s.student_id
       ${req.user.role === "teacher" ? "WHERE a.teacher_id = ?" : ""}
       ORDER BY s.submitted_at DESC`,
      req.user.role === "teacher" ? [req.user.id] : []
    );
    res.json({ ok: true, data: { submissions } });
  })
);

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
router.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    if (req.user.role === "student") {
      const [rows] = await pool.query(
        `SELECT a.*, s.course_title, s.session_date, s.topic, s.teacher_id
         FROM attendance a JOIN attendance_sessions s ON s.id = a.session_id
         WHERE a.student_id = ? ORDER BY s.session_date DESC`,
        [req.user.id]
      );
      return res.json({ ok: true, data: rows });
    }

    const [sessions] = await pool.query(
      `SELECT s.*, u.full_name AS teacher_name,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id AND a.status IN ('present','late')) AS attended,
        (SELECT COUNT(*) FROM attendance a WHERE a.session_id = s.id) AS total
       FROM attendance_sessions s LEFT JOIN users u ON u.id = s.teacher_id
       ${req.user.role === "teacher" ? "WHERE s.teacher_id = ?" : ""}
       ORDER BY s.session_date DESC`,
      req.user.role === "teacher" ? [req.user.id] : []
    );
    res.json({ ok: true, data: { sessions } });
  })
);

router.post(
  "/attendance/sessions",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const courseTitle = clean(req.body.course_title, 190);
    if (!courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher") await assertCourseAccess(req.user, courseTitle);

    const id = newId("att");
    const sessionDate = req.body.session_date || new Date().toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO attendance_sessions (id, course_title, teacher_id, session_date, topic, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, courseTitle, req.user.id, sessionDate, clean(req.body.topic, 200), nowSql()]
    );

    const records = asArray(req.body.records);
    for (const record of records) {
      if (!record.student_id) continue;
      await pool.query(
        `INSERT INTO attendance (id, session_id, student_id, status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          newId("atd"),
          id,
          record.student_id,
          ["present", "absent", "late", "excused"].includes(record.status)
            ? record.status
            : "present",
          nowSql()
        ]
      );
    }

    res.status(201).json({ ok: true, msg: "Attendance saved", data: { id } });
  })
);

router.delete(
  "/attendance/sessions/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM attendance_sessions WHERE id = ?", [req.params.id]);
    res.json({ ok: true, msg: "Attendance session deleted" });
  })
);

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------
router.get(
  "/timetable",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      const titles = await studentCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT t.*, u.full_name AS teacher_name FROM timetable t
         LEFT JOIN users u ON u.id = t.teacher_id
         WHERE t.course_title ${inClause(titles)} ORDER BY t.day_of_week, t.start_time`,
        [...titles]
      );
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        "SELECT * FROM timetable WHERE teacher_id = ? ORDER BY day_of_week, start_time",
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT t.*, u.full_name AS teacher_name FROM timetable t
         LEFT JOIN users u ON u.id = t.teacher_id ORDER BY t.day_of_week, t.start_time`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/timetable",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const courseTitle = clean(req.body.course_title, 190);
    if (!courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher") await assertCourseAccess(req.user, courseTitle);

    const id = newId("tt");
    await pool.query(
      `INSERT INTO timetable (id, course_title, teacher_id, day_of_week, start_time, end_time, room, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseTitle,
        req.user.role === "teacher" ? req.user.id : clean(req.body.teacher_id, 40),
        Math.max(1, Math.min(7, Number(req.body.day_of_week || 1))),
        req.body.start_time || "09:00",
        req.body.end_time || "10:00",
        clean(req.body.room, 60),
        nowSql()
      ]
    );
    res.status(201).json({ ok: true, msg: "Timetable slot added", data: { id } });
  })
);

router.delete(
  "/timetable/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM timetable WHERE id = ?", [req.params.id]);
    res.json({ ok: true, msg: "Timetable slot deleted" });
  })
);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
router.get(
  "/materials",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      const titles = await studentCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT m.*, u.full_name AS teacher_name FROM materials m
         LEFT JOIN users u ON u.id = m.teacher_id
         WHERE m.course_title ${inClause(titles)} ORDER BY m.created_at DESC`,
        [...titles]
      );
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        "SELECT * FROM materials WHERE teacher_id = ? ORDER BY created_at DESC",
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT m.*, u.full_name AS teacher_name FROM materials m
         LEFT JOIN users u ON u.id = m.teacher_id ORDER BY m.created_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/materials",
  requireRole("teacher", "admin"),
  materialUpload.single("file"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 200);
    const courseTitle = clean(req.body.course_title, 190);
    if (title.length < 2) throw new ApiError(422, "Please enter a material title");
    if (!courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher") await assertCourseAccess(req.user, courseTitle);

    const id = newId("mat");
    const docId = await saveDocument({
      scope: "material",
      refId: id,
      userId: req.user.id,
      kind: "other",
      label: title,
      file: req.file,
      uploadedBy: req.user.role
    });

    await pool.query(
      `INSERT INTO materials
        (id, course_title, teacher_id, title, description, doc_id, external_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseTitle,
        req.user.id,
        title,
        clean(req.body.description, 3000),
        docId,
        clean(req.body.external_url, 500),
        nowSql()
      ]
    );
    res.status(201).json({ ok: true, msg: "Material added", data: { id } });
  })
);

router.delete(
  "/materials/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM materials WHERE id = ?", [req.params.id]);
    res.json({ ok: true, msg: "Material deleted" });
  })
);

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
router.get(
  "/announcements",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      const titles = await studentCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT an.*, u.full_name AS teacher_name FROM announcements an
         LEFT JOIN users u ON u.id = an.teacher_id
         WHERE an.course_title ${inClause(titles)}
         ORDER BY an.pinned DESC, an.created_at DESC`,
        [...titles]
      );
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        "SELECT * FROM announcements WHERE teacher_id = ? ORDER BY pinned DESC, created_at DESC",
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT an.*, u.full_name AS teacher_name FROM announcements an
         LEFT JOIN users u ON u.id = an.teacher_id ORDER BY an.pinned DESC, an.created_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/announcements",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 200);
    const courseTitle = clean(req.body.course_title, 190);
    if (title.length < 2) throw new ApiError(422, "Please enter an announcement title");
    if (!courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher") await assertCourseAccess(req.user, courseTitle);

    const id = newId("ann");
    await pool.query(
      `INSERT INTO announcements (id, course_title, teacher_id, title, body, pinned, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseTitle,
        req.user.id,
        title,
        clean(req.body.body, 4000),
        req.body.pinned ? 1 : 0,
        nowSql()
      ]
    );
    res.status(201).json({ ok: true, msg: "Announcement published", data: { id } });
  })
);

router.delete(
  "/announcements/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    await pool.query("DELETE FROM announcements WHERE id = ?", [req.params.id]);
    res.json({ ok: true, msg: "Announcement deleted" });
  })
);

// ---------------------------------------------------------------------------
// Quizzes & question bank
// ---------------------------------------------------------------------------
router.get(
  "/quizzes",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "student") {
      const titles = await studentCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT q.*, qa.id AS attempt_id, qa.status AS attempt_status, qa.score, qa.total,
           (SELECT COUNT(*) FROM quiz_answers qans
              WHERE qans.attempt_id = qa.id AND (qans.choice IS NULL OR qans.choice = '')) AS unanswered_count
         FROM quizzes q
         LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = ?
         WHERE q.status = 'published' AND (q.audience = 'all' OR q.course_title ${inClause(titles)})
         ORDER BY q.created_at DESC`,
        [req.user.id, ...titles]
      );
    } else if (req.user.role === "teacher") {
      [rows] = await pool.query(
        `SELECT q.*, (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
         FROM quizzes q WHERE q.teacher_id = ? ORDER BY q.created_at DESC`,
        [req.user.id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT q.*, u.full_name AS teacher_name,
          (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) AS question_count
         FROM quizzes q LEFT JOIN users u ON u.id = q.teacher_id
         ORDER BY q.created_at DESC`
      );
    }
    res.json({ ok: true, data: rows });
  })
);

router.get(
  "/quizzes/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT q.*, u.full_name AS teacher_name FROM quizzes q
       LEFT JOIN users u ON u.id = q.teacher_id WHERE q.id = ? LIMIT 1`,
      [req.params.id]
    );
    const quiz = rows[0];
    if (!quiz) throw new ApiError(404, "Quiz not found");

    const staff = isStaff(req.user) && (req.user.role === "admin" || quiz.teacher_id === req.user.id);
    if (req.user.role === "student") {
      if (quiz.status !== "published") throw new ApiError(403, "This quiz is not available");
      if (quiz.audience === "course") await assertCourseAccess(req.user, quiz.course_title);
    } else if (!staff && req.user.role !== "admin") {
      throw new ApiError(403, "You cannot view this quiz");
    }

    const [questions] = await pool.query(
      `SELECT id, q_no, question, option_a, option_b, option_c, option_d, marks
       ${staff || req.user.role === "admin" ? ", correct" : ""}
       FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no, id`,
      [quiz.id]
    );

    res.json({ ok: true, data: { quiz, questions } });
  })
);

router.post(
  "/quizzes",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.title, 200);
    const courseTitle = clean(req.body.course_title, 190);
    if (title.length < 2) throw new ApiError(422, "Please enter a quiz title");
    const audience = req.body.audience === "course" ? "course" : "all";
    if (audience === "course" && !courseTitle) throw new ApiError(422, "Please choose a course");
    if (req.user.role === "teacher" && audience === "course") await assertCourseAccess(req.user, courseTitle);

    const questions = asArray(req.body.questions);
    if (!questions.length) throw new ApiError(422, "Add at least one question");

    const id = newId("qz");
    const at = nowSql();
    await pool.query(
      `INSERT INTO quizzes
        (id, course_title, teacher_id, title, description, duration_minutes,
         pass_percent, audience, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        courseTitle,
        req.user.id,
        title,
        clean(req.body.description, 400),
        Math.max(1, Number(req.body.duration_minutes || 15)),
        Math.max(0, Math.min(100, Number(req.body.pass_percent || 50))),
        req.body.audience === "course" ? "course" : "all",
        ["draft", "published", "closed"].includes(req.body.status) ? req.body.status : "published",
        at,
        at
      ]
    );

    let index = 1;
    for (const question of questions) {
      await pool.query(
        `INSERT INTO quiz_questions
          (id, quiz_id, q_no, question, option_a, option_b, option_c, option_d, correct, marks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId("qq"),
          id,
          index++,
          clean(question.question, 2000),
          clean(question.option_a, 400),
          clean(question.option_b, 400),
          clean(question.option_c, 400),
          clean(question.option_d, 400),
          String(question.correct || "a").toLowerCase().slice(0, 1),
          Math.max(0.5, Number(question.marks || 1))
        ]
      );
    }

    res.status(201).json({ ok: true, msg: "Quiz created", data: { id } });
  })
);

router.put(
  "/quizzes/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const quiz = rows[0];
    if (!quiz) throw new ApiError(404, "Quiz not found");
    if (req.user.role === "teacher" && quiz.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot edit this quiz");
    }

    await pool.query(
      `UPDATE quizzes SET title = ?, description = ?, duration_minutes = ?, pass_percent = ?,
        audience = ?, status = ?, updated_at = ? WHERE id = ?`,
      [
        clean(req.body.title, 200) || quiz.title,
        clean(req.body.description, 400),
        Math.max(1, Number(req.body.duration_minutes || quiz.duration_minutes)),
        Math.max(0, Math.min(100, Number(req.body.pass_percent || quiz.pass_percent))),
        req.body.audience === "course" ? "course" : "all",
        ["draft", "published", "closed"].includes(req.body.status) ? req.body.status : quiz.status,
        nowSql(),
        quiz.id
      ]
    );

    const questions = asArray(req.body.questions);
    if (questions.length) {
      await pool.query("DELETE FROM quiz_questions WHERE quiz_id = ?", [quiz.id]);
      let index = 1;
      for (const question of questions) {
        await pool.query(
          `INSERT INTO quiz_questions
            (id, quiz_id, q_no, question, option_a, option_b, option_c, option_d, correct, marks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId("qq"),
            quiz.id,
            index++,
            clean(question.question, 2000),
            clean(question.option_a, 400),
            clean(question.option_b, 400),
            clean(question.option_c, 400),
            clean(question.option_d, 400),
            String(question.correct || "a").toLowerCase().slice(0, 1),
            Math.max(0.5, Number(question.marks || 1))
          ]
        );
      }
    }

    res.json({ ok: true, msg: "Quiz updated" });
  })
);

router.delete(
  "/quizzes/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const quiz = rows[0];
    if (!quiz) throw new ApiError(404, "Quiz not found");
    if (req.user.role === "teacher" && quiz.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot delete this quiz");
    }
    await pool.query("DELETE FROM quizzes WHERE id = ?", [quiz.id]);
    res.json({ ok: true, msg: "Quiz deleted" });
  })
);

router.post(
  "/quizzes/:id/start",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "student") throw new ApiError(403, "Only students can start quizzes");
    const [rows] = await pool.query("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const quiz = rows[0];
    if (!quiz || quiz.status !== "published") throw new ApiError(404, "Quiz not available");
    if (quiz.audience === "course") await assertCourseAccess(req.user, quiz.course_title);

    const [questions] = await pool.query(
      `SELECT id, q_no, question, option_a, option_b, option_c, option_d, marks
       FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no, id`,
      [quiz.id]
    );
    if (!questions.length) throw new ApiError(422, "This quiz has no questions yet");

    const [existing] = await pool.query(
      "SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? LIMIT 1",
      [quiz.id, req.user.id]
    );

    let attempt = existing[0];
    let restarted = false;
    if (attempt?.status === "submitted") {
      const [[unanswered]] = await pool.query(
        `SELECT COUNT(*) AS count FROM quiz_answers
         WHERE attempt_id = ? AND (choice IS NULL OR choice = '')`,
        [attempt.id]
      );
      if (Number(unanswered?.count || 0) > 0) {
        const restartedAt = nowSql();
        await pool.query("DELETE FROM quiz_answers WHERE attempt_id = ?", [attempt.id]);
        await pool.query(
          `UPDATE quiz_attempts
           SET started_at = ?, submitted_at = NULL, score = NULL, total = NULL, status = 'in_progress'
           WHERE id = ?`,
          [restartedAt, attempt.id]
        );
        attempt = {
          ...attempt,
          started_at: restartedAt,
          submitted_at: null,
          score: null,
          total: null,
          status: "in_progress"
        };
        restarted = true;
      } else {
        throw new ApiError(409, "You have already submitted this quiz");
      }
    }
    if (!attempt) {
      attempt = {
        id: newId("qa"),
        quiz_id: quiz.id,
        student_id: req.user.id,
        started_at: nowSql(),
        status: "in_progress"
      };
      await pool.query(
        `INSERT INTO quiz_attempts (id, quiz_id, student_id, started_at, status)
         VALUES (?, ?, ?, ?, 'in_progress')`,
        [attempt.id, quiz.id, req.user.id, attempt.started_at]
      );
    }

    const durationSeconds = Math.max(1, Number(quiz.duration_minutes || 15) * 60);
    const [[timeRow]] = await pool.query(
      `SELECT GREATEST(0, ? - TIMESTAMPDIFF(SECOND, started_at, UTC_TIMESTAMP())) AS remaining
       FROM quiz_attempts WHERE id = ?`,
      [durationSeconds, attempt.id]
    );
    const [[violations]] = await pool.query(
      "SELECT COUNT(*) AS count FROM quiz_violations WHERE attempt_id = ?",
      [attempt.id]
    );

    res.json({
      ok: true,
      data: {
        quiz,
        attempt,
        questions,
        remaining_seconds: Number(timeRow?.remaining ?? durationSeconds),
        violation_count: Number(violations?.count || 0),
        restarted
      }
    });
  })
);

router.post(
  "/quizzes/:id/submit",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "student") throw new ApiError(403, "Only students can submit quizzes");
    const [attempts] = await pool.query(
      `SELECT * FROM quiz_attempts WHERE id = ? AND quiz_id = ? AND student_id = ? LIMIT 1`,
      [req.body.attempt_id, req.params.id, req.user.id]
    );
    const attempt = attempts[0];
    if (!attempt) throw new ApiError(404, "Attempt not found");
    if (attempt.status === "submitted") throw new ApiError(409, "This attempt is already submitted");

    const [quizRows] = await pool.query("SELECT * FROM quizzes WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const quiz = quizRows[0];
    if (!quiz) throw new ApiError(404, "Quiz not found");

    const [questions] = await pool.query(
      "SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY q_no, id",
      [req.params.id]
    );
    if (!questions.length) throw new ApiError(422, "This quiz has no questions yet");

    const answers = req.body.answers || {};
    const force = req.body.force === true;
    const unanswered = questions.filter(
      (question) => !String(answers[question.id] || "").trim()
    );
    if (unanswered.length && !force) {
      throw new ApiError(
        422,
        `Please answer all questions before submitting. Unanswered: ${unanswered
          .map((question) => `Q${question.q_no}`)
          .join(", ")}`
      );
    }

    let score = 0;
    let total = 0;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query("DELETE FROM quiz_answers WHERE attempt_id = ?", [attempt.id]);

      for (const question of questions) {
        total += Number(question.marks);
        const choice = String(answers[question.id] || "").toLowerCase().slice(0, 1);
        const correct = choice && choice === String(question.correct).toLowerCase();
        const marks = correct ? Number(question.marks) : 0;
        score += marks;
        await connection.query(
          `INSERT INTO quiz_answers (id, attempt_id, question_id, choice, correct, marks)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId("qa2"), attempt.id, question.id, choice, correct ? 1 : 0, marks]
        );
      }

      await connection.query(
        `UPDATE quiz_attempts SET submitted_at = ?, score = ?, total = ?, status = 'submitted'
         WHERE id = ?`,
        [nowSql(), score, total, attempt.id]
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    const percent = total ? Math.round((score / total) * 100) : 0;
    const passPercent = Number(quiz.pass_percent ?? 50);
    res.json({
      ok: true,
      data: {
        score,
        total,
        percent,
        passed: percent >= passPercent,
        unanswered: unanswered.length
      }
    });
  })
);

router.post(
  "/quizzes/:id/violations",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "student") throw new ApiError(403, "Only students can report quiz violations");
    const allowed = new Set([
      "screen_hidden",
      "window_blur",
      "fullscreen_exit",
      "page_leave",
      "copy_attempt",
      "other"
    ]);
    const violationType = clean(req.body.type, 60);
    if (!allowed.has(violationType)) throw new ApiError(422, "Invalid violation type");

    const [attempts] = await pool.query(
      `SELECT * FROM quiz_attempts
       WHERE id = ? AND quiz_id = ? AND student_id = ? AND status = 'in_progress' LIMIT 1`,
      [req.body.attempt_id, req.params.id, req.user.id]
    );
    const attempt = attempts[0];
    if (!attempt) throw new ApiError(404, "Active quiz attempt not found");

    await pool.query(
      `INSERT INTO quiz_violations
        (id, quiz_id, attempt_id, student_id, violation_type, details, ip, user_agent, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId("qv"),
        req.params.id,
        attempt.id,
        req.user.id,
        violationType,
        clean(req.body.details, 255),
        String(req.ip || "").slice(0, 64),
        String(req.headers["user-agent"] || "").slice(0, 255),
        nowSql()
      ]
    );

    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS count FROM quiz_violations WHERE attempt_id = ?",
      [attempt.id]
    );
    res.status(201).json({ ok: true, data: { count: Number(count?.count || 0) } });
  })
);

router.get(
  "/qbank",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      req.user.role === "admin"
        ? "SELECT * FROM question_bank ORDER BY created_at DESC"
        : "SELECT * FROM question_bank WHERE teacher_id = ? ORDER BY created_at DESC",
      req.user.role === "admin" ? [] : [req.user.id]
    );
    res.json({ ok: true, data: rows });
  })
);

router.post(
  "/qbank",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const question = clean(req.body.question, 2000);
    if (question.length < 5) throw new ApiError(422, "Please enter a question");
    const id = newId("qb");
    await pool.query(
      `INSERT INTO question_bank
        (id, teacher_id, course_title, question, option_a, option_b, option_c, option_d, correct, marks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        clean(req.body.course_title, 190),
        question,
        clean(req.body.option_a, 400),
        clean(req.body.option_b, 400),
        clean(req.body.option_c, 400),
        clean(req.body.option_d, 400),
        String(req.body.correct || "a").toLowerCase().slice(0, 1),
        Math.max(0.5, Number(req.body.marks || 1)),
        nowSql()
      ]
    );
    res.status(201).json({ ok: true, msg: "Question saved", data: { id } });
  })
);

router.delete(
  "/qbank/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM question_bank WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const question = rows[0];
    if (!question) throw new ApiError(404, "Question not found");
    if (req.user.role === "teacher" && question.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot delete this question");
    }
    await pool.query("DELETE FROM question_bank WHERE id = ?", [question.id]);
    res.json({ ok: true, msg: "Question deleted" });
  })
);

router.post(
  "/qbank/ai",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const topic = clean(req.body.topic, 200);
    const courseTitle = clean(req.body.courseTitle, 190);
    if (!topic) throw new ApiError(422, "Please enter a topic");

    const result = await generateQuizQuestions({
      topic,
      count: req.body.count,
      geminiApiKey: clean(process.env.GEMINI_API_KEY, 400),
      geminiModel: clean(process.env.GEMINI_MODEL, 100),
      apiKey: clean(process.env.OPENAI_API_KEY, 400),
      model: clean(process.env.OPENAI_MODEL, 100),
      courseTitle
    });

    res.json({
      ok: true,
      data: result.questions,
      meta: { source: result.source, warning: result.warning }
    });
  })
);

// ---------------------------------------------------------------------------
// Call recordings
// ---------------------------------------------------------------------------
router.post(
  "/calls/:callKey/recording",
  callRecordingUpload.single("recording"),
  asyncHandler(async (req, res) => {
    const callKey = clean(req.params.callKey, 40);
    if (!callKey) throw new ApiError(422, "Call reference is required");
    if (!req.file) throw new ApiError(422, "Choose a recording file");

    const [rows] = await pool.query("SELECT * FROM call_logs WHERE call_key = ? LIMIT 1", [
      callKey
    ]);
    const call = rows[0];
    if (!call) throw new ApiError(404, "Call not found");
    if (call.caller_id !== req.user.id && call.callee_id !== req.user.id) {
      removeUpload(`calls/${req.file.filename}`);
      throw new ApiError(403, "You cannot upload a recording for this call");
    }
    if (call.recording_file) {
      removeUpload(`calls/${req.file.filename}`);
      throw new ApiError(409, "A recording already exists for this call");
    }

    const duration = Math.min(7200, Math.max(0, Number(req.body.duration) || 0));
    await pool.query(
      `UPDATE call_logs
          SET recording_file = ?, recording_mime = ?, recording_size = ?, recording_duration = ?
        WHERE call_key = ?`,
      [req.file.filename, req.file.mimetype || "audio/webm", req.file.size, duration, callKey]
    );

    res.status(201).json({ ok: true, msg: "Call recording saved" });
  })
);

router.get(
  "/calls/:callKey/recording",
  asyncHandler(async (req, res) => {
    const callKey = clean(req.params.callKey, 40);
    const [rows] = await pool.query("SELECT * FROM call_logs WHERE call_key = ? LIMIT 1", [
      callKey
    ]);
    const call = rows[0];
    if (!call) throw new ApiError(404, "Call not found");
    if (
      req.user.role !== "admin" &&
      call.caller_id !== req.user.id &&
      call.callee_id !== req.user.id
    ) {
      throw new ApiError(403, "You cannot open this recording");
    }
    if (!call.recording_file) throw new ApiError(404, "No recording is available for this call");

    const recordingPath = path.join(uploadRoot, "calls", path.basename(call.recording_file));
    if (!fs.existsSync(recordingPath)) throw new ApiError(404, "Recording file is missing");

    res.type(call.recording_mime || "audio/webm");
    res.setHeader("Content-Disposition", `inline; filename="call-${call.call_key}.webm"`);
    res.sendFile(recordingPath);
  })
);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const me = req.user.id;
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.role, u.photo, u.status,
        (SELECT m.body FROM chat_messages m
          WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1) AS last_body,
        (SELECT m.created_at FROM chat_messages m
          WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
          ORDER BY m.created_at DESC LIMIT 1) AS last_at,
        (SELECT COUNT(*) FROM chat_messages m
          WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL AND m.deleted_at IS NULL) AS unread
       FROM users u
       WHERE u.id <> ? AND u.status IN ('active', 'pending')
       ORDER BY last_at DESC, u.full_name ASC
       LIMIT 200`,
      [me, me, me, me, me, me]
    );

    res.json({
      ok: true,
      data: rows.map((row) => ({
        ...row,
        photo_url: publicPhoto(row.photo),
        unread: Number(row.unread || 0)
      }))
    });
  })
);

router.get(
  "/messages/attachments/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT ca.*, m.sender_id, m.recipient_id FROM chat_attachments ca
       JOIN chat_messages m ON m.id = ca.message_id WHERE ca.id = ? LIMIT 1`,
      [req.params.id]
    );
    const attachment = rows[0];
    if (!attachment) throw new ApiError(404, "Attachment not found");
    if (attachment.sender_id !== req.user.id && attachment.recipient_id !== req.user.id) {
      throw new ApiError(403, "You cannot access this attachment");
    }
    const full = docFilePath(`/uploads/chat/${attachment.stored_name}`);
    if (!full || !fs.existsSync(full)) throw new ApiError(404, "File not found");
    res.sendFile(full);
  })
);

router.get(
  "/messages/:userId",
  asyncHandler(async (req, res) => {
    const otherId = req.params.userId;
    const me = req.user.id;

    const [users] = await pool.query(
      "SELECT id, full_name, role, photo, status FROM users WHERE id = ? LIMIT 1",
      [otherId]
    );
    const other = users[0];
    if (!other) throw new ApiError(404, "User not found");

    await pool.query(
      `UPDATE chat_messages SET delivered_at = COALESCE(delivered_at, ?)
       WHERE sender_id = ? AND recipient_id = ?`,
      [nowSql(), otherId, me]
    );

    const [messages] = await pool.query(
      `SELECT * FROM chat_messages
       WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
         AND deleted_at IS NULL
         AND id NOT IN (SELECT message_id FROM chat_hidden WHERE user_id = ?)
       ORDER BY created_at ASC LIMIT 500`,
      [me, otherId, otherId, me, me]
    );

    const ids = messages.map((message) => message.id);
    let attachments = [];
    if (ids.length) {
      [attachments] = await pool.query(
        `SELECT * FROM chat_attachments WHERE message_id ${inClause(ids)}`,
        [...ids]
      );
    }

    res.json({
      ok: true,
      data: {
        user: { ...other, photo_url: publicPhoto(other.photo) },
        messages,
        attachments
      }
    });
  })
);

router.post(
  "/messages/:userId/read",
  asyncHandler(async (req, res) => {
    await pool.query(
      "UPDATE chat_messages SET read_at = ? WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL",
      [nowSql(), req.params.userId, req.user.id]
    );
    res.json({ ok: true });
  })
);

router.post(
  "/messages",
  chatUpload.single("file"),
  asyncHandler(async (req, res) => {
    const recipientId = clean(req.body.recipient_id, 40);
    const body = clean(req.body.body, 4000);
    if (!recipientId) throw new ApiError(422, "Choose a recipient");
    if (!body && !req.file) throw new ApiError(422, "Write a message or attach a file");

    const [users] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [recipientId]);
    if (!users[0]) throw new ApiError(404, "Recipient not found");

    const id = newId("msg");
    const at = nowSql();
    await pool.query(
      `INSERT INTO chat_messages (id, sender_id, recipient_id, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user.id, recipientId, body, at]
    );

    let attachment = null;
    if (req.file) {
      attachment = {
        id: newId("att"),
        message_id: id,
        sender_id: req.user.id,
        original_name: clean(req.file.originalname, 255),
        stored_name: req.file.filename,
        mime_type: req.file.mimetype || "",
        file_size: req.file.size || 0,
        created_at: at
      };
      await pool.query(
        `INSERT INTO chat_attachments
          (id, message_id, sender_id, original_name, stored_name, mime_type, file_size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          attachment.id,
          attachment.message_id,
          attachment.sender_id,
          attachment.original_name,
          attachment.stored_name,
          attachment.mime_type,
          attachment.file_size,
          attachment.created_at
        ]
      );
    }

    const payload = {
      message: {
        id,
        sender_id: req.user.id,
        recipient_id: recipientId,
        body,
        created_at: at
      },
      attachment
    };

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${recipientId}`).emit("chat:message", payload.message);
      io.to(`user:${req.user.id}`).emit("chat:message", payload.message);
    }

    res.status(201).json({ ok: true, data: payload });
  })
);

router.put(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM chat_messages WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const message = rows[0];
    if (!message) throw new ApiError(404, "Message not found");
    if (message.sender_id !== req.user.id) throw new ApiError(403, "You cannot edit this message");

    const body = clean(req.body.body, 4000);
    if (!body) throw new ApiError(422, "Message cannot be empty");
    const editedAt = nowSql();
    await pool.query("UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?", [
      body,
      editedAt,
      message.id
    ]);
    const io = req.app.get("io");
    if (io) {
      const payload = { id: message.id, body, edited_at: editedAt };
      io.to(`user:${message.recipient_id}`).emit("chat:message:update", payload);
      io.to(`user:${message.sender_id}`).emit("chat:message:update", payload);
    }
    res.json({ ok: true, msg: "Message updated" });
  })
);

router.delete(
  "/messages/:id",
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM chat_messages WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const message = rows[0];
    if (!message) throw new ApiError(404, "Message not found");
    if (message.sender_id !== req.user.id && req.user.role !== "admin") {
      throw new ApiError(403, "You cannot delete this message");
    }
    await pool.query("UPDATE chat_messages SET body = '', deleted_at = ? WHERE id = ?", [
      nowSql(),
      message.id
    ]);
    const [attachments] = await pool.query(
      "SELECT stored_name FROM chat_attachments WHERE message_id = ?",
      [message.id]
    );
    for (const attachment of attachments) {
      try {
        fs.unlinkSync(path.join(uploadRoot, "chat", path.basename(attachment.stored_name)));
      } catch {
        /* the file may already be gone */
      }
    }
    await pool.query("DELETE FROM chat_attachments WHERE message_id = ?", [message.id]);
    const io = req.app.get("io");
    if (io) {
      const payload = { id: message.id };
      io.to(`user:${message.recipient_id}`).emit("chat:message:delete", payload);
      io.to(`user:${message.sender_id}`).emit("chat:message:delete", payload);
    }
    res.json({ ok: true, msg: "Message deleted" });
  })
);

// ---------------------------------------------------------------------------
// People & courses
// ---------------------------------------------------------------------------
router.get(
  "/students",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "teacher") {
      const titles = await teacherCourses(req.user.id);
      [rows] = await pool.query(
        `SELECT DISTINCT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
                sp.city, sp.cnic, sp.last_qualification
         FROM users u
         JOIN enrollments e ON e.user_id = u.id
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.role = 'student' AND e.status IN ('approved', 'completed')
           AND e.course_title ${inClause(titles)}
         ORDER BY u.full_name`,
        [...titles]
      );
    } else {
      [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
                sp.city, sp.cnic, sp.last_qualification,
                (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollment_count
         FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
         WHERE u.role = 'student' ORDER BY u.full_name`
      );
    }
    res.json({
      ok: true,
      data: rows.map((row) => ({ ...row, photo_url: publicPhoto(row.photo) }))
    });
  })
);

router.get(
  "/teachers",
  asyncHandler(async (req, res) => {
    let rows;
    if (req.user.role === "admin") {
      [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
                tp.qualification, tp.expertise, tp.experience_years
         FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
         WHERE u.role = 'teacher' ORDER BY u.full_name`
      );
    } else {
      [rows] = await pool.query(
        `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.photo,
                tp.qualification, tp.expertise, tp.experience_years
         FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
         WHERE u.role = 'teacher' AND u.status = 'active' ORDER BY u.full_name`
      );
    }
    res.json({
      ok: true,
      data: rows.map((row) => ({ ...row, photo_url: publicPhoto(row.photo) }))
    });
  })
);

router.post(
  "/courses",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const title = clean(req.body.course_title || req.body.title, 190);
    if (!title) throw new ApiError(422, "Please enter a course title");

    const [existing] = await pool.query("SELECT id FROM courses WHERE title = ? LIMIT 1", [title]);
    if (!existing[0]) {
      await pool.query(
        `INSERT INTO courses
          (id, title, category, tag, short_desc, description, meta, price, featured, active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, ?)`,
        [
          newId("crs"),
          title,
          clean(req.body.category, 80),
          clean(req.body.tag, 60),
          clean(req.body.short_desc, 400),
          clean(req.body.description, 3000),
          clean(req.body.meta, 200),
          clean(req.body.price, 40),
          nowSql(),
          nowSql()
        ]
      );
    }

    const id = newId("tc");
    await pool.query(
      "INSERT INTO teacher_courses (id, teacher_id, course_title, created_at) VALUES (?, ?, ?, ?)",
      [id, req.user.id, title, nowSql()]
    );
    res.status(201).json({ ok: true, msg: "Course added", data: { id, course_title: title } });
  })
);

router.delete(
  "/courses/:id",
  requireRole("teacher", "admin"),
  asyncHandler(async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM teacher_courses WHERE id = ? LIMIT 1", [
      req.params.id
    ]);
    const row = rows[0];
    if (!row) throw new ApiError(404, "Course link not found");
    if (req.user.role === "teacher" && row.teacher_id !== req.user.id) {
      throw new ApiError(403, "You cannot remove this course");
    }
    await pool.query("DELETE FROM teacher_courses WHERE id = ?", [row.id]);
    res.json({ ok: true, msg: "Course removed" });
  })
);

router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    if (req.user.role === "admin") {
      return res.json({ ok: true, data: await listCourses({ includeInactive: true }) });
    }

    if (req.user.role === "teacher") {
      const [rows] = await pool.query(
        `SELECT c.*, tc.id AS teacher_course_id FROM courses c
         JOIN teacher_courses tc ON tc.course_title = c.title
         WHERE tc.teacher_id = ? ORDER BY c.sort_order, c.title`,
        [req.user.id]
      );
      return res.json({ ok: true, data: rows });
    }

    const [rows] = await pool.query(
      `SELECT DISTINCT c.* FROM courses c
       JOIN enrollments e ON e.course_title = c.title
       WHERE e.user_id = ? AND e.status IN ('approved', 'completed')
       ORDER BY c.sort_order, c.title`,
      [req.user.id]
    );
    res.json({ ok: true, data: rows });
  })
);

export default router;
