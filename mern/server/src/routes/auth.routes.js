import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { loginAttemptsTotal } from "../config/metrics.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { newId, nowSql } from "../utils/ids.js";
import {
  clean,
  isValidEmail,
  isValidPKPhone,
  passwordIssue
} from "../utils/validation.js";
import { makeUpload, fileUrl, verifyMagic, dropFile } from "../utils/upload.js";
import { authRateLimiter } from "../middleware/rateLimit.middleware.js";
import {
  AUTH_COOKIE,
  clearAuthCookie,
  publicUser,
  setAuthCookie,
  signToken
} from "../middleware/attachUser.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { sendMail } from "../utils/mail.js";

const router = express.Router();
const cvUpload = makeUpload("documents", [".pdf", ".jpg", ".jpeg", ".png"], 1);function loginLog(req, { userId = null, email = "", role = "", fullName = "", status = "success" }) {
  return pool
    .query(
      `INSERT INTO login_logs (user_id, email, role, full_name, status, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email,
        role,
        fullName,
        status,
        String(req.ip || "").slice(0, 64),
        String(req.headers["user-agent"] || "").slice(0, 255),
        nowSql()
      ]
    )
    .catch(() => null);
}

router.post(
  "/register/student",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const fullName = clean(req.body.full_name, 120);
    const email = clean(req.body.email, 190).toLowerCase();
    const phone = clean(req.body.phone, 30);
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");

    if (fullName.length < 2) throw new ApiError(422, "Please enter your full name");
    if (!isValidEmail(email)) throw new ApiError(422, "Please enter a valid email address");
    if (!isValidPKPhone(phone)) throw new ApiError(422, "Enter a valid Pakistani mobile number");
    const issue = passwordIssue(password);
    if (issue) throw new ApiError(422, issue);
    if (password !== password2) throw new ApiError(422, "Passwords do not match");

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing[0]) throw new ApiError(409, "An account with this email already exists");

    const id = newId("usr");
    const hash = await bcrypt.hash(password, 12);
    const at = nowSql();

    await pool.query(
      `INSERT INTO users (id, role, email, password_hash, full_name, phone, status, photo, created_at, updated_at)
       VALUES (?, 'student', ?, ?, ?, ?, 'active', '', ?, ?)`,
      [id, email, hash, fullName, phone, at, at]
    );

    await pool.query(
      `INSERT INTO student_profiles (user_id, updated_at) VALUES (?, ?)`,
      [id, at]
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    setAuthCookie(res, signToken(rows[0]));
    res.status(201).json({ ok: true, data: publicUser(rows[0]) });
  })
);

router.post(
  "/register/teacher",
  authRateLimiter,
  cvUpload.single("cv"),
  asyncHandler(async (req, res) => {
    const fullName = clean(req.body.full_name, 120);
    const email = clean(req.body.email, 190).toLowerCase();
    const phone = clean(req.body.phone, 30);
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");
    const qualification = clean(req.body.qualification, 200);
    const expertise = clean(req.body.expertise, 240);
    const experienceYears = Math.max(0, Math.min(60, Number(req.body.experience_years || 0)));
    const bio = clean(req.body.bio, 2000);
    const portfolioUrl = clean(req.body.portfolio_url, 240);

    if (fullName.length < 2) throw new ApiError(422, "Please enter your full name");
    if (!isValidEmail(email)) throw new ApiError(422, "Please enter a valid email address");
    if (!isValidPKPhone(phone)) throw new ApiError(422, "Enter a valid Pakistani mobile number");
    const issue = passwordIssue(password);
    if (issue) throw new ApiError(422, issue);
    if (password !== password2) throw new ApiError(422, "Passwords do not match");

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (existing[0]) throw new ApiError(409, "An account with this email already exists");

    if (req.file) {
      const check = verifyMagic(req.file);
      if (!check.ok) {
        dropFile(req.file);
        throw new ApiError(415, `CV rejected: ${check.reason}`);
      }
    }
    const id = newId("usr");
    const hash = await bcrypt.hash(password, 12);
    const at = nowSql();
    const cvFile = fileUrl(req.file, "documents");

    await pool.query(
      `INSERT INTO users (id, role, email, password_hash, full_name, phone, status, photo, created_at, updated_at)
       VALUES (?, 'teacher', ?, ?, ?, ?, 'pending', '', ?, ?)`,
      [id, email, hash, fullName, phone, at, at]
    );

    await pool.query(
      `INSERT INTO teacher_profiles
        (user_id, qualification, expertise, experience_years, bio, portfolio_url, cv_file, applied_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, qualification, expertise, experienceYears, bio, portfolioUrl, cvFile, at, at]
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    setAuthCookie(res, signToken(rows[0]));
    res.status(201).json({ ok: true, data: publicUser(rows[0]) });
  })
);

