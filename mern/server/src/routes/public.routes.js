import express from "express";
import { pool } from "../config/db.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { newId, nowSql } from "../utils/ids.js";
import {
  clean,
  isValidEmail,
  isValidPKPhone,
  parsePrice
} from "../utils/validation.js";
import { makeUpload, fileUrl } from "../utils/upload.js";
import { listCourses, findCourse } from "../services/course.service.js";

const router = express.Router();

const enrollUpload = makeUpload(
  "enrollments",
  [".jpg", ".jpeg", ".png", ".pdf", ".webp", ".heic", ".heif"],
  10
).fields([
  { name: "cnic", maxCount: 1 },
  { name: "photo", maxCount: 1 },
  { name: "payment", maxCount: 1 },
  { name: "qualification", maxCount: 1 },
  { name: "other", maxCount: 5 }
]);

router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const courses = await listCourses();
    res.json({ ok: true, data: courses });
  })
);

router.get(
  "/courses/:id",
  asyncHandler(async (req, res) => {
    const course = await findCourse(req.params.id);
    if (!course) throw new ApiError(404, "Course not found");
    res.json({ ok: true, data: course });
  })
);

router.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 190).toLowerCase();
    const phone = clean(req.body.phone, 40);
    const message = clean(req.body.message, 2000);

    const errors = {};
    if (name.length < 2) errors.name = "Name must be at least 2 characters";
    if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
    if (!isValidPKPhone(phone)) errors.phone = "Enter a valid mobile number";
    if (message.length < 5) errors.message = "Message must be at least 5 characters";
    if (Object.keys(errors).length) {
      return res.status(422).json({ ok: false, errors, message: "Please fix the highlighted fields" });
    }

    await pool.query(
      `INSERT INTO contact_messages (id, name, email, phone, message, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId("msg"), name, email, phone, message, String(req.ip || "").slice(0, 64), nowSql()]
    );

    res.json({ ok: true, msg: "Thank you! Your message has been received." });
  })
);

router.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const email = clean(req.body.email, 190).toLowerCase();
    if (!isValidEmail(email)) throw new ApiError(422, "Please enter a valid email address");

    await pool.query("INSERT IGNORE INTO subscribers (id, email, created_at) VALUES (?, ?, ?)", [
      newId("sub"),
      email,
      nowSql()
    ]);

    res.json({ ok: true, msg: "Subscribed. You will hear from us soon." });
  })
);

router.post(
  "/enroll",
  enrollUpload,
  asyncHandler(async (req, res) => {
    const name = clean(req.body.name, 120);
    const email = clean(req.body.email, 190).toLowerCase();
    const phone = clean(req.body.phone, 40);
    const courseTitle = clean(req.body.course, 190);
    const price = clean(req.body.price, 40);
    const enrollmentType = clean(req.body.enrollmentType, 20) || "Online";
    const files = req.files || {};

    const errors = {};
    if (name.length < 2) errors.name = "Please enter your full name";
    if (!isValidEmail(email)) errors.email = "Please enter a valid email address";
    if (!isValidPKPhone(phone)) errors.phone = "Enter a valid mobile number";
    if (!courseTitle) errors.course = "Please choose a course";
    if (!files.cnic?.[0]) errors.cnic = "CNIC is required";
    if (!files.photo?.[0]) errors.photo = "Photo is required";
    if (!files.payment?.[0]) errors.payment = "Payment receipt is required";

    if (Object.keys(errors).length) {
      return res.status(422).json({ ok: false, errors, message: "Please complete the required fields" });
    }

    const [courseRows] = await pool.query(
      "SELECT id FROM courses WHERE title = ? LIMIT 1",
      [courseTitle]
    );

    const enrollmentId = newId("enr");
    const at = nowSql();

    await pool.query(
      `INSERT INTO enrollments
        (id, user_id, course_id, course_title, price, enrollment_type, status,
         payment_status, amount_total, notes, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, '', ?, ?, ?)`,
      [
        enrollmentId,
        req.user?.id || null,
        courseRows[0]?.id || "",
        courseTitle,
        price,
        enrollmentType,
        parsePrice(price),
        email,
        at,
        at
      ]
    );

    const docKinds = [
      ["cnic", "CNIC"],
      ["photo", "Photo"],
      ["payment", "Payment receipt"],
      ["qualification", "Qualification"],
      ["other", "Other"]
    ];

    for (const [field, label] of docKinds) {
      const list = files[field] || [];
      for (const file of list) {
        const relpath = fileUrl(file, "enrollments");
        await pool.query(
          `INSERT INTO documents
            (id, scope, ref_id, user_id, kind, label, originalname, relpath, size, uploaded_by, uploaded_at)
           VALUES (?, 'enrollment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId("doc"),
            enrollmentId,
            req.user?.id || "",
            field,
            label,
            clean(file.originalname, 200),
            relpath,
            file.size || 0,
            req.user?.id ? "user" : "public",
            at
          ]
        );
      }
    }

    res.status(201).json({
      ok: true,
      msg: "Your enrollment request has been received. Our team will review it within 24 hours.",
      enrollmentId
    });
  })
);

export default router;