router.post(
  "/login",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const email = clean(req.body.email, 190).toLowerCase();
    const password = String(req.body.password || "");

    if (!isValidEmail(email) || !password) {
      throw new ApiError(422, "Email and password are required");
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      loginAttemptsTotal.inc({ role: "unknown", result: "invalid_credentials" });
      await loginLog(req, { email, status: "failed" });
      throw new ApiError(401, "Invalid email or password");
    }

    if (user.status === "suspended" || user.status === "rejected") {
      loginAttemptsTotal.inc({ role: user.role, result: "blocked" });
      await loginLog(req, {
        userId: user.id,
        email,
        role: user.role,
        fullName: user.full_name,
        status: user.status === "suspended" ? "suspended" : "blocked"
      });
      throw new ApiError(
        403,
        user.status === "suspended"
          ? "Your account has been suspended. Please contact the administration."
          : "Your application was not approved. Please contact the administration."
      );
    }

    const at = nowSql();
    await pool.query("UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?", [at, at, user.id]);
    await loginLog(req, {
      userId: user.id,
      email,
      role: user.role,
      fullName: user.full_name,
      status: "success"
    });

    setAuthCookie(res, signToken(user));
    loginAttemptsTotal.inc({ role: user.role, result: "success" });
    res.json({ ok: true, data: publicUser({ ...user, last_login: at }) });
  })
);

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true, msg: "Signed out" });
});

router.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, message: "Not signed in" });
  res.json({ ok: true, data: publicUser(req.user) });
});

router.post(
  "/forgot-password",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const email = clean(req.body.email, 190).toLowerCase();
    if (!isValidEmail(email)) throw new ApiError(422, "Please enter a valid email address");

    const [rows] = await pool.query(
      "SELECT id, full_name, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const user = rows[0];

    let resetUrl = "";
    if (user) {
      const token = crypto.randomBytes(24).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const at = new Date();
      const expires = new Date(at.getTime() + 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO password_resets (id, token, user_id, requested_at, expires_at, used)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [newId("pr"), tokenHash, user.id, nowSql(), expires.toISOString().slice(0, 19).replace("T", " ")]
      );

      const base = process.env.CLIENT_URL || "http://localhost:5173";
      resetUrl = `${base.replace(/\/$/, "")}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: "Reset your TechNexa password",
        text: `Hello ${user.full_name},\n\nUse this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
        html: `<p>Hello ${user.full_name},</p><p>Use the link below to reset your password. It is valid for 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`
      });
    }

    res.json({
      ok: true,
      msg: "If an account exists for this email, a reset link has been sent.",
      ...(process.env.NODE_ENV !== "production" && resetUrl ? { resetUrl } : {})
    });
  })
);

router.post(
  "/reset-password",
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const token = clean(req.body.token, 80);
    const password = String(req.body.password || "");
    const password2 = String(req.body.password2 || "");

    if (!token) throw new ApiError(422, "Reset token is missing");
    const issue = passwordIssue(password);
    if (issue) throw new ApiError(422, issue);
    if (password !== password2) throw new ApiError(422, "Passwords do not match");

    const [rows] = await pool.query(
      `SELECT * FROM password_resets
       WHERE token = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
      [crypto.createHash("sha256").update(String(token)).digest("hex")]
    );
    const reset = rows[0];
    if (!reset) throw new ApiError(400, "This reset link is invalid or has expired");

    const hash = await bcrypt.hash(password, 12);
    await pool.query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
      hash,
      nowSql(),
      reset.user_id
    ]);
    await pool.query("UPDATE password_resets SET used = 1 WHERE id = ?", [reset.id]);

    res.json({ ok: true, msg: "Password updated. You can sign in now." });
  })
);

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const current = String(req.body.current_password || "");
    const next = String(req.body.new_password || "");
    const issue = passwordIssue(next);
    if (issue) throw new ApiError(422, issue);

    const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [
      req.user.id
    ]);
    if (!rows[0] || !(await bcrypt.compare(current, rows[0].password_hash))) {
      throw new ApiError(401, "Current password is incorrect");
    }

    const hash = await bcrypt.hash(next, 12);
    await pool.query("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?", [
      hash,
      nowSql(),
      req.user.id
    ]);
    res.json({ ok: true, msg: "Password changed" });
  })
);

export default router;
